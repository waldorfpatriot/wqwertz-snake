#!/bin/bash
# Script to update statistics.json on the server
# Changes "Anonym" entry with 21 points, Level 2 to "Pema"

SERVER="root@82.165.153.24"
DEST="/var/www/qwertznake.de"

echo "📥 Downloading statistics.json from server..."
scp $SERVER:$DEST/statistics.json /tmp/statistics_backup.json

echo "✏️  Updating entry..."
# Use sed to replace "Anonym" with "Pema" for the entry with 21 points and level 2
# This is a simple approach - for more complex changes, we'd need to parse JSON properly
python3 << 'EOF'
import json
import sys

# Read the file
with open('/tmp/statistics_backup.json', 'r') as f:
    data = json.load(f)

# Find and update the entry
for game in data.get('games', []):
    if game.get('name') == 'Anonym' and game.get('points') == 21 and game.get('level') == 2:
        game['name'] = 'Pema'
        print(f"✅ Updated entry: {game.get('id')} - Changed 'Anonym' to 'Pema'")
        break
else:
    print("⚠️  Entry not found. Looking for entry with name='Anonym', points=21, level=2")
    # List all entries for debugging
    print("\nCurrent entries:")
    for i, game in enumerate(data.get('games', []), 1):
        print(f"  {i}. {game.get('name')} - {game.get('points')} points - Level {game.get('level', 0)}")

# Write back
with open('/tmp/statistics_backup.json', 'w') as f:
    json.dump(data, f, indent=2)

EOF

echo "📤 Uploading updated statistics.json to server..."
scp /tmp/statistics_backup.json $SERVER:$DEST/statistics.json

echo "🔄 Restarting application..."
ssh $SERVER "cd $DEST && pm2 restart qwertznake"

echo "✅ Update complete!"
