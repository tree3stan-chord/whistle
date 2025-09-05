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
npm ci --only=production

echo "▶ Initialize database"
cd "$OUT/backend"
node -e "
const { initializeDatabase } = require('./config/database');
initializeDatabase().then(() => {
  console.log('Database initialized successfully');
  process.exit(0);
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
"

echo "▶ Build frontend for production"
cd "$OUT"
# Copy frontend files to public directory
mkdir -p public
cp -r js css images index.html public/

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
WorkingDirectory=/var/www/whistle.musicsian.com/current/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=127.0.0.1
Environment=JWT_SECRET=$(openssl rand -hex 32)

# Security settings
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/www/whistle.musicsian.com/current/backend/data
ReadWritePaths=/var/www/whistle.musicsian.com/current/backend/logs
NoNewPrivileges=yes
CapabilityBoundingSet=

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=whistle-backend

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Reload systemd and start backend"
sudo systemctl daemon-reload
sudo systemctl enable whistle-backend
sudo systemctl start whistle-backend

echo "▶ Wait for backend to start"
sleep 3
if ! curl -f http://127.0.0.1:3001/health >/dev/null 2>&1; then
  echo "❌ Backend health check failed!"
  sudo journalctl -u whistle-backend --lines=20
  exit 1
fi

echo "▶ Restore SELinux labels"
sudo restorecon -Rv /var/www/whistle.musicsian.com/releases/$STAMP >/dev/null

echo "▶ Reload Nginx"
sudo systemctl reload nginx

echo "▶ Cleanup old releases (keep 5)"
cd /var/www/whistle.musicsian.com/releases
ls -1t | tail -n +6 | xargs -r sudo rm -rf

echo "✓ Deployed $STAMP → whistle.musicsian.com"
echo "✓ Backend running on http://127.0.0.1:3001"
echo "✓ Frontend served by nginx with API proxy"

# Show service status
echo ""
echo "Service status:"
sudo systemctl status whistle-backend --no-pager -l