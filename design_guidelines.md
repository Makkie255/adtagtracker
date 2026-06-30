# Ad Tag Tracking System - Design Guidelines

## Design Approach

**Selected Approach**: Design System - Modern B2B SaaS Productivity Tool

**References**: Linear (data tables, status design), Vercel Dashboard (clean metrics), Stripe Dashboard (professional layouts), Retool (data-dense interfaces)

**Core Principle**: Information clarity and operational efficiency. This is a professional monitoring tool where users need to quickly scan data, identify changes, and take action.

---

## Typography System

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for URLs, IDs, technical data)

**Hierarchy**:
- Dashboard headings: text-2xl font-semibold
- Section titles: text-lg font-semibold  
- Data table headers: text-sm font-medium uppercase tracking-wide
- Body/table data: text-sm font-normal
- Secondary metadata: text-xs
- Monospace technical data: font-mono text-sm

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16**

**Application Structure**:
- Fixed sidebar navigation (w-64) with logo, main nav items, user profile at bottom
- Main content area with max-w-7xl container, px-8 py-6
- Page headers: mb-8 with title + action buttons in flex justify-between
- Card containers: p-6 rounded-lg border
- Section spacing: space-y-6 between major sections

---

## Component Library

### Navigation & Layout

**Sidebar Navigation**:
- Fixed left sidebar with: Dashboard, Sites (with count badge), Reports, Settings, Admin (role-based)
- Active state: subtle background fill, left border accent
- Logo/brand at top (h-12)
- Collapsed state on mobile with hamburger

**Top Bar** (above main content):
- User avatar/name dropdown (right)
- Quick actions: "Create New Site" button (prominent)
- Breadcrumb navigation for nested views

### Data Display

**Sites Table** (main dashboard):
- Full-width responsive table with sticky header
- Columns: Site Domain (with favicon), Status Badge, Last Scan (relative time), Changes (count chip), Actions (icon menu)
- Row hover state with subtle background
- Sortable headers with sort indicators
- Filter controls above table (search, status dropdown, date range)
- Pagination at bottom (showing "1-20 of 156 sites")

**Status Indicators**:
- Pill badges: Active (subtle fill), Inactive (outline), Failed (alert fill)
- Success/failure icons: checkmark/x-circle with matching semantic treatment
- Change counts in small chips with numeric value

**Charts Section**:
- 2-column grid (lg:grid-cols-2) for chart cards
- Each chart card: p-6 with title, subtitle showing date range, and visualization
- Chart types: Line charts (scans over time), bar charts (top tags), donut chart (success rate)
- Minimal chart styling - clean axes, subtle gridlines, clear labels

### Forms

**Create/Edit Site Form**:
- Single column layout, max-w-2xl
- Grouped sections with subtle separation (border-t mt-8 pt-8)
- Section headers: text-base font-semibold mb-4
- Form groups: space-y-4
- Input fields: Full-width with labels above, helper text below in text-xs
- Multi-select for geos: Checkbox list in 2-column grid
- Device type: Radio button group, horizontal layout
- Action buttons: Right-aligned, primary + secondary pattern

**Input Styling**:
- Text inputs: h-10 px-3 rounded-md border
- Select dropdowns: Match text input height
- Checkboxes/radios: Larger touch targets (w-4 h-4)
- Focus states: ring treatment on all interactive elements

### Site Detail Dashboard

**Header Section**:
- Site domain as h1 (text-3xl font-bold)
- Status badge and last scan info inline
- Screenshot thumbnail (w-64 rounded-lg border) floated right
- Edit/Delete actions as icon buttons

**Tag Changes Feed**:
- Timeline-style layout with left border accent
- Each change entry: Card with timestamp, tag name (monospace), change type badge, expand/collapse for details
- "Show tag details" link reveals: full URL (monospace, break-all), IDs extracted, history timeline (first/last seen)

**Settings Section**:
- Expandable accordion or separate tab
- Same form styling as Create Site
- Save changes button: sticky to bottom on scroll

### Reports & Analytics

**Usage Reports View**:
- Date range picker at top (preset options: Last 30 days, Last month, Custom)
- Metric cards in 4-column grid: Total Logins, Active Users, Scans Completed, Notifications Sent
- Data table below with exportable data
- Export buttons: CSV and PDF with download icons

**Monthly Summary Email Preview**:
- Styled preview card showing email template
- Sections clearly delineated
- Top sites list as ordered list with domain + change count

### Admin Panel

**User Management Table**:
- Similar to Sites table
- Columns: Name, Email, Role (dropdown to change), Status, Actions
- "Create User" button at top

**Tag Domain Configuration**:
- Two-panel layout: Known sources (left), Manual entries (right)
- Source list with refresh status
- Manual entries: inline add/edit with validation

---

## Interaction Patterns

**Loading States**:
- Skeleton loaders for tables (shimmer effect)
- Spinner for chart loading
- Button loading state: spinner replacing icon

**Empty States**:
- Centered empty state with icon, heading, description, primary CTA
- Example: "No sites yet" → "Create your first site to start monitoring"

**Modals/Overlays**:
- Confirmation dialogs: max-w-md, centered, with clear primary/cancel actions
- Delete confirmations: Include warning treatment

**Notifications**:
- Toast notifications (top-right): Success, error, warning variants
- Dismissible with close button

---

## Responsive Behavior

**Breakpoints**:
- Mobile (base): Single column, sidebar becomes overlay
- Tablet (md): 2-column grids, sidebar remains
- Desktop (lg+): Full multi-column layouts, optimal spacing

**Mobile Adaptations**:
- Tables become card list view with stacked data
- Charts stack vertically (grid-cols-1)
- Form inputs remain full-width
- Bottom navigation for primary actions

---

## Icons

**Library**: Heroicons (via CDN)
- Use outline variant for navigation, actions
- Use solid variant for status indicators, alerts
- Size: w-5 h-5 for most UI icons, w-4 h-4 for inline icons

---

## Images

**No hero images** - this is a data-focused application dashboard.

**Site Screenshots**: Thumbnail previews (16:10 aspect ratio, max 256px width) in site detail headers and optionally in table rows. Provide fallback icon/placeholder for failed screenshots.

**Empty State Illustrations**: Simple, minimal line-art style illustrations for empty tables/views (can use placeholder SVGs or icon compositions).