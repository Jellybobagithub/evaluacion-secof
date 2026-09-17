module.exports = {
  apps: [
    {
      name: 'secof',
      script: './dist/index.js',
      cwd: '/var/www/secof',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'mysql://user:password@127.0.0.1:3306/secof_db',
        GOOGLE_CLIENT_ID: '<google-oauth-client-id>',
        GOOGLE_CLIENT_SECRET: '<google-oauth-client-secret>',
        JWT_SECRET: '<random-secret>',
        APP_URL: 'https://secof.snowteatienda.com',
        OAUTH_SERVER_URL: 'https://secof.snowteatienda.com',
        OWNER_EMAIL: 'owner@example.com',
      },
      error_file: '/var/log/pm2/secof-error.log',
      out_file: '/var/log/pm2/secof-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
