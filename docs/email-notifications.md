# V-POSH Email System — Implementation Record

Status: **live and sending from `vposh@vitap.ac.in`** as of 24 Sep 2026.
Scope: every transactional email the ICC portal produces, the credential behind it,
where each message is triggered, how delivery is recorded, and what the platform
can realistically carry at 10,000+ students.

---

## 1. Live status

| Item | State |
| --- | --- |
| Sending mailbox | `vposh@vitap.ac.in` (Google Workspace) |
| Transport | SMTP, `smtp.gmail.com:465`, implicit TLS (`SMTP_SECURE=true`) |
| Credential | 16-character Google **App Password**, verified live against Gmail |
| Verification result | raw TLS probe: `AUTH LOGIN` → `235 Accepted`, `DATA` → `250 OK`. nodemailer path: `verifyTransport().ok = true` and a real message delivered with message id `<f5a12723-…@vitap.ac.in>` |
| Verified with | both a dependency-free SMTP probe and the production nodemailer transport |
| Local config | `SMTP_USER` / `SMTP_PASS` / `ICC_NOTIFICATION_EMAIL` appended to `.env` (gitignored) |
| From header | `V-POSH ICC · VIT-AP <vposh@vitap.ac.in>` |
| Reply-To | `vposh@vitap.ac.in` |

> **Do not put the app password in `.env.production`** — that file is tracked in
> git, so the secret would be committed. Production reads it from Vercel's
> environment variables (Project → Settings → Environment Variables).

---

## 2. Why `myaccount.google.com/apppasswords` showed an error

The page reported *"The setting you are looking for is not available for your
account."* Google shows that generic message when any of these is true:

1. **2-Step Verification is off** for the mailbox — app passwords only exist
   after 2SV is enabled.
2. **The Workspace admin disabled it.** On a managed domain (`vitap.ac.in`) IT
   controls Admin console → Security → Authentication → 2-Step Verification →
   *"Allow users to turn on 2-Step Verification"*.
3. **2SV is enforced as security-key-only** — app passwords are blocked by design.
4. The account is in the **Advanced Protection Program**, or is otherwise
   restricted by an admin.

The credential that is now working was generated despite that page, so the
mailbox is eligible. If it ever needs regenerating and the page refuses again,
ask VIT-AP IT to enable app passwords for `vposh@vitap.ac.in`.

Context worth knowing: Google removed "Less secure app access" in 2024, so a
Google account **cannot** do plain SMTP with its account password any more — an
app password (or OAuth/Gmail API) is the only route.

---

## 3. Architecture

```
server/services/email.js      the whole mail layer (transport, catalogue, logging)
server/config.js              SMTP_* / EMAIL_* configuration
server/db.js                  `email_log` collection + indexes
server/routes/maintenance.js  diagnostics endpoints (verify / test / services)
```

Every call site uses one dispatch function:

```js
sendService('status_update', { to, data: {...}, meta: { complaintId } });
```

Guarantees built into the layer:

| Guarantee | Implementation |
| --- | --- |
| Never blocks startup | missing `SMTP_PASS` → console logging, no crash |
| Never throws at call sites | returns `{ success, messageId }` or `{ success: false, error }` |
| Never bursts Gmail | sends are serialized with `EMAIL_MIN_SEND_GAP_MS` between them |
| Survives transient failures | one retry on `ECONNRESET` / `421` / `450` / `451` / `4.7.x` / throttle |
| Safe for serverless | `flushPendingSends()` drains the queue before a cron handler returns |
| No HTML injection | all interpolated user data is escaped (`title`, `comment`, `updateText`…) |
| Spam-filter friendly | every message ships an HTML **and** a plain-text body |
| Auditable | every attempt written to `email_log` |
| Switchable per service | `EMAIL_SERVICES_DISABLED="sla_warning,feedback_request"` |
| Demo-safe | `EMAIL_DRY_RUN=true` renders to console instead of sending |

---

## 4. The 15 email services

