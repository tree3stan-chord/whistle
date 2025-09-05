#!/usr/bin/env bash
# Deploy Whistle – hybrid frontend + Node.js backend
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y-%m-%d-%H%M%S)
OUT=~/builds/$STAMP
mkdir -p "$OUT"

echo "🚀 Deploying Whistle $STAMP..."

# Prepare build
rsync -az --delete --exclude deploy.sh --exclude .git --exclude node_modules \
      "$PROJECT_DIR"/ "$OUT"/ 2>/dev/null

# Install dependencies 
cd "$OUT/backend"
if [ ! -f package-lock.json ] || ! npm ci --dry-run --silent 2>/dev/null; then
    npm install --package-lock-only >/dev/null 2>&1
fi
npm ci --omit=dev >/dev/null 2>&1

# Build frontend
cd "$OUT"
mkdir -p public data logs backend/data backend/logs
cp -r js index.html styles.css css public/ 2>/dev/null

# Deploy to production
rsync -az --delete "$OUT"/ /var/www/whistle.musicsian.com/releases/$STAMP/ 2>/dev/null
sudo systemctl stop whistle-backend 2>/dev/null || true
sudo ln -nfs /var/www/whistle.musicsian.com/releases/$STAMP /var/www/whistle.musicsian.com/current

# Update systemd service
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

# Set permissions
sudo chown -R nginx:nginx /var/www/whistle.musicsian.com/current/backend/ 2>/dev/null
sudo chmod -R 755 /var/www/whistle.musicsian.com/current/backend/ 2>/dev/null
sudo chmod -R 775 /var/www/whistle.musicsian.com/current/backend/{data,logs}/ 2>/dev/null
sudo mkdir -p /var/www/whistle.musicsian.com/current/backend/data 2>/dev/null
sudo chown nginx:nginx /var/www/whistle.musicsian.com/current/backend/data 2>/dev/null

# Start services
sudo systemctl daemon-reload 2>/dev/null
sudo systemctl enable whistle-backend 2>/dev/null
sudo systemctl start whistle-backend 2>/dev/null

# Health check
sleep 3
if ! curl -f http://127.0.0.1:3002/health >/dev/null 2>&1; then
    echo "❌ Deployment failed - backend health check failed"
    sudo journalctl -u whistle-backend --lines=10 --no-pager
    exit 1
fi

# Update nginx and cleanup
sudo sed -i 's/server 127\.0\.0\.1:3001;/server 127.0.0.1:3002;/' /etc/nginx/conf.d/whistle.musicsian.com.conf 2>/dev/null
sudo systemctl reload nginx 2>/dev/null
sudo restorecon -Rv /var/www/whistle.musicsian.com/releases/$STAMP >/dev/null 2>&1 || true

# Cleanup old releases
cd /var/www/whistle.musicsian.com/releases
ls -1t | tail -n +6 | xargs -r sudo rm -rf 2>/dev/null || true

echo "✅ Successfully deployed to whistle.musicsian.com"
echo "🔗 https://whistle.musicsian.com"