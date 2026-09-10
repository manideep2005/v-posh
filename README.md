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