| # | Service key | Sent to | Trigger |
| --- | --- | --- | --- |
| 1 | `complaint_acknowledgement` | Complainant | Complaint registered |
| 2 | `new_complaint_alert` | ICC mailbox + all active officers | Any new complaint |
| 3 | `case_assigned` | Assigned officer | Allocation, reassignment, auto-allocation, bulk (single digest) |
| 4 | `status_update` | Complainant | Status changed |
| 5 | `resolution_summary` | Complainant | Status set to `Resolved` |
| 6 | `feedback_request` | Complainant | After resolution (anonymous survey) |
| 7 | `official_update` | Complainant | Public update posted by the ICC |
| 8 | `sla_warning` | Assigned officer | Deadline within 48 h (max once per case per 24 h) |
| 9 | `sla_breach_alert` | Officer + super admins + ICC mailbox | SLA deadline breached |
| 10 | `statutory_escalation` | Officer → ICC → super admins | L1 / L2 / L3 statutory ladder |
| 11 | `password_reset` | Any user | Forgot-password request (single-use, 30 min) |
| 12 | `account_provisioned` | New user | First-time signup **or** admin-provisioned account |
| 13 | `account_status_changed` | Affected user | Account activated / deactivated |
| 14 | `security_alert` | Affected user | Password changed or reset |
| 15 | `faculty_filed_on_behalf` | Student named in the case | Faculty files a complaint for a student |

Wiring (25 send points across 8 files):

| File | Services wired |
| --- | --- |
| `routes/student.js` | 1, 2 |
| `routes/faculty.js` | 2, 15 |
| `routes/admin.js` | 2, 3, 4, 5, 6, 7, 13 |
| `routes/auth.js` | 11, 12, 14 |
| `routes/superAdmin.js` | 12, 13 |
| `services/sla.js` | 8, 9 |
| `services/escalation.js` | 10 |
| `routes/maintenance.js` | diagnostics only |

---

## 5. Welcome email on first signup

Service 12 doubles as the welcome message. `welcome: true` switches it to the
warmer variant — *"Welcome to V-POSH · VIT-AP"*, an explanation of what the
portal does, and a CTA straight to the dashboard. Admin-provisioned accounts get
the more formal *"Your ICC portal account is ready"* wording instead.

It fires **only** from the `if (!user)` first-time provisioning branch of each
handler, so a returning user never gets a second welcome mail:

| Signup path | Handler | `createdBy` recorded |
| --- | --- | --- |
| Email + password | `POST /api/auth/student/signup` | Self-registration |
| Google SSO | `POST /api/auth/google` | Google SSO sign-in |
| Google (access variant) | `POST /api/auth/google-access` | Google SSO sign-in |
| KratosID push | `POST /api/auth/kratosid/verify` | KratosID passwordless sign-in |
| KratosID push poll | `POST /api/auth/kratosid/push/poll` | KratosID push approval |
| KratosID QR | `POST /api/auth/kratosid/qr/poll` | KratosID QR sign-in |
| Admin/faculty provisioned | `POST /api/superAdmin/admins`, `POST /api/admin/faculty` | Super Admin / ICC Admin |

Credentials are deliberately **never** emailed: the provisioning officer hands
them over out of band, and the mail says so.

### Backfilling accounts that predate the welcome mail

`server/send-welcome.js` (also `npm run welcome`) delivers the welcome mail to
accounts that already existed. It is dry-run by default, idempotent, and capped.

```bash
npm run welcome                                  # dry run: list who would get it
npm run welcome -- --send                        # deliver (max 1800, the Gmail daily cap)
npm run welcome -- --send --limit=500            # first 500 of a larger backlog
npm run welcome -- --send --roles=student        # students only
npm run welcome -- --send --only=a@vitap.ac.in   # single-recipient test
npm run welcome -- --all --send                  # force a re-send to everyone
```

How it stays safe:

- **dry run unless `--send`** — no accidental blasts
- **idempotent** — anyone with an `email_log` row `{ service: 'account_provisioned',
  meta.welcome: true }` (matched by user id *or* address) is skipped, so a partial
  or interrupted run is resumed simply by re-running the same command
- **refuses to send** when `SMTP_PASS` is missing, instead of silently logging
- **aborts after 3 consecutive failures**, so a bad credential or throttle cannot
  burn the day's quota; the failures are listed at the end
