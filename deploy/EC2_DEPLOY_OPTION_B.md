# 🚀 AdTagTracker — EC2 Deployment Guide (Option B: Clone & Build on Server)

Deploy AdTagTracker to a fresh AWS EC2 instance by cloning the GitHub repo directly on the server and building there.

**Stack:** Amazon Linux 2023 (or Ubuntu 24.04 LTS) · Node.js 20 · PostgreSQL 16 · PM2 · Nginx

> **Amazon Linux vs Ubuntu** — either works. Amazon Linux 2023 is the AWS-native choice (faster patches, better AWS integration). Key differences are noted throughout this guide where they apply.

---

## Step 1 — Launch the EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Set these values:
   - **Name**: `adtag-tracker`
   - **AMI**: `Amazon Linux 2023 AMI` (64-bit x86) — *or* `Ubuntu Server 24.04 LTS`
   - **Instance type**: `t3.small` (1 vCPU / 2 GB RAM) — minimum; use `t3.medium` for heavy traffic
   - **Key pair**: Create a new one → download the `.pem` file → **keep it safe**
   - **Storage**: 30 GB gp3
3. Under **Network settings → Edit**, add these inbound rules to the security group:

   | Port | Protocol | Source             |
   |------|----------|--------------------|
   | 22   | SSH      | My IP (yours only) |
   | 80   | HTTP     | 0.0.0.0/0          |
   | 443  | HTTPS    | 0.0.0.0/0          |

4. Click **Launch Instance**

---

## Step 2 — Allocate an Elastic IP

Ensures your server's public IP never changes on reboot.

1. **EC2 → Elastic IPs → Allocate Elastic IP address** → Allocate
2. Select the new IP → **Actions → Associate Elastic IP**
3. Choose your `adtag-tracker` instance → Associate
4. **Copy the Elastic IP** — you'll use it throughout the rest of this guide

---

## Step 3 — Connect to the Server

Run these from your local machine:

```bash
chmod 400 /path/to/your-key.pem

# Amazon Linux 2023 — SSH user is ec2-user
ssh -i /path/to/your-key.pem ec2-user@<ELASTIC_IP>

# Ubuntu — SSH user is ubuntu
ssh -i /path/to/your-key.pem ubuntu@<ELASTIC_IP>
```

---

## Step 4 — Run the One-Time Setup Script

From your **local machine** (inside the project folder), send the setup script to the server then run it:

**Amazon Linux 2023:**
```bash
# Send the script
scp -i /path/to/your-key.pem deploy/setup-amazon-linux.sh ec2-user@<ELASTIC_IP>:~

# SSH in and run it
ssh -i /path/to/your-key.pem ec2-user@<ELASTIC_IP>
sudo bash setup-amazon-linux.sh
```

**Ubuntu:**
```bash
# Send the script
scp -i /path/to/your-key.pem deploy/setup-ubuntu.sh ubuntu@<ELASTIC_IP>:~

# SSH in and run it
ssh -i /path/to/your-key.pem ubuntu@<ELASTIC_IP>
sudo bash setup-ubuntu.sh
```

This installs **Node.js 20, PostgreSQL 16, PM2, and Nginx** (~2–3 minutes).

---

## Step 5 — Create the Database

Still on the server:

```bash
sudo -u postgres psql -c "CREATE USER adtag WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE adtag OWNER adtag;"
```

> Save that password — you'll need it in the next step.

---

## Step 6 — Clone the Repo & Configure Environment

```bash
cd ~
git clone https://github.com/Makkie255/adtagtracker.git adtag-tracker
cd adtag-tracker
cp .env.example .env
nano .env
```

Fill in `.env` with these values:

