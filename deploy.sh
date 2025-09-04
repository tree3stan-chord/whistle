#!/usr/bin/env bash
# Deploy Whistle – static site pattern
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y-%m-%d-%H%M%S)
OUT=~/builds/$STAMP
mkdir -p "$OUT"

echo "▶ Stage files"
rsync -az --delete --exclude deploy.sh --exclude .git \
      "$PROJECT_DIR"/ "$OUT"/

echo "▶ Publish release"
rsync -az --delete "$OUT"/ /var/www/whistle.musicsian.com/releases/$STAMP/

echo "▶ Flip symlink"
sudo ln -nfs /var/www/whistle.musicsian.com/releases/$STAMP \
            /var/www/whistle.musicsian.com/current

echo "▶ Restore SELinux labels"
sudo restorecon -Rv /var/www/whistle.musicsian.com/releases/$STAMP >/dev/null

echo "▶ Reload Nginx"
sudo systemctl reload nginx

echo "✓ Deployed $STAMP → whistle.musicsian.com"