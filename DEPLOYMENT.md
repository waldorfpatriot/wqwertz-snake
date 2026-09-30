# qwertZnake Deployment Documentation

## Overview

- **Domain**: qwertznake.de (+ www.qwertznake.de)
- **Server IP**: 82.165.153.24
- **Server OS**: Debian Linux
- **Web Server**: nginx (reverse proxy)
- **App Server**: Node.js with PM2
- **SSL**: Let's Encrypt (auto-renewal enabled)
- **Deployed**: December 31, 2025

---

## Server Setup

### Prerequisites
- nginx installed
- Node.js 18+ installed
- PM2 installed globally (`npm install -g pm2`)
- certbot with nginx plugin installed (`python3-certbot-nginx`)
- Domain DNS pointed to server IP (A records for both `qwertznake.de` and `www.qwertznake.de`)

### Directory Structure
```
/var/www/qwertznake.de/
├── index.html
├── style.css
├── game.js
├── key_sequence.txt
├── german_letter_pairs.json
├── server.js
├── learning-engine.js
├── learning-mode.js
├── learning-classroom-server.js
├── learning-classroom-client.js
├── learning-leaderboard.js
├── learning-leaderboard.css
├── assets/learning/
├── package.json
├── statistics.json
└── levels.json
```

---

## Deployment Steps

### 1. Create Web Directory
```bash
ssh root@82.165.153.24 "mkdir -p /var/www/qwertznake.de"
```

### 2. Copy All Files
```bash
./deploy.sh
```

### 3. Install Node.js (if not installed)
```bash
ssh root@82.165.153.24 "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
```

### 4. Install PM2 and Start App
```bash
ssh root@82.165.153.24 "npm install -g pm2 && cd /var/www/qwertznake.de && pm2 start server.js --name qwertznake"
```

### 5. Set Environment Variables
```bash
ssh root@82.165.153.24 "cd /var/www/qwertznake.de && ADMIN_PASSWORD='replace-with-secure-password' pm2 start ecosystem.config.js --update-env && pm2 save"
```

Or create an ecosystem file `/var/www/qwertznake.de/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'qwertznake',
    script: 'server.js',
    cwd: '/var/www/qwertznake.de',
    env: {
      PORT: 3000,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
      ALLOWED_ORIGINS: 'https://qwertznake.de,https://www.qwertznake.de'
    }
  }]
};
```

Then start with:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-start on boot
```

### 6. Create nginx Configuration
Create `/etc/nginx/sites-available/qwertznake.de`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name qwertznake.de www.qwertznake.de;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy all requests to Node.js server
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. Enable Site
```bash
ln -sf /etc/nginx/sites-available/qwertznake.de /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 8. Install SSL Certificate
```bash
certbot --nginx -d qwertznake.de -d www.qwertznake.de \
    --non-interactive --agree-tos --email admin@qwertznake.de --redirect
```

This command:
- Obtains a Let's Encrypt certificate
- Configures nginx for HTTPS
- Sets up automatic HTTP → HTTPS redirect
- Enables auto-renewal via systemd timer

---

## Security Measures

### nginx Security Headers
| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | SAMEORIGIN | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME-type sniffing |
| X-XSS-Protection | 1; mode=block | XSS filter (legacy browsers) |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer information |

### SSL/TLS
- Certificate: Let's Encrypt
- Auto-renewal: Enabled (certbot timer)
- Certificate location: `/etc/letsencrypt/live/qwertznake.de/`
- Expiry: 90 days (auto-renews before expiration)

### Application Security (Server-side)
- **Path Traversal Protection**: Sanitized file paths prevent directory traversal attacks
- **Server-side Password Verification**: Admin password stored in environment variable, verified via timing-safe comparison
- **Request Size Limits**: 1MB max body size prevents DoS attacks
- **CORS Restrictions**: Only allowed origins can access API
- **Input Validation**: All API inputs validated and sanitized
- **XSS Prevention**: HTML entities escaped in user-provided names

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `ADMIN_PASSWORD` | Yes in production | Password for level editor access. If unset in production, admin login is disabled. |
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of allowed CORS origins |

---

## Maintenance

### Check Certificate Status
```bash
certbot certificates
```

### Manual Certificate Renewal
```bash
certbot renew
```

### Reload nginx After Config Changes
```bash
nginx -t && systemctl reload nginx
```

### View nginx Logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### View Application Logs
```bash
pm2 logs qwertznake
pm2 logs qwertznake --lines 100
```

### Check Application Status
```bash
pm2 status
pm2 show qwertznake
```

### Restart Application
```bash
pm2 restart qwertznake
```

### Update Game Files
```bash
./deploy.sh
```

### Quick Deploy Script
Save as `deploy.sh` locally:
```bash
#!/bin/bash
SERVER="root@82.165.153.24"
DEST="/var/www/qwertznake.de"

echo "Deploying qwertZnake..."
scp index.html analytics.html privacy.html support.html breakout.html frogqwertz.html invaders.html mario.html pinball.html pong.html qwertzman.html qwertzoids.html tetris.html \
  style.css analytics.js arcade-shared.js game.js menu.js pong.js tetris.js \
  learning-engine.js learning-progress.js learning-hands.js learning-reward.js learning-tetris.js learning-arcade.js learning-mode.js \
  learning-classroom-client.js learning-classroom-server.js learning-leaderboard.js learning-leaderboard.css \
  key_sequence.txt german_letter_pairs.json server.js package.json ecosystem.config.js \
  $SERVER:$DEST/
scp -r ressources $SERVER:$DEST/
scp -r assets $SERVER:$DEST/
ssh $SERVER "pm2 restart qwertznake"
echo "Deployment complete!"
```

---

## URLs

- **Production**: https://qwertznake.de
- **Alternative**: https://www.qwertznake.de
- Both HTTP URLs redirect to HTTPS automatically

---

## Backup

### Backup Data Files
```bash
ssh root@82.165.153.24 "cd /var/www/qwertznake.de && tar -czvf backup-$(date +%Y%m%d).tar.gz statistics.json levels.json"
scp root@82.165.153.24:/var/www/qwertznake.de/backup-*.tar.gz ./backups/
```

### Restore Data
```bash
scp ./backups/backup-YYYYMMDD.tar.gz root@82.165.153.24:/var/www/qwertznake.de/
ssh root@82.165.153.24 "cd /var/www/qwertznake.de && tar -xzvf backup-YYYYMMDD.tar.gz && pm2 restart qwertznake"
```
