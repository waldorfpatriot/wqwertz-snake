#!/bin/bash
# qwertZnake Deployment Script

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVER="root@82.165.153.24"
DEST="/var/www/qwertznake.de"

echo "🐍 Deploying qwertZnake to $SERVER..."

# Copy all necessary files (do NOT copy statistics.json – preserves server Bestenliste)
echo "📦 Copying files..."
scp \
  index.html analytics.html breakout.html frogqwertz.html invaders.html mario.html pinball.html pong.html qwertzman.html qwertzoids.html tetris.html \
  style.css analytics.js arcade-shared.js game.js menu.js pong.js tetris.js \
  key_sequence.txt server.js package.json levels.json ecosystem.config.js \
  $SERVER:$DEST/
scp -r ressources $SERVER:$DEST/

# Restart the application on the server
echo "🔄 Restarting application on server..."
ssh $SERVER "cd $DEST && pm2 restart ecosystem.config.js --update-env"

echo "✅ Deployment complete!"
echo "🌐 Visit: https://qwertznake.de"
