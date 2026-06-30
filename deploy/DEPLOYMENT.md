# Ad Tag Tracker — AWS EC2 Deployment (Ubuntu 24.04 LTS)

Self-hosted deployment on **AWS EC2** with **Elastic IP**, **Ubuntu 24.04 LTS**, **PostgreSQL on the same instance**, **PM2** for process management, **Nginx** as reverse proxy, and **Resend** for transactional email.

---

## 1. AWS setup

### 1.1 Launch the EC2 instance
- **AMI**: Ubuntu Server 24.04 LTS
- **Instance type**: `t3.small` (1 vCPU / 2 GB RAM) is enough for hundreds of sites. Go `t3.medium` for thousands.
- **Storage**: 30 GB gp3
- **Security group**: Allow inbound
  - **22** (SSH) from your IP
  - **80** (HTTP) and **443** (HTTPS) from `0.0.0.0/0`
- **Elastic IP**: Allocate and **Associate** it so the public IP doesn't change.

### 1.2 Connect
```bash
ssh -i /path/to/your-key.pem ubuntu@<ELASTIC_IP>
```

---

## 2. One-time server setup
Run the bundled script. It installs Node.js 20, PostgreSQL 16, PM2, and Nginx:
```bash
scp -i /path/to/your-key.pem deploy/setup-ubuntu.sh ubuntu@<ELASTIC_IP>:~
ssh -i /path/to/your-key.pem ubuntu@<ELASTIC_IP> 'chmod +x setup-ubuntu.sh && ./setup-ubuntu.sh'
```

---

## 3. PostgreSQL
```bash
sudo -u postgres psql -c "CREATE USER adtag WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE adtag OWNER adtag;"
```

---

## 4. Resend (transactional email)
The app uses [Resend](https://resend.com) to send invitations, password resets, change alerts, and monthly reports.

1. Create a Resend account.
2. Add and verify your sending domain (e.g. `mail.yourdomain.com`) — Resend will give you DNS records to add.
3. Generate an API key (`re_xxxxxxxxxxxxxxxx`).
4. Set it as `RESEND_API_KEY` in `.env` (Section 6).

> Without `RESEND_API_KEY`, the app still runs — but emails will only log to the console instead of being sent. Useful for dev, never for prod.

---

## 5. Deploy the application

### Option A — build on your machine, ship the bundle
```bash
# Locally, from the repo root
npm ci --legacy-peer-deps
npm run build

rsync -avz --exclude node_modules --exclude .git -e "ssh -i /path/to/your-key.pem" \
  dist package.json package-lock.json deploy server shared drizzle.config.ts .env.example \
  ubuntu@<ELASTIC_IP>:~/adtag-tracker/
```
On the server:
```bash
cd ~/adtag-tracker
cp .env.example .env
nano .env   # see Section 6
npm install --omit=dev --legacy-peer-deps
npm run db:push                  # creates all tables
npm run import:trackers          # imports DuckDuckGo Tracker Radar catalog (~272 platforms)
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup           # follow printed command to enable on boot
```

### Option B — clone and build on the server
```bash
git clone https://github.com/Makkie255/adtagtracker.git adtag-tracker
cd adtag-tracker
cp .env.example .env
nano .env
npm ci --legacy-peer-deps
npm run build
npm run db:push
npm run import:trackers
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup
```

The first boot will create the admin user from `ADMIN_EMAIL` and **print a one-time password to the PM2 log** — save it:
```bash
pm2 logs adtag-tracker --lines 50
```

---

## 6. Environment variables

`.env` (in the app directory):

```env
# --- Server ---
NODE_ENV=production
PORT=5000

# --- Database ---
DATABASE_URL=postgresql://adtag:YOUR_PASSWORD@localhost:5432/adtag

# --- Sessions (required in production) ---
# Generate: openssl rand -hex 32
SESSION_SECRET=your-64-char-hex-secret

# --- Resend (transactional email) ---
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
# "From" header; must use a domain you've verified in Resend
RESEND_FROM=Ad Tag Tracker <noreply@mail.yourdomain.com>

# --- Public-facing URL (used in email links) ---
APP_URL=https://your-domain.com

# --- Admin bootstrap (used only on first boot to create the admin) ---
ADMIN_EMAIL=Lucan@rallyad.com
ADMIN_NAME=Lucan Marsh
```

In production, the app will **exit on boot** if `DATABASE_URL`, `SESSION_SECRET`, or `APP_URL` are missing.

---

## 7. Nginx reverse proxy
Replace `YOUR_DOMAIN` with your actual domain:
```bash
sudo tee /etc/nginx/sites-available/adtag << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN;
    client_max_body_size 5m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/adtag /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. SSL with Let's Encrypt
Point an A record from `your-domain.com` → Elastic IP, then:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
Certbot will edit the Nginx config to add the SSL block and set up auto-renewal.

After SSL is set up, change `APP_URL` in `.env` to `https://your-domain.com` and `pm2 restart adtag-tracker`.

---

## 9. Updating the app

```bash
cd ~/adtag-tracker
git pull
npm ci --legacy-peer-deps
npm run build
npm run db:push                  # only if schema changed
pm2 restart adtag-tracker
```

To pull fresh DuckDuckGo Tracker Radar data later:
```bash
npm run import:trackers   # safe to re-run; skips existing
```

---

## 10. Useful commands

| Task                       | Command                                                |
|----------------------------|--------------------------------------------------------|
| View logs                  | `pm2 logs adtag-tracker`                              |
| Tail just errors           | `pm2 logs adtag-tracker --err`                        |
| Restart app                | `pm2 restart adtag-tracker`                           |
| Status                     | `pm2 status`                                          |
| DB schema update           | `npm run db:push`                                     |
| Re-import tag platforms    | `npm run import:trackers`                             |
| Reset admin password       | `psql -U adtag -d adtag -c "DELETE FROM users WHERE email='lucan@rallyad.com';"` then restart |
| Nginx reload               | `sudo nginx -t && sudo systemctl reload nginx`        |
| Renew SSL                  | `sudo certbot renew` (cron handles auto-renewal)      |

---

## 11. What runs in the background

The app boots a single Node process that:
- Serves the API and the static React bundle on `PORT`
- Runs the scheduler:
  - **Every 10 min** — scans any active site whose interval has elapsed (hourly / daily / weekly)
  - **1st of the month at 09:00** — emails monthly reports to users who opted in
  - **Daily at 03:00** — purges tag changes older than 60 days and expired invites/resets
- Resets any in-flight scans on boot (so server restarts don't leave stuck "running" scans)

No background workers, queues, or third-party services are required beyond Resend.

---

## 12. Security posture

The deployed app already includes:
- **Helmet** security headers (CSP, X-Frame-Options, HSTS via Nginx)
- **Rate limiting** on `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/auth/accept-invite`
- **bcrypt-hashed passwords** (cost factor 12)
- **PostgreSQL-backed sessions** (cookies httpOnly, sameSite=lax, secure in prod)
- **Session secret** required in production
- **Owner-or-admin** access control on site endpoints

Recommended additional hardening:
- Keep Ubuntu and Node.js updated: `sudo apt update && sudo apt upgrade`
- Restrict SSH to your IP in the EC2 security group
- Enable AWS CloudWatch + log forwarding if you need centralized logging
- Take regular `pg_dump` backups to S3
