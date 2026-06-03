module.exports = {
  apps: [
    {
      name: process.env.VPS_PM2_PROCESS_NAME || "api-emails",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
