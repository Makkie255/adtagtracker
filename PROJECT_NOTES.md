# Ad Tag Tracker — Complete Project Reference

> **Last updated:** 2026-05-25  
> **Author:** Lucan Marsh — lucan@rallyad.com  
> **GitHub:** https://github.com/Makkie255/adtagtracker (Lucan is a contributor, not the owner)  
> **Live URL:** http://99.79.48.136 (HTTP only — SSL/domain not yet configured)

---

## Table of Contents

1. [What the App Does](#1-what-the-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Background Jobs & Scheduler](#6-background-jobs--scheduler)
7. [Authentication & Security](#7-authentication--security)
8. [Email System](#8-email-system)
9. [Tag Detection Engine](#9-tag-detection-engine)
10. [Frontend Architecture](#10-frontend-architecture)
11. [EC2 Server Specs](#11-ec2-server-specs)
12. [Server Software](#12-server-software)
13. [Deployment Process](#13-deployment-process)
14. [Environment Variables](#14-environment-variables)
15. [Useful Server Commands](#15-useful-server-commands)
16. [Known Issues & Fixes Applied](#16-known-issues--fixes-applied)
17. [Future Work](#17-future-work)

---

## 1. What the App Does

**Ad Tag Tracker** is a self-hosted web application built for RallyAd that monitors advertising and marketing tags (trackers) across client websites. It detects when ad tags appear, disappear, or change — and alerts the right people.

### Core Problem It Solves
Ad agencies and marketing teams need to know which ad platforms (Google Ads, Meta Pixel, TikTok, etc.) are running on client websites at any given time. Tags get added, removed, or misconfigured without notice. This app automates that monitoring.

### What It Does
- **Monitors** any number of websites for ad/marketing tags on a configurable schedule (hourly / daily / weekly)
- **Detects changes** — compares each scan against the previous one and records what was added, removed, or modified
- **Alerts** designated email addresses when changes are detected
- **Reports** — sends monthly summary reports to opted-in users
- **Multi-user** — team members can be invited, each managing their own set of sites
- **Admin panel** — admins see all sites across all users, manage the tag platform catalog, and manage users
- **272 ad platforms** pre-loaded from DuckDuckGo Tracker Radar (Google, Meta, TikTok, The Trade Desk, Amazon, etc.)

### User Roles
| Role | Can Do |
|------|--------|
| **admin** | Everything — all sites, all users, tag platform catalog, invite users |
| **user** | Their own sites only — add/edit/archive sites, view scans and tag changes |

---

## 2. Tech Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 20.20.2 (LTS) |
| Framework | Express.js | ^4.21.2 |
| Language | TypeScript | 5.6.3 |
| ORM | Drizzle ORM | ^0.39.1 |
| DB Driver | pg (node-postgres) | ^8.13.1 |
| Auth | Passport.js (local strategy) | ^0.7.0 |
| Sessions | express-session + connect-pg-simple | ^1.18.1 / ^10.0.0 |
| Password hashing | bcryptjs | ^3.0.3 (cost factor 12) |
| Email | Resend | ^6.12.3 |
| HTML parsing | Cheerio | ^1.2.0 |
| Scheduling | node-cron | ^4.2.1 |
| Security | Helmet | ^8.2.0 |
| Rate limiting | express-rate-limit | ^8.5.2 |
| Validation | Zod | ^3.24.2 |
| Build tool | esbuild | ^0.25.0 |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | ^18.3.1 |
| Build tool | Vite | ^7.3.1 |
| Routing | Wouter | ^3.3.5 |
| Data fetching | TanStack React Query | ^5.60.5 |
| UI components | Radix UI (full suite) | various |
| Styling | Tailwind CSS | ^3.4.17 |
| Charts | Recharts | ^2.15.2 |
| Animations | Framer Motion | ^11.13.1 |
| Forms | React Hook Form + Zod | ^7.55.0 / ^3.24.2 |
| Icons | Lucide React | ^0.453.0 |
| Theming | next-themes (dark/light) | ^0.4.6 |
| Fonts | Google Fonts (loaded via CDN) | — |

### Database
| Component | Technology |
|-----------|-----------|
| Engine | PostgreSQL 15 |
| Host | Same EC2 instance (localhost) |
| Schema management | Drizzle Kit (`npm run db:push`) |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Cloud | AWS EC2 |
| OS | Amazon Linux 2023 |
| Process manager | PM2 7.0.1 |
| Reverse proxy | Nginx |
| Deployment method | Git clone + build on server |

---

## 3. Project Structure

```
adtag-tracker/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx             # Root component, routing, auth guard
│   │   ├── main.tsx            # React entry point
│   │   ├── index.css           # Global styles / Tailwind
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # Auth state — fetchMe, login, logout
│   │   ├── hooks/
│   │   │   ├── use-inactivity-timeout.ts  # 15-min idle logout
│   │   │   └── use-mobile.tsx
│   │   ├── lib/
│   │   │   ├── queryClient.ts  # TanStack Query client + apiRequest helper
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── login.tsx       # Sign-in page
│   │   │   ├── dashboard.tsx   # Home dashboard
│   │   │   ├── sites.tsx       # Sites list
│   │   │   ├── site-detail.tsx # Single site — scans, tags, changes
│   │   │   ├── create-site.tsx # Add new site
│   │   │   ├── reports.tsx     # Reports page
│   │   │   ├── archived.tsx    # Archived sites
│   │   │   ├── settings.tsx    # User settings
│   │   │   ├── profile.tsx     # User profile
│   │   │   ├── admin-panel.tsx # Admin — users, platforms, invitations
│   │   │   ├── accept-invite.tsx   # New user signup via invitation link
│   │   │   ├── forgot-password.tsx
│   │   │   ├── reset-password.tsx
│   │   │   └── not-found.tsx
│   │   └── components/
│   │       ├── app-sidebar.tsx      # Main navigation sidebar
│   │       ├── charts-section.tsx
│   │       ├── tag-change-feed.tsx
│   │       ├── tag-tracking-config.tsx
│   │       ├── scan-history.tsx
│   │       ├── site-analytics.tsx
│   │       ├── sites-table.tsx
│   │       ├── stats-card.tsx
│   │       ├── status-badge.tsx
│   │       ├── theme-toggle.tsx
│   │       ├── delete-site-dialog.tsx
│   │       ├── empty-state.tsx
│   │       └── ui/             # Radix UI component wrappers (shadcn)
│   ├── index.html
│   └── public/
│       └── favicon.png
│
├── server/                     # Express backend
│   ├── index.ts                # App entry — Helmet, sessions, routes, server
│   ├── routes.ts               # All API route handlers
│   ├── auth.ts                 # Passport setup, session config, middleware
│   ├── db.ts                   # Drizzle + pg pool connection
│   ├── scanner.ts              # Core tag detection logic (Cheerio-based)
│   ├── scheduler.ts            # Cron jobs — scan ticker, monthly reports, cleanup
│   ├── email.ts                # Resend email templates
│   ├── seed.ts                 # Admin user bootstrap on first boot
│   ├── import-tracker-radar.ts # One-time import of 272 ad platforms from DuckDuckGo
│   └── vite.ts                 # Vite dev server middleware (dev only)
│
├── shared/
│   └── schema.ts               # Drizzle table definitions + Zod schemas (shared by client & server)
│
├── deploy/
│   ├── DEPLOYMENT.md           # Full deployment reference (both options)
│   ├── EC2_DEPLOY_OPTION_B.md  # Step-by-step EC2 guide (the one we followed)
│   ├── setup-ubuntu.sh         # One-time setup script for Ubuntu
│   ├── setup-amazon-linux.sh   # One-time setup script for Amazon Linux 2023
│   └── ecosystem.config.cjs    # PM2 process config
│
├── PROJECT_NOTES.md            # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
└── components.json             # shadcn/ui config
```

---

## 4. Database Schema

All tables use UUID primary keys generated by PostgreSQL (`gen_random_uuid()`).

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| email | text | unique, lowercased |
| name | text | display name |
| password_hash | text | bcrypt, cost 12 |
| role | varchar(20) | `admin` or `user` |
| monthly_reports_opt_in | boolean | default false |
| default_report_frequency | varchar(20) | `weekly`, `monthly`, `quarterly` |
| created_at | timestamp | auto |
| last_login_at | timestamp | updated on each login |

### `invitations`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| email | text | recipient |
| name | text | |
| role | varchar(20) | role to grant |
| token | text | unique, 32-byte hex |
| invited_by_user_id | varchar | FK → users (set null on delete) |
| accepted_at | timestamp | null until used |
| expires_at | timestamp | 7 days from creation |
| created_at | timestamp | auto |

### `session`
Managed by `connect-pg-simple`. Stores Express sessions in PostgreSQL.
| Column | Type |
|--------|------|
| sid | varchar (PK) |
| sess | jsonb |
| expire | timestamp |

### `password_resets`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| user_id | varchar | FK → users (cascade delete) |
| token | text | unique, 32-byte hex |
| used_at | timestamp | null until consumed |
| expires_at | timestamp | 1 hour from creation |
| created_at | timestamp | auto |

### `sites`
The core entity — each row is a website being monitored.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| domain | text | e.g. `example.com` |
| owner_user_id | varchar | FK → users (set null on delete) |
| status | varchar(20) | `active`, `paused`, `archived` |
| scan_frequency | varchar(20) | `hourly`, `daily`, `weekly` |
| device_type | varchar(20) | `desktop`, `mobile`, `both` |
| locations | jsonb (string[]) | geo locations to scan from |
| tracked_tag_platform_ids | jsonb (string[]) | empty = track all platforms |
| alert_emails | jsonb (string[]) | who to email on tag changes |
| report_recipients | jsonb (string[]) | who gets monthly reports |
| clickup_webhook_url | text | optional ClickUp integration |
| last_scan_at | timestamp | |
| last_scan_status | varchar(20) | latest scan result |
| created_at | timestamp | auto |
| archived_at | timestamp | set when archived |

### `tag_platforms`
Admin-managed catalog of known ad/marketing platforms. Pre-populated with 272 entries from DuckDuckGo Tracker Radar.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| name | text | e.g. `Google Ads`, `Meta Pixel` |
| company | text | parent company |
| matchers | jsonb (string[]) | regex/domain patterns to detect |
| id_pattern | text | regex to extract account IDs from tag |
| category | varchar(40) | `advertising`, `analytics`, `marketing`, `other` |
| created_at | timestamp | auto |

### `scans`
One row per scan execution.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| site_id | varchar | FK → sites (cascade delete) |
| status | varchar(20) | `pending`, `running`, `success`, `failed` |
| device | varchar(20) | `desktop` or `mobile` |
| location | varchar(40) | geo location scanned |
| started_at | timestamp | auto |
| finished_at | timestamp | |
| duration_ms | integer | scan duration |
| error | text | populated on failure |
| tags_found_count | integer | |
| changes_detected | integer | diff count vs previous scan |

### `detected_tags`
Snapshot of every tag found during a scan.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| site_id | varchar | FK → sites (cascade) |
| scan_id | varchar | FK → scans (cascade) |
| platform_id | varchar | FK → tag_platforms (set null) |
| tag_name | text | matched platform name |
| company | text | |
| tag_url | text | script src URL |
| identified_ids | jsonb (string[]) | extracted account IDs |
| detected_at | timestamp | auto |

### `tag_changes`
Diff history — one row per change event. Retained 60 days.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| site_id | varchar | FK → sites (cascade) |
| scan_id | varchar | FK → scans (set null) |
| tag_name | text | |
| change_type | varchar(20) | `added`, `removed`, `modified` |
| tag_url | text | |
| identified_ids | jsonb (string[]) | |
| company | text | |
| first_seen_at | timestamp | |
| last_seen_at | timestamp | |
| change_date | timestamp | when the change was detected |
| evidence | jsonb | `{ pageUrl, htmlSnippet, beforeSnippet, afterSnippet }` |
| created_at | timestamp | auto |

### `notifications`
In-app notification log.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | PK |
| user_id | varchar | FK → users (cascade) |
| site_id | varchar | FK → sites (cascade) |
| type | varchar(40) | `tag_change`, `scan_failure`, `monthly_report` |
| title | text | |
| body | text | |
| read_at | timestamp | null = unread |
| created_at | timestamp | auto |

---

## 5. API Reference

All endpoints require authentication except where noted as **public**.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | public | Email + password login. Rate limited: 10/15min |
| POST | `/api/auth/logout` | any | Destroy session |
| GET | `/api/auth/me` | any | Returns current user or 401 |
| POST | `/api/auth/forgot-password` | public | Send password reset email. Rate limited: 5/hr |
| GET | `/api/auth/reset-password/:token` | public | Validate reset token |
| POST | `/api/auth/reset-password` | public | Set new password using token |
| POST | `/api/auth/change-password` | user | Change own password |
| POST | `/api/auth/accept-invite` | public | Accept invitation, create account, log in |

### Sites
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sites` | user | List own sites (admin sees all) with tag/change counts |
| GET | `/api/sites/:id` | owner/admin | Single site |
| POST | `/api/sites` | user | Create site |
| PUT | `/api/sites/:id` | owner/admin | Update site config |
| POST | `/api/sites/:id/archive` | owner/admin | Archive site |
| POST | `/api/sites/:id/restore` | owner/admin | Restore archived site |
| DELETE | `/api/sites/:id` | owner/admin | Permanently delete site and all data |
| POST | `/api/sites/:id/scan` | owner/admin | Trigger immediate scan (fire-and-forget) |

### Site Data
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sites/:id/tag-changes` | owner/admin | Tag change history (up to 60 days, 1000 rows) |
| GET | `/api/sites/:id/scans` | owner/admin | Scan history |
| GET | `/api/sites/:id/tags` | owner/admin | Detected tags from latest successful scan |

### Tag Platforms
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tag-platforms` | user | Full catalog (for site config UI) |
| POST | `/api/admin/tag-platforms` | admin | Add platform |
| PUT | `/api/admin/tag-platforms/:id` | admin | Edit platform |
| DELETE | `/api/admin/tag-platforms/:id` | admin | Delete platform |
| POST | `/api/admin/tag-platforms/bulk` | admin | Bulk insert platforms |

### Invitations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/invitations` | admin | Create + email invite |
| GET | `/api/admin/invitations` | admin | List all invitations |
| DELETE | `/api/admin/invitations/:id` | admin | Cancel invitation |
| GET | `/api/invitations/:token` | public | Validate invite token (used by accept-invite page) |

### Users (Admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | admin | All users (password hashes stripped) |
| PUT | `/api/admin/users/:id` | admin | Change name/role |
| DELETE | `/api/admin/users/:id` | admin | Delete user (cannot delete self) |

### User Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/settings` | user | Own settings |
| PUT | `/api/me/settings` | user | Update monthly report opt-in, frequency, name |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | user | Own notifications (admin sees all) |
| POST | `/api/notifications/:id/read` | user | Mark notification read |

### Dashboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/summary` | user | Aggregate counts: sites, scans, changes, notifications (last 30 days) |

### Admin Utilities
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/run-scheduler-now` | admin | Manually trigger the scan scheduler tick |

---

## 6. Background Jobs & Scheduler

The server runs three cron jobs via `node-cron`:

### Scan Ticker — Every 10 minutes
```
*/10 * * * *
```
Checks all active sites and fires a scan if the site's `last_scan_at` is older than its configured frequency (`hourly` = 1hr, `daily` = 24hr, `weekly` = 7 days). Runs all due scans concurrently. Uses an in-memory `Set` to prevent double-scanning the same site simultaneously.

### Monthly Reports — 1st of month at 09:00 UTC
```
0 9 1 * *
```
Queries all users with `monthly_reports_opt_in = true` and sends a summary email for each of their sites (tag counts, recent changes).

### Nightly Cleanup — Daily at 03:00 UTC
```
0 3 * * *
```
- Deletes `tag_changes` records older than 60 days
- Deletes expired `invitations` and `password_resets`

### On Boot
- **`resetStaleScans()`** — finds any scans stuck in `running` status (from a previous crash/restart) and marks them `failed`
- **`ensureSeed()`** — creates the admin user from env vars if no users exist yet

---

## 7. Authentication & Security

### Session Management
- **Store:** PostgreSQL (`session` table via `connect-pg-simple`)
- **Duration:** 7 days (`maxAge: 1000 * 60 * 60 * 24 * 7`)
- **Cookie flags:** `httpOnly: true`, `sameSite: lax`
- **`secure` flag:** Only set when `APP_URL` starts with `https://` — **important:** this must be false while running on plain HTTP

### Password Security
- bcrypt with cost factor 12
- Minimum 8 characters enforced at API level (Zod)

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| `/api/auth/login` | 10 attempts / 15 min / IP |
| `/api/auth/forgot-password` | 5 requests / hour / IP |
| `/api/auth/reset-password` | 5 requests / hour / IP |
| `/api/auth/change-password` | 5 requests / hour / IP |
| `/api/auth/accept-invite` | 20 requests / 15 min / IP |

### Helmet CSP (Production)
```
default-src 'self'
base-uri 'self'
form-action 'self'
frame-ancestors 'self'
object-src 'none'
script-src 'self' 'unsafe-inline'
script-src-attr 'none'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: https:
connect-src 'self' https:
font-src 'self' data: https://fonts.gstatic.com
upgrade-insecure-requests  ← ONLY added when APP_URL is https://
```

### Access Control
- `requireAuth` middleware — 401 if not logged in
- `requireAdmin` middleware — 403 if not admin role
- Site endpoints enforce owner-or-admin on every read/write/delete

### Inactivity Timeout
Frontend auto-logs out after 15 minutes of inactivity (no mouse/keyboard/touch/scroll events).

---

## 8. Email System

Uses **Resend** for transactional email. Without `RESEND_API_KEY`, all emails fall back to `console.log` (useful for dev, not for production).

### Email Types
| Template | Trigger | Recipients |
|----------|---------|------------|
| Invitation | Admin sends invite | Invited person |
| Password reset | Forgot password request | Requesting user |
| Tag change alert | Scan detects changes | Site's `alert_emails` list |
| Scan failure | Scan errors out | Site's `alert_emails` list |
| Monthly report | 1st of month cron | Users opted in via settings |

### Configuration
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM=Ad Tag Tracker <noreply@yourdomain.com>
```
The `RESEND_FROM` address must use a domain verified in Resend's dashboard.

---

## 9. Tag Detection Engine

### How Scanning Works (`server/scanner.ts`)
1. Fetches the target URL using Node's `fetch` (or Cheerio HTTP client)
2. Parses the HTML with **Cheerio** (server-side jQuery-like parsing)
3. Extracts all `<script>` tags — both `src` attributes and inline content
4. Matches each script against the `matchers` array of every `tag_platform` in the database (regex or domain fragment matching)
5. If `idPattern` is set on a platform, extracts account/property IDs from the matched script content
6. Compares detected tags against the previous successful scan to compute a diff
7. Records new `detected_tags` snapshot and any `tag_changes`

### Tag Platform Catalog
- **272 platforms** loaded from DuckDuckGo Tracker Radar
- Categories: `advertising`, `analytics`, `marketing`, `other`
- Prevalence threshold used during import: ≥ 0.2% of tracked domains
- Re-import is idempotent (skips existing entries): `npm run import:trackers`

### ClickUp Integration
Sites can optionally have a `clickup_webhook_url`. When tag changes are detected, a webhook is posted to ClickUp to create/update a task automatically.

---

## 10. Frontend Architecture

### Routing (Wouter)
All routes are client-side (SPA). The server serves `index.html` for all paths; wouter handles routing in the browser.

| Path | Component | Auth |
|------|-----------|------|
| `/login` | Login | Redirects to `/` if already logged in |
| `/` | Dashboard | Required |
| `/sites` | Sites list | Required |
| `/sites/new` | Create site | Required |
| `/sites/:id` | Site detail | Required |
| `/reports` | Reports | Required |
| `/archived` | Archived sites | Required |
| `/profile` | Profile | Required |
| `/settings` | User settings | Required |
| `/admin` | Admin panel | Admin only |
| `/forgot-password` | Forgot password | Public |
| `/reset-password` | Reset password | Public |
| `/accept-invite` | Accept invitation | Public |

### Auth State (`AuthContext`)
- Uses **TanStack React Query** to cache `/api/auth/me`
- `staleTime: 60_000` (1 minute before auto-refetch)
- On 401 from any API call: hard redirect to `/login` (clears all React state)
- On login: sets query cache directly, then navigates to `/`
- On logout: clears cache, hard redirects to `/login`

### Data Fetching
- All API calls use `credentials: "include"` (sends session cookies)
- Default query function handles 401s with a redirect
- `staleTime: Infinity` for most data (manual refetch or React Query invalidation)

### UI Framework
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling
- **Dark/light mode** via `next-themes`

---

## 11. EC2 Server Specs

| Property | Value |
|----------|-------|
| **Provider** | AWS EC2 |
| **Region** | `ca-central-1` (Canada — Montreal) |
| **AMI** | Amazon Linux 2023 |
| **Instance type** | `t3.small` — 2 vCPU, 2 GB RAM |
| **Storage** | 30 GB gp3 (3000 IOPS) |
| **Public IP** | `99.79.48.136` (assigned at launch, NOT an Elastic IP yet) |
| **Private IP** | `172.31.17.77` |
| **Hostname** | `ip-172-31-17-77.ca-central-1.compute.internal` |
| **SSH user** | `ec2-user` |
| **SSH key** | `Ad_Tag_Tracker_Pairkey.pem` (stored in `/Users/lucanmarsh/Documents/Ad Tag Tracker_Pairkey/`) |
| **Elastic IP** | ❌ Not yet allocated — IP will change if instance is stopped/started |

### Security Group Inbound Rules
| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | SSH | My IP only | Server access |
| 80 | HTTP | 0.0.0.0/0 | Web traffic |
| 443 | HTTPS | 0.0.0.0/0 | Web traffic (SSL — not yet configured) |

### SSH Command
```bash
ssh -i "/Users/lucanmarsh/Documents/Ad Tag Tracker_Pairkey/Ad_Tag_Tracker_Pairkey.pem" ec2-user@99.79.48.136
```

---

## 12. Server Software

| Software | Version | How Installed |
|----------|---------|---------------|
| Amazon Linux 2023 | — | AMI |
| Node.js | 20.20.2 | NodeSource RPM repo |
| npm | 10.8.2 | Bundled with Node |
| PostgreSQL | 15 | AL2023 native repo (`dnf`) |
| PM2 | 7.0.1 | `npm install -g pm2` |
| Nginx | latest | AL2023 native repo (`dnf`) |
| Git | latest | AL2023 native repo (`dnf`) |

### Key File Paths on Server
| Item | Path |
|------|------|
| App code | `~/adtag-tracker/` |
| App env file | `~/adtag-tracker/.env` |
| PM2 config | `~/adtag-tracker/deploy/ecosystem.config.cjs` |
| Built server | `~/adtag-tracker/dist/index.js` |
| Built client | `~/adtag-tracker/dist/public/` |
| Nginx config | `/etc/nginx/conf.d/adtag.conf` |
| PostgreSQL data | `/var/lib/pgsql/data/` |
| PostgreSQL auth config | `/var/lib/pgsql/data/pg_hba.conf` |
| PM2 auto-start | `/etc/systemd/system/pm2-ec2-user.service` |

### Database Details
| Property | Value |
|----------|-------|
| Engine | PostgreSQL 15 |
| Database name | `adtag` |
| Database user | `adtag` |
| Auth method | `md5` (password) — changed from default `ident` during setup |
| Connection | `postgresql://adtag:PASSWORD@localhost:5432/adtag` |

---

## 13. Deployment Process

### How the App Was Deployed
**Option B** — clone and build directly on the server.

### First-Time Deployment Steps (already done)
1. Launched EC2 instance (Amazon Linux 2023, t3.small, 30 GB gp3)
2. Added inbound security group rules (SSH, HTTP, HTTPS)
3. SSH'd in with `.pem` key
4. Installed Node.js 20 (NodeSource RPM)
5. Installed PostgreSQL 15 (`dnf install postgresql15-server`)
6. Ran `postgresql-setup --initdb`, enabled + started `postgresql`
7. Edited `/var/lib/pgsql/data/pg_hba.conf` — changed `ident` → `md5` for IPv4/IPv6 host connections
8. Installed PM2 (`npm install -g pm2`)
9. Installed Nginx (`dnf install nginx`)
10. Created PostgreSQL database user and database
11. Installed Git (`dnf install git`)
12. Cloned repo: `git clone https://github.com/Makkie255/adtagtracker.git adtag-tracker`
13. Created `.env` file with all required variables
14. Ran `npm ci --legacy-peer-deps`
15. Ran `npm run build`
16. Ran `npm run db:push` (created all tables)
17. Ran `npm run import:trackers` (imported 272 ad platforms)
18. Started app: `pm2 start deploy/ecosystem.config.cjs`
19. Saved PM2 process list: `pm2 save`
20. Set up PM2 auto-start on reboot: `pm2 startup` (ran the generated `sudo env PATH=...` command)
21. Created Nginx config at `/etc/nginx/conf.d/adtag.conf`
22. Removed default Nginx server block from `/etc/nginx/nginx.conf`
23. Reloaded Nginx

### Future Deploys (Updating the App)
```bash
cd ~/adtag-tracker
git pull
npm ci --legacy-peer-deps   # only if package.json changed
npm run build
npm run db:push             # only if database schema changed
pm2 restart adtag-tracker
```

---

## 14. Environment Variables

File location on server: `~/adtag-tracker/.env`

```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://adtag:PASSWORD@localhost:5432/adtag

# Sessions — REQUIRED in production
# Generate: openssl rand -hex 32
SESSION_SECRET=<64-char hex string>

# Email (Resend) — optional; emails log to console if missing
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM=Ad Tag Tracker <noreply@yourdomain.com>

# Public-facing URL — CRITICAL
# Must be https:// once SSL is configured (affects cookie secure flag and CSP)
APP_URL=http://99.79.48.136

# Admin bootstrap — used ONLY on first boot to create the initial admin account
# After first boot, these are ignored
ADMIN_EMAIL=lucan@rallyad.com
ADMIN_NAME=Lucan Marsh
```

### Why `APP_URL` Matters
Two pieces of code key off `APP_URL`:
1. **Session cookie `secure` flag** — `secure: true` only when `APP_URL` starts with `https://`. If set to `true` on HTTP, the browser won't send the cookie and every request appears unauthenticated.
2. **Helmet CSP `upgrade-insecure-requests`** — only added when `APP_URL` starts with `https://`. If added on HTTP, the browser upgrades all HTTP sub-resource loads to HTTPS and they all fail.

**When you add SSL:** change `APP_URL=https://yourdomain.com` and restart PM2.

---

## 15. Useful Server Commands

### PM2 (App Process)
```bash
pm2 status                          # View all running processes
pm2 logs adtag-tracker              # Live log tail
pm2 logs adtag-tracker --lines 50 --nostream  # Last 50 log lines
pm2 logs adtag-tracker --err        # Errors only
pm2 restart adtag-tracker          # Restart app
pm2 stop adtag-tracker             # Stop app
pm2 start deploy/ecosystem.config.cjs  # Start from scratch
```

### Database
```bash
# Connect to the database
sudo -u postgres psql -d adtag

# Common queries
\dt                                 # List all tables
SELECT COUNT(*) FROM tag_platforms; # Should be 272
SELECT COUNT(*) FROM users;

# Reset admin password (delete the user, PM2 restart will recreate)
psql -U adtag -d adtag -c "DELETE FROM users WHERE email='lucan@rallyad.com';"
pm2 restart adtag-tracker          # New one-time password will be in logs
```

### Nginx
```bash
sudo nginx -t                                  # Test config
sudo systemctl reload nginx                    # Reload without downtime
sudo systemctl restart nginx                   # Full restart
sudo cat /etc/nginx/conf.d/adtag.conf         # View config
sudo tail -f /var/log/nginx/error.log         # Error logs
sudo tail -f /var/log/nginx/access.log        # Access logs
```

### System
```bash
sudo systemctl status postgresql               # PostgreSQL status
sudo systemctl status nginx                    # Nginx status
df -h                                          # Disk usage
free -h                                        # Memory usage
top                                            # CPU/memory live
```

### App Updates
```bash
cd ~/adtag-tracker
git log --oneline -5                           # Check current deployed version
git pull                                       # Pull latest from GitHub
npm run build                                  # Rebuild
pm2 restart adtag-tracker                     # Apply changes
npm run import:trackers                        # Re-import tracker catalog (safe to re-run)
```

---

## 16. Known Issues & Fixes Applied

### 1. PostgreSQL `ident` auth (fixed during setup)
**Problem:** Amazon Linux 2023 defaults PostgreSQL to `ident` auth for local connections, which matches OS username to DB username. Since the app runs as `ec2-user` but connects as `adtag`, every DB connection was rejected.  
**Fix:** Changed `ident` → `md5` in `/var/lib/pgsql/data/pg_hba.conf` for IPv4 and IPv6 host entries. Restarted PostgreSQL.

### 2. Helmet `upgrade-insecure-requests` CSP (fixed in code)
**Problem:** Helmet's `useDefaults: true` automatically adds the `upgrade-insecure-requests` CSP directive. On an HTTP-only server, this tells the browser to upgrade all HTTP sub-resource loads (JS, CSS, fonts) to HTTPS — which fail because there's no SSL. Result: white screen.  
**Fix:** Changed to `useDefaults: false` and explicitly list all directives. `upgrade-insecure-requests` is only added when `APP_URL` starts with `https://`.  
**Commit:** `26274a7`

### 3. Session cookie `secure` flag (fixed in code)
**Problem:** `auth.ts` set `cookie: { secure: process.env.NODE_ENV === "production" }`. On a production HTTP server, this marks the cookie as `secure`, meaning the browser sends it on HTTPS requests only. Every request after login returned 401, instantly logging the user out.  
**Fix:** Changed to `secure: process.env.APP_URL?.startsWith("https://") ?? false`.  
**Commit:** `f1fe851`

### 4. `/login` route no redirect when authenticated (fixed in code)
**Problem:** After a successful login, the URL remained at `/login`. The route had no guard to redirect authenticated users, so the login form continued to render overlaid on the dashboard.  
**Fix:** Added `{() => (isLoggedIn ? <Redirect to="/" /> : <Login />)}` to the `/login` route in `App.tsx`.  
**Commit:** `926fc52`

### 5. Google Fonts blocked by CSP (fixed in code)
**Problem:** The original `style-src` and `font-src` CSP directives didn't include `fonts.googleapis.com` or `fonts.gstatic.com`, so the browser blocked Google Fonts.  
**Fix:** Added both domains to their respective CSP directives.  
**Commit:** `26274a7`

---

## 17. Future Work

### High Priority
- [ ] **Allocate Elastic IP** — the current public IP (`99.79.48.136`) changes if the instance is stopped/started. Allocate an Elastic IP and associate it to lock the IP permanently. (AWS Console → EC2 → Elastic IPs)
- [ ] **Add a domain** — point an A record at the Elastic IP
- [ ] **Set up SSL** — once a domain is pointing at the server:
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d yourdomain.com
  ```
  Then update `APP_URL=https://yourdomain.com` in `.env` and restart PM2
- [ ] **Set up Resend** — create account, verify sending domain, add `RESEND_API_KEY` to `.env` so emails are actually delivered

### Medium Priority
- [ ] **Set up automated backups** — daily `pg_dump` to S3
- [ ] **Set up Elastic IP** before sharing the app URL with anyone
- [ ] **Monitor disk usage** — 30 GB will last a long time but tag change history and scan logs grow over time
- [ ] **Configure CloudWatch** for centralized logging and alerting

### Low Priority / Nice to Have
- [ ] **Add more tag platforms** — the 272 from DuckDuckGo Tracker Radar can be supplemented with custom entries via the Admin Panel
- [ ] **ClickUp webhook** — test and document the ClickUp integration per-site
- [ ] Keep Ubuntu/Node.js updated: `sudo dnf update -y`