- **caps at 1800/run** to stay under Gmail's ~2,000/day suspension threshold, and
  reports how many recipients are still owed

First run against the live database (24 Sep 2026): 9 accounts total, 5 were
admin/super_admin (skipped by the default role filter), **4 delivered, 0 failed**,
and a repeat dry run reported `Already welcomed: 4 — Backlog: 0`.

---

## 6. Delivery record

New `email_log` collection (MongoDB `email_log`, JSON fallback `email_log`):

```js
{
  id, createdAt,
  service: 'status_update',            // service key, or 'smtp_test' / null
  to: 'student@vitapstudent.ac.in',
  cc, subject,
  status: 'sent' | 'failed' | 'suppressed' | 'logged' | 'dry_run',
  messageId, error, attempts,
  meta: { complaintId, userId, level, welcome }
}
```

`status` semantics:

- `sent` — accepted by Gmail (has `messageId`)
- `failed` — smtp rejected after retries (has `error`)
- `suppressed` — `EMAIL_ENABLED=false` or the service is in `EMAIL_SERVICES_DISABLED`
- `logged` — no `SMTP_PASS` configured; rendered to the console instead
- `dry_run` — `EMAIL_DRY_RUN=true`

The log is also the dedupe source for `sla_warning` (one warning per case per 24 h),
which is why `meta.complaintId` is always populated.

---

## 7. Operations

Diagnostics (need `MAINTENANCE_TOKEN`, or any non-production run):

```bash
# Authenticate against Gmail — sends nothing
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<host>/api/maintenance/email/verify

# Send a real test message (defaults to SMTP_USER)
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" "https://<host>/api/maintenance/email/test?to=you@vitap.ac.in"

# List the catalogue and which services are on
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<host>/api/maintenance/email/services

# Run the deadline sweeps (SLA warnings/breaches + statutory staircase)
curl -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<host>/api/maintenance/escalate
```

The hourly deadline sweep is now live in two places:

- **Long-running host** — `setInterval` in `server/index.js` (runs SLA + escalation every 60 min).
- **Vercel** — `GET /api/maintenance/escalate` (currently cronned daily at 03:00 UTC; hourly is
  recommended, and `functions["api/index.js"].maxDuration` is 30 s — raise it to 60 s if the
  sweeps have many recipients).

Environment variables — full reference is in `.env.example`:

| Variable | Meaning |
| --- | --- |
| `SMTP_USER` / `SMTP_PASS` | sending mailbox + app password |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | defaults `smtp.gmail.com` / `465` / `true` |
| `SMTP_FROM` / `SMTP_FROM_NAME` / `SMTP_REPLY_TO` | envelope identity |
| `ICC_NOTIFICATION_EMAIL` | mailbox that receives new-complaint and breach copies |
| `EMAIL_ENABLED` | master kill switch |
| `EMAIL_DRY_RUN` | render to console, send nothing |
| `EMAIL_LOG_ENABLED` | write `email_log` rows |
| `EMAIL_SERVICES_DISABLED` | comma-separated service keys to silence |
| `EMAIL_LINK_BASE_URL` | base URL for deep links (defaults to `APP_BASE_URL`) |
| `EMAIL_MIN_SEND_GAP_MS` | pacing between sends (default 300) |
| `EMAIL_SEND_ATTEMPTS` | attempts per message (default 2) |

---

## 7b. Restart required after changing `.env`

`.env` is read once at process boot, so a running dev server keeps the old
values. After adding `SMTP_PASS`, restart it:

```bash
# stop the running pair (npm run dev)
# then
npm run dev
```

You can confirm the running server sees the credential by hitting
`/api/maintenance/email/verify` — it reports `configured: true/false`.

---

## 8. Capacity — will this handle 10,000+ students?

**Short answer:** yes for the transactional mail this portal actually generates;
**no** for a mass mailing to all 10,000, and that limitation is Google's, not
nodemailer's.

### Google Workspace limits (per user, rolling 24 h — from Google's own admin docs)

| Limit | Value |
| --- | --- |
| Messages per day, per user | **2,000** (1,500 mail-merge, 500 trial) |
| Total recipients per day | 10,000 |
| Unique recipients per day | 3,000 (2,000 external) |
| External recipients per day | 3,000 |
| Recipients per message sent over SMTP | **100** |
| Attachment size | 25 MB (Education) |

