#!/bin/bash
# qwertZnake Deployment Script

SERVER="root@82.165.153.24"
DEST="/var/www/qwertznake.de"

echo "🐍 Deploying qwertZnake to $SERVER..."

# Copy all necessary files
echo "📦 Copying files..."
scp index.html style.css game.js menu.js tetris.html tetris.js key_sequence.txt server.js package.json levels.json ecosystem.config.js $SERVER:$DEST/

# Restart the application
echo "🔄 Restarting application..."
ssh $SERVER "cd $DEST && pm2 restart ecosystem.config.js --update-env"

echo "✅ Deployment complete!"
echo "🌐 Visit: https://qwertznake.de"


