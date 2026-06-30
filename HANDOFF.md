# Session Handoff — Ad Tag Tracker

> **Date:** 2026-05-25  
> **Handed off to:** Next agent  
> **Project reference:** See `PROJECT_NOTES.md` for full technical documentation

---

## What We Did This Session

### 1. Project Move
The user moved the project from its original Replit location to a new local folder at:
```
/Users/lucanmarsh/Documents/Ad Tag Tracker/
```
The local folder was **not** a git repository when the session started. We initialized git during the session:
```bash
git init
git remote add origin https://github.com/Makkie255/adtagtracker.git
git fetch origin
git update-ref refs/heads/main refs/remotes/origin/main
git symbolic-ref HEAD refs/heads/main
```

---

### 2. GitHub Repo
- **URL:** https://github.com/Makkie255/adtagtracker
- **Lucan is a contributor**, not the owner
- Local git is now set up and pushing works via HTTPS (macOS Keychain handles auth)

---

### 3. EC2 Deployment — Completed

We deployed the app from scratch to AWS EC2. Full deployment steps are in `PROJECT_NOTES.md` and `deploy/EC2_DEPLOY_OPTION_B.md`. Summary of what was done:

| Step | Status |
|------|--------|
| Launched EC2 instance (Amazon Linux 2023, t3.small, 30 GB gp3) | ✅ Done |
| Added security group rules (SSH, HTTP 80, HTTPS 443) | ✅ Done |
| SSH'd in with `.pem` key | ✅ Done |
| Installed Node.js 20, PostgreSQL 15, PM2, Nginx, Git via `dnf` | ✅ Done |
| Fixed PostgreSQL auth (`ident` → `md5` in `pg_hba.conf`) | ✅ Done |
| Created DB user `adtag` and database `adtag` | ✅ Done |
| Cloned repo, created `.env`, ran `npm ci` + `npm run build` | ✅ Done |
| Ran `npm run db:push` (created all tables) | ✅ Done |
| Ran `npm run import:trackers` (imported 272 ad platforms) | ✅ Done |
| Started app with PM2, configured auto-start on reboot | ✅ Done |
| Configured Nginx reverse proxy | ✅ Done |
| App is live at `http://99.79.48.136` | ✅ Done |

**SSH command to get back on the server:**
```bash
ssh -i "/Users/lucanmarsh/Documents/Ad Tag Tracker_Pairkey/Ad_Tag_Tracker_Pairkey.pem" ec2-user@99.79.48.136
```

**Note on PGDG / PostgreSQL:** The PGDG RHEL 9 repo RPM does not work on Amazon Linux 2023 (missing `/etc/redhat-release`). We installed **PostgreSQL 15** from AL2023's native repos instead of PostgreSQL 16. Works perfectly for the app.

---

### 4. Bugs Fixed During Deployment

#### Bug 1 — PostgreSQL `ident` Auth
**Symptom:** `npm run db:push` and `npm run import:trackers` both failed with `Ident authentication failed for user "adtag"`.  
**Cause:** Amazon Linux 2023 defaults PostgreSQL to `ident` auth, which matches OS username to DB username. The app connects as DB user `adtag` but the OS user is `ec2-user`.  
**Fix:** Edited `/var/lib/pgsql/data/pg_hba.conf`, changed `ident` → `md5` for IPv4 (`127.0.0.1/32`) and IPv6 (`::1/128`) host lines. Restarted PostgreSQL.

---

#### Bug 2 — White Screen (Helmet CSP `upgrade-insecure-requests`)
**Symptom:** App served HTML fine but browser showed a white screen. Console showed assets being "upgraded" from HTTP to HTTPS and then failing CORS.  
**Cause:** `server/index.ts` used `useDefaults: true` in Helmet's CSP config. Helmet's defaults include `upgrade-insecure-requests`, which tells the browser to load all sub-resources over HTTPS. Since the server is HTTP-only, all JS/CSS loads failed.  
**Fix:** Changed `useDefaults: false` and explicitly listed all directives. Added conditional: `upgrade-insecure-requests` is only included when `APP_URL` starts with `https://`.  
**Also fixed:** Added `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` (Google Fonts was also CSP-blocked).  
**File:** `server/index.ts`  
**Commit:** `26274a7`

