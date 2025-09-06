#!/usr/bin/env bash
# Deploy Whistle – static frontend vocal transcription app
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y-%m-%d-%H%M%S)

echo "🚀 Deploying Whistle Static App $STAMP..."

# Build frontend (Svelte)
echo "📦 Building Svelte frontend..."
cd "$PROJECT_DIR"
npm ci
npm run build

# Deploy static files directly to web root
echo "📂 Deploying static files..."
sudo rsync -az --delete "$PROJECT_DIR/build/" /var/www/whistle.musicsian.com/html/ 2>/dev/null

# Set proper permissions for static files
sudo chown -R nginx:nginx /var/www/whistle.musicsian.com/html/ 2>/dev/null
sudo chmod -R 755 /var/www/whistle.musicsian.com/html/ 2>/dev/null

# Stop any old backend service if it exists
sudo systemctl stop whistle-backend 2>/dev/null || true
sudo systemctl disable whistle-backend 2>/dev/null || true

# Reload nginx to serve static files
sudo systemctl reload nginx 2>/dev/null

# Set SELinux context if available
sudo restorecon -Rv /var/www/whistle.musicsian.com/html >/dev/null 2>&1 || true

# Basic health check
sleep 2
if curl -f https://whistle.musicsian.com >/dev/null 2>&1; then
    echo "✅ Successfully deployed static app to whistle.musicsian.com"
    echo "🔗 https://whistle.musicsian.com"
else
    echo "⚠️  Deployment completed but health check failed"
    echo "🔗 https://whistle.musicsian.com"
fi