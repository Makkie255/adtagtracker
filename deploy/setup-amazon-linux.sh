#!/usr/bin/env bash
# One-time setup for Ad Tag Tracker on Amazon Linux 2023 (EC2).
# Run: sudo bash setup-amazon-linux.sh
# Installs: Node.js 20 LTS, PostgreSQL 16, PM2, Nginx.

set -e

echo "[setup] Updating dnf..."
dnf update -y -q

echo "[setup] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
fi
echo "  node: $(node -v)  npm: $(npm -v)"

echo "[setup] Installing PostgreSQL 16..."
dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
dnf -qy module disable postgresql 2>/dev/null || true
dnf install -y postgresql16-server postgresql16-contrib
/usr/pgsql-16/bin/postgresql-16-setup initdb
systemctl enable postgresql-16
systemctl start postgresql-16

echo "[setup] Installing PM2..."
npm install -g pm2

echo "[setup] Installing Nginx..."
dnf install -y nginx
systemctl enable nginx
# Config is done via /etc/nginx/conf.d/ on Amazon Linux (see DEPLOYMENT.md)

echo "[setup] Done. Next steps:"
echo "  1. Create DB user: sudo -u postgres psql -c \"CREATE USER adtag WITH PASSWORD 'xxx';\""
echo "  2. Create DB:      sudo -u postgres psql -c \"CREATE DATABASE adtag OWNER adtag;\""
echo "  3. Deploy app and set .env DATABASE_URL=postgresql://adtag:xxx@localhost:5432/adtag"
echo "  4. Run: npm run db:push  then  pm2 start deploy/ecosystem.config.cjs"