---

#### Bug 3 — Login Works But Session Immediately Lost
**Symptom:** After logging in, the dashboard briefly flashed then immediately redirected back to `/login`. Any API call after login returned 401.  
**Cause:** `server/auth.ts` set `cookie: { secure: process.env.NODE_ENV === "production" }`. With `NODE_ENV=production`, this marks the session cookie as `secure`. Browsers only send `secure` cookies over HTTPS — so the cookie was set on login but never sent on subsequent requests, making every request appear unauthenticated.  
**Fix:** Changed to `secure: process.env.APP_URL?.startsWith("https://") ?? false` so the `secure` flag only activates when the app is actually serving HTTPS.  
**File:** `server/auth.ts`  
**Commit:** `f1fe851`

---

#### Bug 4 — Login Modal Stays Open After Login (ACTIVE BUG — NOT FULLY RESOLVED)
**Symptom:** After signing in, the sidebar renders correctly (shows "Lucan Marsh / Admin" and real data like "Sites: 1"), but the login form remains overlaid in the main content area. The URL appears to stay at `/login` even after a successful login. Clicking any nav item brings the user back to the login form.

**Root cause analysis:**
The app's routing in `App.tsx` has two render modes:
- **Logged out:** `<Router />` renders alone (no sidebar)
- **Logged in:** `<Router />` renders inside a `<SidebarProvider>` + sidebar layout

The `/login` route was:
```jsx
<Route path="/login" component={Login} />
```
There was **no guard** on this route — it always renders `<Login />` regardless of auth state. So when `isLoggedIn` became `true` after login, if the URL stayed at `/login` for any reason (race condition, navigate() timing, etc.), the login form would continue rendering inside the now-visible sidebar layout.

Additionally, `queryClient.ts` contains a global 401 handler:
```javascript
function handleUnauthorized(): boolean {
  window.location.href = "/login";  // hard redirect
  return true;
}
```
Any API call returning 401 does a full page reload to `/login`, resetting all React state.

**Fix applied:**
Changed the `/login` route in `App.tsx` to redirect authenticated users away:
```jsx
<Route path="/login">
  {() => (isLoggedIn ? <Redirect to="/" /> : <Login />)}
</Route>
```
**File:** `client/src/App.tsx`  
**Commit:** `926fc52`

**Current status:** This fix was pushed and the user was told to `git pull && npm run build && pm2 restart adtag-tracker` on the server. The session ended before we could confirm whether this fully resolved the issue. **The next agent should verify this fix worked by checking if the user can now log in and reach the dashboard without the login modal staying open.**

If the bug persists after the fix, further investigation should look at:
1. Whether `navigate("/")` from `login.tsx` is actually changing the URL (could be a wouter issue in the context of the component unmounting when `isLoggedIn` flips)
2. Whether any API call immediately after login is returning 401 (check Network tab in browser DevTools)
3. PM2 logs to confirm the correct build is running: `pm2 logs adtag-tracker --lines 30 --nostream`
4. Run `git log --oneline -3` on the server to confirm commit `926fc52` is deployed

---

### 5. Files Created/Modified This Session

#### New Files Created
| File | Description |
|------|-------------|
| `deploy/setup-amazon-linux.sh` | One-time setup script for Amazon Linux 2023 (mirrors `setup-ubuntu.sh` but uses `dnf`) |
| `deploy/EC2_DEPLOY_OPTION_B.md` | Step-by-step EC2 deployment guide (updated with real repo URL and AL2023 differences) |
| `PROJECT_NOTES.md` | Comprehensive project reference — tech stack, schema, API, server specs, everything |
| `HANDOFF.md` | This file |

