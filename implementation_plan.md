# CEMARA — Admin GUI & Role-Based Access Control

Build a **Super Admin Page** with user profile pictures, accounts, and a 4-tier role system (Super Admin, Admin, Dev, User) — each with distinct features.

---

## Codebase Audit — Issues Found

> [!WARNING]
> ### Current Problems in the Existing Codebase

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | [app.js](file:///d:/CEMARA/app.js#L519-L523) | **Search uses `.includes()` instead of full-text search** — `searchable.includes(query)` checks if the entire concatenated string exactly matches the query, not if it *contains* it. Should be `searchable.includes(query)` → this actually checks substring so it works, but edge cases exist with empty queries always matching | Low |
| 2 | [schema.sql](file:///d:/CEMARA/schema.sql#L40-L49) | **Category CHECK constraint is missing `'Komik'`** — The SQL schema allows `'Artikel'` and `'Lainnya'` but the HTML filter buttons show `'Komik'` and `'Seni'`. The upload form also has `'Komik'` as an option. Inserting a Komik will fail at database level. | 🔴 Critical |
| 3 | [config.js](file:///d:/CEMARA/config.js) | **Supabase key exposed in source control** — `sb_publishable_7t84xliOnW4UFmnAotdMVA_eDXTyARf` is committed. This is the publishable (anon) key so it's technically okay for client-side use, but `config.js` should be in `.gitignore`. | Medium |
| 4 | [app.js](file:///d:/CEMARA/app.js#L337-L387) | **Admin check is binary** — The system only knows "admin" or "not admin". No roles, no granularity. `admin_profiles` table has no `role` column. | High (blocks new feature) |
| 5 | [reader.html](file:///d:/CEMARA/reader.html#L50-L51) | **`reader.js` loaded in `<head>` before `</head>` tag is closed** — Script runs before DOM is ready. Works because `reader.js` uses `DOMContentLoaded`, but is fragile. | Low |
| 6 | [reader.html](file:///d:/CEMARA/reader.html#L53) | **Missing `</head>` closing tag** — The `<body>` opens without `</head>` being closed first. Browsers auto-fix this but it's invalid HTML. | Medium |
| 7 | [app.js](file:///d:/CEMARA/app.js) / [reader.js](file:///d:/CEMARA/reader.js) | **Duplicated code** — `esc()`, `toast()`, `normalizeImages()`, `adminCheck()`, `formatDate()` are copy-pasted between both files. | Medium |
| 8 | All files | **No `.gitignore`** — No git ignore file exists to protect `config.js` and other sensitive files. | Medium |
| 9 | [schema.sql](file:///d:/CEMARA/schema.sql#L131-L139) | **`admin_profiles` has no `role` or `display_name` or `avatar_url`** — Cannot support roles or profile pictures. | High (blocks new feature) |
| 10 | [app.js](file:///d:/CEMARA/app.js#L2440-L2441) | **Hardcoded cover** — All uploaded works get `cover-green`. No cover selection. | Low |

---

## User Review Required

> [!IMPORTANT]
> ### Key Decisions Needed

1. **New folder structure** — I will create a new `admin/` folder inside the project for the Admin GUI page(s). The main site (`index.html`, `app.js`, etc.) stays untouched for the public-facing side. Is this acceptable?

2. **Role hierarchy** — Proposed permission matrix below. Please confirm:

| Feature | Super Admin | Admin | Dev | User |
|---------|:-----------:|:-----:|:---:|:----:|
| View all users & roles | ✅ | ❌ | ❌ | ❌ |
| Assign/change user roles | ✅ | ❌ | ❌ | ❌ |
| Delete any user account | ✅ | ❌ | ❌ | ❌ |
| Upload/Edit/Delete works | ✅ | ✅ | ❌ | ❌ |
| Manage all comments | ✅ | ✅ | ❌ | ❌ |
| View admin dashboard & stats | ✅ | ✅ | ✅ | ❌ |
| Access site settings / dev tools | ✅ | ❌ | ✅ | ❌ |
| Edit own profile & avatar | ✅ | ✅ | ✅ | ✅ |
| Post comments | ✅ | ✅ | ✅ | ✅ |
| View public works | ✅ | ✅ | ✅ | ✅ |

3. **Profile pictures** — Should we use Supabase Storage for avatar uploads, or allow URL-based avatars only?

---

## Open Questions

> [!IMPORTANT]
> 1. Do you want the Admin GUI as a **separate page** (`admin/index.html`) with its own layout, or embedded inside the existing modal on `index.html`?
> 2. Should the **"Komik" category bug** in `schema.sql` be fixed as part of this work?
> 3. Do you want a **"Daftar" (register)** flow that auto-assigns the "User" role, with only Super Admin able to promote users?

---

## Proposed Changes

### Component 1: Database Schema Updates

#### [MODIFY] [schema.sql](file:///d:/CEMARA/schema.sql)

- **Fix category CHECK constraint** — Add `'Komik'` and `'Seni'` to the allowed categories
- **Add `role` column to `admin_profiles`** — New `text` column with CHECK constraint: `('super_admin', 'admin', 'dev', 'user')`
- **Rename table** `admin_profiles` → `user_profiles` (or add new `user_profiles` table)
- **Add new columns** to `user_profiles`:
  - `role text NOT NULL DEFAULT 'user'`
  - `display_name text`
  - `avatar_url text`
  - `bio text`
- **Update RLS policies** — Role-based policies using the new `role` column
- **Create new helper function** `get_user_role()` that returns the current user's role

#### [NEW] [schema_v2_roles.sql](file:///d:/CEMARA/schema_v2_roles.sql)

Migration script to upgrade existing database from v1 → v2 (adds roles, profiles).

---

### Component 2: Admin GUI Page

#### [NEW] [admin/index.html](file:///d:/CEMARA/admin/index.html)

Standalone admin page with premium dark-themed UI:
- **Sidebar navigation** with role-aware menu items
- **Dashboard** — Stats cards (total works, users, comments, recent activity)
- **User Management** panel (Super Admin only) — View all users, change roles, delete accounts
- **Works Management** panel (Admin+) — List/edit/delete all works
- **Comments Management** panel (Admin+) — Moderate all comments
- **Profile Settings** panel (all roles) — Edit display name, bio, upload avatar
- **Site Settings** panel (Super Admin + Dev) — Config, dev tools, storage info

#### [NEW] [admin/admin.js](file:///d:/CEMARA/admin/admin.js)

JavaScript for the admin page:
- Role-based feature gating — hides/shows panels based on user role
- CRUD operations for users, works, comments
- Avatar upload to Supabase Storage
- Dashboard stats fetching
- Real-time updates via Supabase subscriptions

#### [NEW] [admin/admin.css](file:///d:/CEMARA/admin/admin.css)

Premium dark-mode admin stylesheet:
- Glassmorphism sidebar
- Animated stat cards
- Data tables with hover effects
- Profile card with avatar
- Responsive layout

---

### Component 3: Profile System Integration

#### [MODIFY] [app.js](file:///d:/CEMARA/app.js)

- Update `adminCheck()` → `roleCheck()` — fetch role from `user_profiles`
- Update `authUI()` — show profile picture and role badge
- Update `renderUploadUI()` — check for `admin` or `super_admin` role
- On registration, auto-create `user_profiles` row with role `'user'`

#### [MODIFY] [reader.js](file:///d:/CEMARA/reader.js)

- Update `adminCheck()` → use the new role system
- Show user avatar next to comments

---

### Component 4: Shared Utilities

#### [NEW] [shared.js](file:///d:/CEMARA/shared.js)

Extract duplicated code from `app.js` and `reader.js`:
- `esc()`, `toast()`, `normalizeImages()`, `formatDate()`
- New `roleCheck()` function
- New `getProfile()` function

---

### Component 5: Project Hygiene

#### [NEW] [.gitignore](file:///d:/CEMARA/.gitignore)

```
config.js
node_modules/
.DS_Store
```

#### [MODIFY] [reader.html](file:///d:/CEMARA/reader.html)

- Add missing `</head>` tag
- Move scripts to end of `<body>`

---

## Verification Plan

### Manual Verification

1. **Register a new user** → confirm `user_profiles` row is created with role `'user'`
2. **Login as Super Admin** → verify all panels visible in admin GUI
3. **Login as Admin** → verify User Management panel is hidden
4. **Login as Dev** → verify only Dashboard + Profile + Dev Tools visible
5. **Login as User** → verify only Profile panel visible, redirected from admin page
6. **Upload avatar** → confirm image appears in profile and comments
7. **Change user role** (as Super Admin) → confirm permissions update immediately
8. **Open admin page on mobile** → verify responsive layout works
9. **Test dark/light mode** on admin page
10. **Check schema migration** — run `schema_v2_roles.sql` on existing database, verify no data loss
