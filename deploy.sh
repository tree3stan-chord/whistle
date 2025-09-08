#!/usr/bin/env bash
# Deploy Cadenza – static frontend vocal transcription app
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y-%m-%d-%H%M%S)

echo "🚀 Deploying Cadenza Static App $STAMP..."

# Build frontend (Svelte)
echo "📦 Building Cadenza Svelte frontend..."
cd "$PROJECT_DIR"
npm ci
npm run build

# Deploy static files directly to web root
echo "📂 Deploying static files..."
sudo rsync -az --delete "$PROJECT_DIR/build/" /var/www/cadenza.musicsian.com/html/ 2>/dev/null

# Set proper permissions for static files
sudo chown -R nginx:nginx /var/www/cadenza.musicsian.com/html/ 2>/dev/null
sudo chmod -R 755 /var/www/cadenza.musicsian.com/html/ 2>/dev/null

# Stop any old backend service if it exists
sudo systemctl stop cadenza-backend 2>/dev/null || true
sudo systemctl disable cadenza-backend 2>/dev/null || true

# Reload nginx to serve static files
sudo systemctl reload nginx 2>/dev/null

# Set SELinux context if available
sudo restorecon -Rv /var/www/cadenza.musicsian.com/html >/dev/null 2>&1 || true

# Basic health check
sleep 2
if curl -f https://cadenza.musicsian.com >/dev/null 2>&1; then
    echo "✅ Successfully deployed static app to cadenza.musicsian.com"
    echo "🔗 https://cadenza.musicsian.com"
else
    echo "⚠️  Deployment completed but health check failed"
    echo "🔗 https://cadenza.musicsian.com"
fi