#### Files Modified
| File | What Changed |
|------|-------------|
| `server/index.ts` | Fixed Helmet CSP — `useDefaults: false`, added Google Fonts, conditional `upgrade-insecure-requests` |
| `server/auth.ts` | Fixed session cookie `secure` flag — tied to `APP_URL` instead of `NODE_ENV` |
| `client/src/App.tsx` | Fixed `/login` route — redirects to `/` when `isLoggedIn` is true |
| `deploy/DEPLOYMENT.md` | Updated `git clone` URL to real repo, added Amazon Linux notes |
| `deploy/EC2_DEPLOY_OPTION_B.md` | Updated `git clone` URL, added Amazon Linux vs Ubuntu differences throughout |

---

### 6. Git Commits This Session (in order)

```
ce0a96a  Add PROJECT_NOTES.md — comprehensive project reference document
926fc52  Fix: redirect /login to / when already authenticated
f1fe851  Fix session cookie: only set secure flag when APP_URL is https://
26274a7  Fix CSP: use useDefaults:false to fully control upgrade-insecure-requests
d9a6644  Fix CSP: disable upgrade-insecure-requests on HTTP, add Google Fonts sources
```

---

## Current State of the App

| Item | Status |
|------|--------|
| Server running | ✅ PM2 online |
| Nginx routing | ✅ Port 80 → 5000 |
| Database connected | ✅ PostgreSQL 15 |
| 272 tag platforms imported | ✅ |
| Admin account created | ✅ lucan@rallyad.com |
| App accessible at | `http://99.79.48.136` |
| Login page loads | ✅ |
| Session persistence | ✅ Fixed (Bug 3) |
| Login modal dismiss after login | ⚠️ Fix deployed, not yet confirmed |
| Elastic IP | ❌ Not set up — IP will change if instance stops |
| SSL / HTTPS | ❌ Not configured |
| Domain name | ❌ Not configured |
| Resend (email) | ❌ No API key — emails log to console only |

---

## What Needs to Happen Next

### Immediate (Confirm Bug 4 Fix)
1. Have the user `git pull && npm run build && pm2 restart adtag-tracker` on the server if not already done
2. Test login at `http://99.79.48.136` in a fresh incognito window
3. Confirm the login modal dismisses and the dashboard loads after signing in

### Short Term
1. **Allocate Elastic IP** so the server IP doesn't change (AWS Console → EC2 → Elastic IPs → Allocate → Associate with `adtag-tracker` instance)
2. **Register a domain** and point it at the Elastic IP (A record)
3. **Set up SSL** with Certbot once the domain is live:
   ```bash
   sudo dnf install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
4. **Update `.env`** — change `APP_URL=https://yourdomain.com` and `pm2 restart adtag-tracker`
5. **Set up Resend** — create account, verify domain, add `RESEND_API_KEY` to `.env`

### Medium Term
- Set up automated `pg_dump` backups to S3
- Enable CloudWatch logging

---

## Key Context for Next Agent

- **The app works** — it's deployed and the backend/database are healthy (the sidebar loads real data). The remaining issue is purely a frontend routing bug on the login page.
- **All code changes should be committed and pushed** to GitHub, then pulled on the server with `git pull && npm run build && pm2 restart adtag-tracker`.
- **`APP_URL` in `.env` is critical** — it controls both the session cookie `secure` flag AND the CSP `upgrade-insecure-requests` directive. Don't set it to `https://` until SSL is actually configured.
- **PostgreSQL 15 not 16** — the server runs PostgreSQL 15 from AL2023 native repos. The service name is `postgresql` (not `postgresql-16`).
- **No Elastic IP yet** — the server's current IP (`99.79.48.136`) could change if the EC2 instance is ever stopped and started. Allocating an Elastic IP is the first priority before sharing the URL with anyone.
- **Local git was just initialized this session** — the local folder at `/Users/lucanmarsh/Documents/Ad Tag Tracker/` is now a git repo pointing to `origin/main` on GitHub.
