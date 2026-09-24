# POSH Awareness & Complaint Management Platform

A production-oriented institutional platform for raising, tracking, and resolving
POSH (Prevention of Sexual Harassment) complaints — built for a college/university
Internal Complaints Committee (ICC) workflow.

## Stack

- **Backend:** Node.js + Express, JWT authentication, MongoDB Atlas persistence
  (`server/db.js` exposes a small collection API; a zero-setup JSON-file engine is
  used automatically as a fallback when no `MONGODB_URI` is configured).
- **Frontend:** React 18 + Vite single-page application with role-based route groups
  (Student / Admin / Super Admin) sharing one design system.

## Getting started

```bash
npm install
npm run seed     # provision demo accounts + sample complaints
npm run dev      # server on :5001, client on :5173
```

Demo accounts created by the seed script (passwords are printed by the seeder):

| Role        | Email                              |
| ----------- | ---------------------------------- |
| Student     | `student@student.vitap.ac.in`      |
| ICC Admin   | `presiding.officer@vitap.ac.in`    |
| Super Admin | `superadmin@vitap.ac.in`           |

> Seed credentials are for development only. Configure `JWT_SECRET` and provision
> real accounts through the Super Admin portal before any real deployment.

## Environment

Copy `.env.example` to `.env` and set at minimum:

- `MONGODB_URI` — MongoDB Atlas connection string
  (`mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0`)
- `MONGODB_DB_NAME` — database name (default: `posh_platform`)
- `JWT_SECRET` — long random string used to sign session tokens
- `APP_BASE_URL` — public base URL used in password-reset links
- `CORS_ORIGINS` — comma-separated list of allowed frontend origins

If `MONGODB_URI` is missing or unreachable, the server automatically falls back to
a local JSON file store (`server/data/db.json`) so development never blocks.

Frequently queried fields are indexed (email, studentId, referenceId, userId,
status, assignedAdminId, complaintId, createdAt) on first boot.

## Email notifications

Every transactional email is sent from one Google Workspace mailbox
(`SMTP_USER`, default `vposh@vitap.ac.in`) through `server/services/email.js`.
Set `SMTP_PASS` to a **16-character Google App Password** — Google removed
"Less secure app access", so an app password is the only way an account can
speak SMTP. App passwords require 2-Step Verification on the mailbox, and on a
managed domain (`vitap.ac.in`) the Workspace admin must also allow them
(Admin console → Security → Authentication → 2-Step Verification). If
<https://myaccount.google.com/apppasswords> reports *"The setting you are
looking for is not available for your account"*, app passwords are disabled for
that account — get IT to enable them, or switch the transport to the Gmail API
with a service account (domain-wide delegation) or a transactional provider.

Without `SMTP_PASS` the layer degrades to console logging, so development and
demos never block on mail credentials.

### Service catalogue (15 switchable email services)

| Key | Sent to | Trigger |
| --- | --- | --- |
| `complaint_acknowledgement` | Complainant | Complaint registered |
| `new_complaint_alert` | ICC mailbox + active officers | Any new complaint (student or faculty-filed) |
| `case_assigned` | Assigned officer | Manual, reassigned, bulk (single digest) or auto allocation |
| `status_update` | Complainant | Status changed |
| `resolution_summary` | Complainant | Status set to `Resolved` |
| `feedback_request` | Complainant | After a case is resolved |
| `official_update` | Complainant | Public update posted by the ICC |
| `sla_warning` | Assigned officer | Deadline within 48h (max one per case per 24h) |
| `sla_breach_alert` | Officer + super admins | SLA deadline breached |
| `statutory_escalation` | Officer → ICC → super admins | L1/L2/L3 statutory escalation ladder |
| `password_reset` | Any user | Forgot-password request (single-use, 30 min) |
| `account_provisioned` | New user | Admin/faculty provisioned or student self-registration |
| `account_status_changed` | Affected user | Account activated or deactivated |
| `security_alert` | Affected user | Password changed or reset |
| `faculty_filed_on_behalf` | Student named in the case | Faculty files a complaint for a student |

Silence individual services without a deploy with
`EMAIL_SERVICES_DISABLED="sla_warning,feedback_request"`. `EMAIL_DRY_RUN=true`
renders every message to the console instead of sending it, which is the safest
way to demo the flows.

Accounts created before this layer existed can be welcomed with
`npm run welcome` — it is dry-run by default, skips anyone already welcomed (so
re-running can never double-send), caps each run below Gmail's daily limit and
aborts after three consecutive failures. See `docs/email-notifications.md`,
section 5b.

### Delivery record and diagnostics

Each attempt is written to the `email_log` collection (service, recipient,
status `sent`/`failed`/`suppressed`/`logged`, message id, error). Sends are
serialized with a minimum gap and retried once on transient failures, because
Gmail throttles burst senders.