Exceeding any of these suspends **outbound sending for up to 24 hours** — which
on this platform would simultaneously break password resets and complaint
notifications. That is the real risk to protect against, and it is exactly why
the layer paces sends and retries instead of blasting.

### What the portal actually sends

Emails are event-driven, not broadcast. One complaint produces roughly 6–10
messages over its whole life (acknowledgement, assignment, each status change,
official updates, closure, feedback invite). One new student produces exactly
one welcome mail.

| Scenario | Messages |
| --- | --- |
| 50 new students sign up in a day | 50 |
| 30 active cases × 3 status changes | ~90 |
| SLA warnings + escalations | handful |
| Typical day | **well under 300** |
| Very heavy day (500 signups + 100 cases) | ~1,500 — still inside the 2,000/day cap |

**Verdict:** a single Gmail mailbox comfortably carries this workload, and using
a real institutional mailbox is an advantage — replies land in the ICC inbox
(`Reply-To: vposh@vitap.ac.in`), and deliverability to `@vitapstudent.ac.in`
is excellent because it is the same domain.

### Where it breaks

| Workload | Verdict |
| --- | --- |
| Case / account notifications (this system) | ✅ Gmail SMTP is the right tool |
| Welcome mail at the start of a semester (2,000–4,000 signups within days) | ⚠️ will hit the 2,000/day cap — needs throttling across days or a provider |
| "POSH awareness week" blast to all 10,000 students | ❌ impossible via this mailbox, and attempting it risks a 24 h suspension |
| Bulk PDF reports to every department | ❌ same |

### Recommendation when bulk mail becomes a requirement

Keep Gmail SMTP for transactional ICC correspondence, and add a transactional
provider (**Amazon SES**, **Resend**, **Brevo**, **SendGrid**) as a second
transport for bulk/announcement mail:

- SES/Resend cover 10,000+ sends/day at negligible cost, with bounce/complaint
  webhooks and a real sending reputation separate from the ICC mailbox.
- The code is already shaped for this: the transport is isolated in
  `getTransporter()`, so a provider SDK or API call drops in behind the same
  `sendService()` API without touching a single call site.
- Bulk mail must be **queued and paced**, not looped inside one request. Vercel
  functions here are capped at 30 s (`vercel.json`), so 10,000 sends would need
  a queue (QStash / SQS) or a cron-driven batch worker draining ~200 per minute.
- Bulk mail belongs on a subdomain (`mail.vitap.ac.in`) with its own SPF, DKIM
  and DMARC to protect the reputation of the primary domain.

### About nodemailer specifically

nodemailer is not the bottleneck. It is an SMTP client: with connection pooling
it can push hundreds of messages a minute, and it is the standard choice for
exactly this workload. The constraint is Google's per-mailbox quota plus the
sending reputation of that one mailbox, which no client library can sidestep.

---

## 8b. Vercel deployment checklist

Code changes already made for the serverless runtime:

| Change | Why |
| --- | --- |
| Connection pooling is disabled when `VERCEL` / `AWS_LAMBDA_FUNCTION_NAME` / `NETLIFY` is set (`config.IS_SERVERLESS`) | a frozen lambda can leave a dead pooled socket behind; per-send handshakes are safer |
| `server/app.js` holds the response until the mail queue drains, serverless only, and only when mail is actually queued | route handlers dispatch emails without awaiting them, and a lambda is frozen the instant it responds — without this, notices would be silently truncated |
| `package.json` engines raised to `node >=20` | nodemailer 10.0.9 requires Node 20+; the old `>=18` would install on an unsupported runtime |
| `vercel.json` `maxDuration` 30 → 60 | the deadline sweeps send mail before returning |
| `nodemailer` needs no `includeFiles` entry | v10 is zero-dependency, ships pre-bundled CJS, and contains no `fs` access (unlike pdfkit, which genuinely needed tracing help) |

