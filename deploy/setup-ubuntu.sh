#!/usr/bin/env bash
# One-time setup for Ad Tag Tracker on Ubuntu 24.04 LTS (EC2).
# Run: sudo bash setup-ubuntu.sh
# Installs: Node.js 20 LTS, PostgreSQL 16, PM2, Nginx (optional reverse proxy).

set -e

export DEBIAN_FRONTEND=noninteractive

echo "[setup] Updating apt..."
apt-get update -qq

echo "[setup] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  node: $(node -v)  npm: $(npm -v)"

echo "[setup] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "[setup] Installing PM2..."
npm install -g pm2

echo "[setup] Installing Nginx (reverse proxy)..."
apt-get install -y nginx
systemctl enable nginx
# Config and site enable are done in DEPLOYMENT.md (after app is deployed)

echo "[setup] Done. Next steps:"
echo "  1. Create DB and user: sudo -u postgres psql -c \"CREATE USER adtag WITH PASSWORD 'xxx';\""
echo "  2. sudo -u postgres psql -c \"CREATE DATABASE adtag OWNER adtag;\""
echo "  3. Deploy app and set .env DATABASE_URL=postgresql://adtag:xxx@localhost:5432/adtag"
echo "  4. Run: npm run db:push  then  pm2 start deploy/ecosystem.config.cjs"