With `MAINTENANCE_TOKEN` (or any non-production run) configured:

```bash
# Does the mailbox authenticate? (no message sent)
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<host>/api/maintenance/email/verify

# Send a real test message (defaults to SMTP_USER)
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" "https://<host>/api/maintenance/email/test?to=you@vitap.ac.in"

# List the catalogue and which services are switched on
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<host>/api/maintenance/email/services
```

## Security notes

- Evidence files are **never** served statically; downloads go through an
  authenticated, access-checked endpoint (`/api/attachments/:id/file`).
- Authorization is enforced server-side on every route (JWT + role checks +
  ownership checks); frontend route guards are a UX layer only.
- Login, signup, and password-reset endpoints are rate-limited.
- Internal ICC notes are filtered out of every student-facing API response.
- Password reset uses single-use hashed tokens with a 30-minute expiry.

## Scripts

| Command        | Purpose                                    |
| -------------- | ------------------------------------------ |
| `npm run dev`  | Run API server + Vite dev server together  |
| `npm run server` | Run API server only                      |
| `npm run client` | Run Vite dev server only                 |
| `npm run build`  | Build the production client bundle       |
| `npm start`      | Serve the API + built client from :5001  |
| `npm run seed`   | Reset and reseed the database (MongoDB if configured) |
| `npm run welcome` | Welcome-mail backfill for existing accounts (dry run; add `-- --send` to deliver) |

## Deploying to Vercel

The repository is Vercel-ready: the client is served from the CDN and the API
runs as a serverless function behind the same domain (`/api/*` rewrites to the
`api/index.js` entry). Evidence files are stored in **MongoDB GridFS**, so no
persistent disk is required.

1. Push this repo to GitHub (already done) and import it in Vercel
   (**Add New → Project**). No framework preset needed — `vercel.json`
   defines install/build/output.
2. Add environment variables (Project → Settings → Environment Variables):

   | Variable | Value |
   | -------- | ----- |
   | `MONGODB_URI` | your Atlas connection string |
   | `MONGODB_DB_NAME` | `posh_platform` |
   | `JWT_SECRET` | **a fresh long random string** (never reuse the dev value) |
   | `JWT_EXPIRES_IN` | `24h` |
   | `APP_BASE_URL` | your final production URL (e.g. `https://v-posh.vercel.app`) — optional; reset links otherwise derive from the request host |
   | `CORS_ORIGINS` | only needed if you host the frontend on a *different* domain than the API |
   | `SMTP_USER` | `vposh@vitap.ac.in` — the sending mailbox |
   | `SMTP_PASS` | 16-character Google **App Password** for that mailbox |
   | `ICC_NOTIFICATION_EMAIL` | `vposh@vitap.ac.in` — receives new-complaint / breach copies |
   | `EMAIL_LINK_BASE_URL` | optional; base URL for deep links inside emails |

3. Deploy. First boot creates indexes and bootstraps departments/categories.
4. Seed the demo/institutional accounts **once**, from your machine against
   the same Atlas database:
   ```
   npm run seed
   ```
   Then change the seeded passwords immediately via the app or by provisioning
   real accounts in the Super Admin portal.

Notes:

- MongoDB Atlas connection strings require `mongodb+srv://` support — Vercel's
  Node runtime supports this out of the box.
- PDF generation (`pdfkit`) loads its standard font metrics through dynamic
  `require` calls inside the package, which Vercel's file tracer cannot follow.
  `vercel.json` therefore pins them with
  `functions["api/index.js"].includeFiles: "node_modules/pdfkit/**"`. Keep that
  entry when editing the config — without it, acknowledgement / status-report
  downloads fail with a 500 in production while working locally.
- For a long-running host instead (Render/Railway/VPS), use
  `npm start` (`node server/index.js`), which serves both the API and the
  built client from one process.

## Project structure

```
api/
  index.js            Vercel serverless entry (wraps server/app.js)
server/
  app.js              Express app: middleware, routes, SPA serving, errors
  index.js            Long-running bootstrap: DB init + app.listen
  config.js           Environment-driven configuration
  db.js               Collection layer over the JSON store
  seed.js             Development data seeder
  middleware/         auth (JWT + RBAC), audit logging, rate limiting
  routes/             auth, student, admin, superAdmin, uploads, attachments,
                      notifications, awareness
client/
  src/components/     Header, Footer, ProtectedRoute, StatusBadge, Timeline,
                      NotificationBell, AttachmentList
  src/context/        AuthContext (session bootstrap, login/logout)
  src/pages/          Landing, Awareness, auth/, student/, admin/, superAdmin/
```
