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
        DATABASE_URL: 'mysql://secof_user:Snowtea2026$ecof!@127.0.0.1:3306/secof_db',
        GOOGLE_CLIENT_ID: '302803392762-gg4r8ckp7ejubbt843gmj7pnlae41idq.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: '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',
        JWT_SECRET: 'SnowteaSECOF2026SecretKeyJellyboba',
        APP_URL: 'https://secof.snowteatienda.com',
        OAUTH_SERVER_URL: 'https://secof.snowteatienda.com',
        OWNER_EMAIL: 'franquicias@snowtea.com.mx',
      },
      error_file: '/var/log/pm2/secof-error.log',
      out_file: '/var/log/pm2/secof-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
