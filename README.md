# Ad Tag Tracker

A full-stack web app that scans websites for advertising and tracking tags, records
how those tags change over time, and emails scheduled reports. It provides a
dashboard with charts, per-site scan drill-downs, an activity monitor, and Excel
report export.

## Tech stack

- **Client:** React 18, Vite, TypeScript, Tailwind CSS, Radix UI (shadcn-style components), Wouter (routing), TanStack Query, Recharts
- **Server:** Node.js, Express, Passport (local auth), Drizzle ORM
- **Database:** PostgreSQL
- **Scheduling:** node-cron
- **Scanning:** Cheerio
- **Email:** Resend (falls back to console logging if no API key)

> **Note:** This is a TypeScript/Node project. Dependencies are managed via
> `package.json` / `package-lock.json` (npm) — there is no `requirements.txt`
> because the project uses no Python.

## Project structure

```
client/     React front-end (Vite)
server/     Express API, auth, DB, scanner, scheduler, email
shared/     Types and logic shared between client and server (schema, filters, imports)
deploy/     Deployment scripts and docs (EC2, PM2 ecosystem config)
```

## Prerequisites

- Node.js 20+
- npm
- A PostgreSQL database

## Getting started (local development)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the example file and fill in real values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   |---|---|---|
   | `NODE_ENV` | yes | `development` or `production` |
   | `PORT` | no | Server port (default `5000`) |
   | `DATABASE_URL` | yes | PostgreSQL connection string |
   | `SESSION_SECRET` | prod | 64-hex-char secret. Generate: `openssl rand -hex 32` |
   | `RESEND_API_KEY` | no | Resend API key; if empty, emails are logged to console only |
   | `RESEND_FROM` | no | From address for outgoing email |
   | `APP_URL` | prod | Public URL used in email links |
   | `ADMIN_EMAIL` | first boot | Bootstrap admin email (locked in after first admin is created) |
   | `ADMIN_NAME` | first boot | Bootstrap admin display name |

   > **Never commit `.env` or any real secrets.** `.env` is already listed in
   > `.gitignore`; store credentials in KeePass.

3. **Set up the database schema**

   ```bash
   npm run db:push
   ```

4. **Run in development**

   ```bash
   npm run dev
   ```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the server in development mode (tsx) |
| `npm run build` | Build the client (Vite) and bundle the server (esbuild) |
| `npm run start` | Run the production build |
| `npm run check` | Type-check with `tsc` |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run import:trackers` | Import the tracker-radar dataset |

## Deployment

See [`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md) and
[`deploy/EC2_DEPLOY_OPTION_B.md`](deploy/EC2_DEPLOY_OPTION_B.md) for EC2
deployment instructions. A PM2 config is provided in
[`deploy/ecosystem.config.cjs`](deploy/ecosystem.config.cjs).

## License

MIT
