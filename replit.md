# Ad Tag Tracking System

A comprehensive B2B SaaS web application for monitoring advertising tags across websites, detecting changes over time, and delivering automated notifications and monthly reports.

## Project Overview

This is a full-stack JavaScript application built with:
- **Frontend**: React, TypeScript, Vite, Wouter (routing), shadcn/ui components, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (via Neon)
- **Authentication**: Replit Auth integration

## Current Status (November 25, 2025)

### Completed Features

#### Frontend Prototype (High-Fidelity)
All major pages and components are complete with mock data:

1. **Dashboard** (`/`)
   - Overview stats (total sites, scans, changes, notifications)
   - Sites table with status badges, search, and actions
   - Charts showing activity trends and tag distribution
   - Delete confirmation dialogs with permanent action warnings

2. **Site Detail Page** (`/sites/:id`)
   - 5 comprehensive tabs:
     - **Tag Changes**: Expandable feed of all tag modifications (added/removed/modified)
     - **Scan History**: Complete activity log with device type, location, duration, success/failure
     - **Tag Inventory**: Full catalog with search/filter by platform and status, copyable IDs
     - **Analytics**: Visual charts (tags by platform, changes over time, scan success rate)
     - **Settings**: Configuration and tag tracking preferences
   - Site header with status, last scan info, and action buttons

3. **Create/Edit Site** (`/sites/new`)
   - Domain and scan frequency configuration
   - Device type selection (desktop/mobile/both)
   - Geographic location selection
   - Tag tracking configuration (track all or select specific platforms)
   - Email and ClickUp notification settings

4. **Reports Page** (`/reports`)
   - **Site-specific reports** with site selector dropdown
   - Customizable date ranges
   - Key metrics: total scans, changes, active tags, notifications
   - **Domain Change Tracking**: Visual display of domain migrations (old → new)
   - Recent tag changes breakdown
   - Platform distribution analysis
   - Monthly email summary preview (includes domain changes)
   - Export options (CSV/PDF)

5. **Admin Panel** (`/admin`)
   - **User Management**: Role assignment, user creation/deletion
   - **Tag Upload System**:
     - Bulk upload via CSV/TXT files
     - Paste tag domains (newline or comma-separated)
     - Live preview of uploaded tags
     - Individual tag removal
     - Clear all and save functionality
   - **Tag Domain Management**:
     - Curated advertising platform lists
     - Manual domain entries
     - System settings configuration

#### Components Library

**Core Components**:
- `sites-table.tsx` - Interactive data table with actions menu
- `tag-change-feed.tsx` - Expandable change cards with details
- `scan-history.tsx` - Scan activity timeline
- `tag-inventory.tsx` - Searchable/filterable tag catalog
- `site-analytics.tsx` - Data visualization charts
- `tag-tracking-config.tsx` - Platform selection with custom domains
- `delete-site-dialog.tsx` - Confirmation dialog with warnings
- `stats-card.tsx` - Metric display cards
- `charts-section.tsx` - Dashboard analytics
- `status-badge.tsx` - Visual status indicators
- `empty-state.tsx` - No data placeholders

#### Design System

**Design Guidelines** (`design_guidelines.md`):
- Modern B2B SaaS aesthetic inspired by Linear, Vercel, Stripe
- Professional color palette with excellent contrast
- Typography: Inter (UI), JetBrains Mono (code/data)
- Consistent spacing and component patterns
- Clean data tables optimized for information density
- Interactive hover states and smooth transitions

#### Key Features

**Tag Tracking Configuration**:
- "Track All Tags" mode (recommended default)
- Selective platform monitoring:
  - Google Ads, Google Analytics, Google Tag Manager
  - Meta Pixel, LinkedIn Insight, Twitter Pixel
  - TikTok Pixel, Pinterest Tag, Snapchat Pixel
  - Microsoft Advertising, The Trade Desk, Taboola, Outbrain
- Custom domain tracking for proprietary systems

**Delete Confirmation**:
- Warning dialogs for permanent actions
- Site domain display for clarity
- Integrated on dashboard and site detail pages

**Site-Specific Reporting**:
- Individual site report generation
- Date range selection
- Tag change tracking
- Platform distribution analysis
- Export capabilities (CSV/PDF)
- Monthly email summary templates

