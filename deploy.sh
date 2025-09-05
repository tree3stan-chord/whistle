#!/usr/bin/env bash
# Deploy Whistle – hybrid frontend + Node.js backend
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y-%m-%d-%H%M%S)
OUT=~/builds/$STAMP
mkdir -p "$OUT"

echo "▶ Prepare build directory"
rsync -az --delete --exclude deploy.sh --exclude .git --exclude node_modules \
      "$PROJECT_DIR"/ "$OUT"/

echo "▶ Install backend dependencies"
cd "$OUT/backend"
if [ ! -f package-lock.json ]; then
    echo "  → Generating package-lock.json..."
    npm install --package-lock-only
else
    echo "  → Checking package-lock.json sync..."
    # Check if package-lock is in sync with package.json
    if ! npm ci --dry-run --silent 2>/dev/null; then
        echo "  → Package-lock out of sync, regenerating..."
        rm -f package-lock.json
        npm install --package-lock-only
    fi
fi
npm ci --omit=dev

echo "▶ Prepare backend directories"
cd "$OUT/backend"
mkdir -p data logs

echo "▶ Build frontend for production"
cd "$OUT"
# Copy frontend files to public directory
mkdir -p public
cp -r js index.html styles.css public/

echo "▶ Publish release"
rsync -az --delete "$OUT"/ /var/www/whistle.musicsian.com/releases/$STAMP/

echo "▶ Stop existing backend service"
sudo systemctl stop whistle-backend || echo "Service not running"

echo "▶ Flip symlink"
sudo ln -nfs /var/www/whistle.musicsian.com/releases/$STAMP \
            /var/www/whistle.musicsian.com/current

echo "▶ Update systemd service"
sudo tee /etc/systemd/system/whistle-backend.service > /dev/null << EOF
[Unit]
Description=Whistle Music Notation Backend
After=network.target

[Service]
Type=simple
User=nginx
Group=nginx
ExecStart=/usr/bin/node /var/www/whistle.musicsian.com/current/backend/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=HOST=127.0.0.1
Environment=DATABASE_PATH=/var/www/whistle.musicsian.com/current/backend/data/whistle.db
Environment=JWT_SECRET=$(openssl rand -hex 32)

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=whistle-backend

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Set proper permissions"
sudo chown -R nginx:nginx /var/www/whistle.musicsian.com/current/backend/
sudo chmod -R 755 /var/www/whistle.musicsian.com/current/backend/
sudo chmod -R 775 /var/www/whistle.musicsian.com/current/backend/data/
sudo chmod -R 775 /var/www/whistle.musicsian.com/current/backend/logs/
# Ensure database directory is writable by nginx user
sudo mkdir -p /var/www/whistle.musicsian.com/current/backend/data
sudo chown nginx:nginx /var/www/whistle.musicsian.com/current/backend/data
sudo chmod 775 /var/www/whistle.musicsian.com/current/backend/data

echo "▶ Reload systemd and start backend"
sudo systemctl daemon-reload
sudo systemctl enable whistle-backend
sudo systemctl start whistle-backend

echo "▶ Wait for backend to start"
sleep 3
if ! curl -f http://127.0.0.1:3002/health >/dev/null 2>&1; then
  echo "❌ Backend health check failed!"
  sudo journalctl -u whistle-backend --lines=20
  exit 1
fi

echo "▶ Restore SELinux labels"
sudo restorecon -Rv /var/www/whistle.musicsian.com/releases/$STAMP >/dev/null

echo "▶ Update Nginx configuration for new port"
sudo sed -i 's/server 127\.0\.0\.1:3001;/server 127.0.0.1:3002;/' /etc/nginx/conf.d/whistle.musicsian.com.conf

echo "▶ Reload Nginx"
sudo systemctl reload nginx

echo "▶ Cleanup old releases (keep 5)"
cd /var/www/whistle.musicsian.com/releases
ls -1t | tail -n +6 | xargs -r sudo rm -rf

echo "✓ Deployed $STAMP → whistle.musicsian.com"
echo "✓ Backend running on http://127.0.0.1:3002"
echo "✓ Frontend served by nginx with API proxy"

# Show service status
echo ""
echo "Service status:"
sudo systemctl status whistle-backend --no-pager -l