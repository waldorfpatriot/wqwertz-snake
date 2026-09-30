#!/bin/bash
# qwertZnake Deployment Script

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVER="root@82.165.153.24"
DEST="/var/www/qwertznake.de"

echo "🐍 Deploying qwertZnake to $SERVER..."

# Copy all necessary files (do NOT copy statistics.json or levels.json – preserves live data)
echo "📦 Copying files..."
scp -r ressources assets $SERVER:$DEST/
scp \
  learning-engine.js learning-progress.js learning-hands.js learning-reward.js learning-tetris.js learning-arcade.js learning-mode.js \
  learning-classroom-client.js learning-classroom-server.js learning-leaderboard.js learning-leaderboard.css \
  $SERVER:$DEST/
scp \
  analytics.html privacy.html support.html breakout.html frogqwertz.html invaders.html mario.html pinball.html pong.html qwertzman.html qwertzoids.html tetris.html \
  style.css analytics.js arcade-shared.js game.js menu.js pong.js tetris.js \
  key_sequence.txt german_letter_pairs.json server.js package.json ecosystem.config.js \
  $SERVER:$DEST/
# Publish the entry page after its scripts and images are in place.
scp index.html $SERVER:$DEST/

# Restart the application on the server
echo "🔄 Restarting application on server..."
ssh $SERVER "cd $DEST && pm2 restart qwertznake || pm2 start ecosystem.config.js"

echo "✅ Deployment complete!"
echo "🌐 Visit: https://qwertznake.de"