Environment variables the deployment needs (Project → Settings → Environment Variables):

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI`, `MONGODB_DB_NAME` | yes | persistence + `email_log` |
| `JWT_SECRET` | yes | fresh value for production |
| `SMTP_USER` | yes | `vposh@vitap.ac.in` |
| `SMTP_PASS` | yes | the app password |
| `ICC_NOTIFICATION_EMAIL` | recommended | `vposh@vitap.ac.in` |
| `CRON_SECRET` | **yes** | Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without it every maintenance call is refused with 401 and **the deadline sweeps never run** |
| `EMAIL_LINK_BASE_URL` | recommended | production domain, so email links point at the live site |
| `APP_BASE_URL` | recommended | password-reset links |
| `GOOGLE_CLIENT_ID` | if using SSO | Google sign-in |
| `MAINTENANCE_TOKEN` | optional | alternative to `CRON_SECRET` for manual `curl` calls |

Also set the Vercel project's **Node.js version to 20.x or 22.x** to match `engines`.

The `email_log` indexes are created on first boot (`createdAt`, `service`).

Cron: `vercel.json` currently schedules `/api/maintenance/escalate` **daily at 03:00 UTC**.
That endpoint now runs both sweeps (SLA warnings/breaches, then the statutory ladder).
Daily is the Hobby-plan limit — on Pro, change the schedule to hourly
(`"0 * * * *"`) to match the in-process timer.

> Do **not** put `SMTP_PASS` in `.env.production` — that file is tracked in git. Its
> current contents are all empty placeholders (`''`), so nothing has leaked; keep it
> that way.

---

## 9. Verification performed

| Check | Result |
| --- | --- |
| `node --check` on every touched file (12 files) | clean |
| All 15 services rendered with representative data | 15/15, no leaked `undefined` / `NaN` / `[object Object]` |
| HTML escaping with `<script>` input | escaped in HTML output |
| Plain-text body generated for every service | yes, multi-line |
| Send path with a live-style transport | `sendMail` called, `messageId` returned |
| Disabled service | skipped + logged as `suppressed` |
| Unknown service key | refused safely, no throw |
| Missing recipient | refused safely, no throw |
| Batch of 3 sends | serialized — max 1 concurrent connection, gap respected |
| `flushPendingSends()` | drained the queue before returning |
| Delivery log against the JSON engine | `sent` and `suppressed` rows written with `meta.complaintId` |
| **Live Gmail authentication** (raw TLS SMTP probe) | `235 Accepted`, `250 OK` — real message delivered to `vposh@vitap.ac.in` |
| **Live nodemailer send** (`sendTestEmail`) | `{"success":true,"messageId":"<f5a12723-…@vitap.ac.in>"}` |
| `verifyTransport()` against Gmail | `ok: true`, `smtp.gmail.com:465 as vposh@vitap.ac.in`, `from: V-POSH ICC · VIT-AP <vposh@vitap.ac.in>` |
| Serverless mode (`VERCEL=1`) | `IS_SERVERLESS: true`, transporter built with `pool: false` |
| Serverless response gating | a fire-and-forget send delayed the HTTP response by 309 ms and had completed before it was sent |
| Full app boot with `VERCEL=1` | `/api/health` → `online` / `mongodb`; `/api/maintenance/email/services` → 15 services; `/api/maintenance/email/verify` → `ok: true` |
| Welcome backfill against the live DB | 4 delivered / 0 failed, then `Already welcomed: 4 — Backlog: 0` on re-run |
| `email_log` after a real send | `sent | smtp_test | -> vposh@vitap.ac.in | <message-id>` |

---

## 10. Known limitations / next steps

1. A long-running Node process holding the nodemailer pool open will not exit on
   its own — call `process.exit()` in one-off scripts, or close the pool. This
   affects test scripts only, never the server.
2. `SMTP_PASS` must be added to Vercel's environment variables for production.
   The dev server must also be **restarted** after editing `.env` — the value is
   read once at boot.
3. The escalation cron is daily; hourly matches the in-process sweep.
4. There is no UI for the delivery log yet — `email_log` is queryable but not
   browsable, and services cannot be toggled without an env change and redeploy.
5. `EMAIL_LINK_BASE_URL` should be set to the production domain; it currently
   defaults to `https://v-posh.vercel.app`.