### Architecture Notes

**Development Stack**:
- All components use TypeScript for type safety
- Mock data tagged with `//todo: remove mock functionality`
- Shadcn/ui components for consistent design
- Recharts for data visualization
- React Query for future API integration

**Data Flow** (Planned):
1. Frontend → API routes (`server/routes.ts`)
2. API → Storage interface (`server/storage.ts`)
3. Storage → Database (`shared/schema.ts`)

### Next Steps

**Backend Implementation**:
1. Define data schema in `shared/schema.ts`:
   - Sites table (domain, frequency, settings, tracking config)
   - Scans table (timestamp, status, device, location)
   - Tags table (name, URL, platform, status)
   - Changes table (type, date, tag reference)
   - Users table (auth integration)

2. Implement storage interface (`server/storage.ts`)
3. Create API routes (`server/routes.ts`)
4. Connect frontend to real data (remove mock data)

**Automation Features** (Future):
1. Playwright-based headless browser scanning
2. Tag detection and comparison algorithms
3. Change detection and notification triggers
4. Email and ClickUp integration
5. Automated monthly report generation
6. Scheduling system for periodic scans

### User Preferences

- Modern, clean B2B SaaS design
- Information density over whitespace
- Professional aesthetic targeting business users
- All mock data clearly marked for removal

### Important Files

**Frontend**:
- `client/src/App.tsx` - Main application and routing
- `client/src/pages/dashboard.tsx` - Dashboard page
- `client/src/pages/site-detail.tsx` - Site detail with tabs
- `client/src/pages/create-site.tsx` - Site creation form
- `client/src/pages/reports.tsx` - Site-specific reports
- `client/src/pages/admin.tsx` - Admin panel

**Components**:
- `client/src/components/tag-tracking-config.tsx` - Tag selection
- `client/src/components/delete-site-dialog.tsx` - Delete confirmation
- `client/src/components/scan-history.tsx` - Scan timeline
- `client/src/components/tag-inventory.tsx` - Tag catalog
- `client/src/components/site-analytics.tsx` - Data visualizations

**Configuration**:
- `design_guidelines.md` - Design system and patterns
- `shared/schema.ts` - Database schema (to be implemented)
- `server/routes.ts` - API routes (to be implemented)
- `server/storage.ts` - Storage interface (to be implemented)

## Recent Changes (Current Session)

1. Implemented comprehensive site detail view with 5 tabs:
   - Tag changes feed
   - Scan history timeline
   - Tag inventory with search/filter
   - Analytics with charts
   - Settings configuration

2. Made reports website-specific:
   - Added site selector dropdown
   - Personalized metrics per site
   - Site-specific tag changes and platform breakdowns
   - Customized monthly email templates

3. Added delete confirmation dialogs:
   - Warning for permanent actions
   - Integrated on dashboard and detail pages
   - Domain display for clarity

4. Implemented tag tracking configuration:
   - "Track all" vs. selective platform mode
   - 12+ pre-configured platforms
   - Custom domain support

5. Enhanced notification system with report scheduling:
   - **Instant Change Alerts**: Immediate notifications when tags change
     - Email recipients field
     - ClickUp integration
   - **Summary Reports**: Periodic comprehensive reports
     - Separate report recipient email list
     - Configurable frequency (Weekly, Bi-weekly, Monthly)
   - Available in both Create Site form and Site Settings tab

6. Implemented comprehensive report frequency configuration:
   - **Global Settings** (`/settings`): Default report frequency for new sites
   - **Site Detail Settings Tab**: Per-site editable configuration with scan frequency, alert emails, ClickUp email, report recipients, and report frequency
   - **Sites Page Edit Dialog**: Quick edit for domain, status, and report frequency
   - All settings fully editable across all three locations

7. Added domain change tracking in reports:
   - **Recent Domain Changes** card showing old → new transitions
   - Visual arrow indicator, date, and reason badge
   - Included in monthly email summary preview
   - Tracks domain migrations and rebranding events

8. Implemented tag upload system in Admin Panel:
   - Bulk upload via CSV/TXT file with automatic parsing
   - Paste functionality for quick tag entry
   - Live preview with tag counter
   - Individual tag removal capability
   - Clear all and save operations with toast notifications
   - Automatic deduplication of tags
