/**
 * PM2 ecosystem file for Ad Tag Tracker (production on EC2).
 * Run from project root: pm2 start deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "adtag-tracker",
      script: "dist/index.js",
      cwd: process.env.PWD || require("path").resolve(__dirname, ".."),
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env",
      error_file: "~/.pm2/logs/adtag-tracker-error.log",
      out_file: "~/.pm2/logs/adtag-tracker-out.log",
      merge_logs: true,
      max_memory_restart: "500M",
    },
  ],
};
