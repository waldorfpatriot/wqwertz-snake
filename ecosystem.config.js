module.exports = {
  apps: [{
    name: 'qwertznake',
    script: 'server.js',
    cwd: '/var/www/qwertznake.de',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // IMPORTANT: Change this password before deploying!
      ADMIN_PASSWORD: 'Neue Level brauche ich',
      ALLOWED_ORIGINS: 'https://qwertznake.de,https://www.qwertznake.de'
    }
  }]
};