```env
NODE_ENV=production
PORT=5000

# Use the password you chose in Step 5
DATABASE_URL=postgresql://adtag:YOUR_PASSWORD@localhost:5432/adtag

# Generate with: openssl rand -hex 32
SESSION_SECRET=

# Must match SSO_SECRET_AD_TAG_TRACKER in the Internal Portal backend's env.
# Verifies the short-lived signed SSO ticket the Portal hands off on login.
SSO_SECRET_AD_TAG_TRACKER=

# Leave blank if you don't have a Brevo account yet — emails will log to console instead
BREVO_API_KEY=
BREVO_FROM=Ad Tag Tracker <noreply@yourdomain.com>

# Use http + Elastic IP for now (no domain yet).
# NOTE: SSO requires HTTPS in production — add a domain + SSL before going live (see last section).
APP_URL=http://<ELASTIC_IP>

# Optional — link back to the Internal Portal
VITE_PORTAL_URL=https://portal.rallyad.com

# Admin profile (no password) created on first boot; links to the Portal account by email on first SSO login
ADMIN_EMAIL=lucan@rallyad.com
ADMIN_NAME=Lucan Marsh
```

Generate the session secret right there on the server:

```bash
openssl rand -hex 32
# Paste the output as the value of SESSION_SECRET in .env
```

---

## Step 7 — Build & Start the App

```bash
cd ~/adtag-tracker
npm ci --legacy-peer-deps
npm run build
npm run db:push           # Creates all database tables
npm run import:trackers   # Imports ~272 ad platforms (takes ~1–2 min)
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup               # Copy & run the printed command to enable auto-start on reboot
```

Check it started cleanly:

```bash
pm2 logs adtag-tracker --lines 50
```

> **Note:** There is no admin password in the logs. Login is SSO-only — the first boot creates a passwordless admin profile that links to your Internal Portal account (matched by `ADMIN_EMAIL`) the first time you sign in through the Portal.

---

## Step 8 — Configure Nginx

**Amazon Linux 2023** (uses `/etc/nginx/conf.d/`):
```bash
sudo tee /etc/nginx/conf.d/adtag.conf << 'EOF'
server {
    listen 80;
    server_name _;
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
sudo nginx -t && sudo systemctl reload nginx
```

**Ubuntu** (uses `sites-available/sites-enabled`):
```bash
sudo tee /etc/nginx/sites-available/adtag << 'EOF'
server {
    listen 80;
    server_name _;
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

## ✅ Verify It's Live

Open your browser and go to:

```
http://<ELASTIC_IP>
```

You should see the AdTagTracker sign-in screen, which redirects to the Internal Portal. Open the tool tile from inside the RallyAd Internal Portal (signed in as `lucan@rallyad.com`) — the Portal hands off a signed SSO ticket and your session is created automatically. There is no password to enter.

> Over plain HTTP (Elastic IP only) SSO is fine for a first smoke test, but add a domain + SSL (last section) before real use — the SSO ticket is a bearer credential and must travel over HTTPS.

---

## Future Deploys

When you push new code to GitHub, update the server with:

```bash
cd ~/adtag-tracker
git pull
npm ci --legacy-peer-deps
npm run build
npm run db:push       # Only needed if the database schema changed
pm2 restart adtag-tracker
```

---

## Useful Commands

| Task                  | Command                                      |
|-----------------------|----------------------------------------------|
| View live logs        | `pm2 logs adtag-tracker`                     |
| View errors only      | `pm2 logs adtag-tracker --err`               |
| Restart app           | `pm2 restart adtag-tracker`                  |
| App status            | `pm2 status`                                 |
| Push DB schema        | `npm run db:push`                            |
| Re-import ad platforms| `npm run import:trackers`                    |
| Nginx reload          | `sudo nginx -t && sudo systemctl reload nginx`|

---

## Optional — Add a Domain & SSL Later

Once you have a domain:

1. Add an **A record** pointing `yourdomain.com` → your Elastic IP
2. Update the Nginx config — replace `server_name _;` with `server_name yourdomain.com;`
3. Install Certbot and get a free SSL certificate:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
4. Update `.env` → `APP_URL=https://yourdomain.com`
5. Restart: `pm2 restart adtag-tracker`
