# V-POSH Feature Roadmap

Improvement ideas for the V-POSH platform, grouped by who benefits and ordered by
value-per-effort. Everything here builds on what already exists — SLA escalation
cron, GridFS evidence storage, pdfkit document generation, the audit trail,
KratosID/QR/Google sign-in, announcements and the notification bell.

Legend: **P1** = do next, **P2** = high value, **P3** = nice to have.

---

## A. Compliance & legal defensibility

The single most valuable direction for a statutory platform: make every record
provable and every deadline visible.

| # | Feature | Why it matters |
| - | ------- | -------------- |
| A1 | **Statutory clock badges** on each case: 7-day acknowledgement, 90-day inquiry, 10-day ICC report, 60-day employer action, 90-day appeal window | POSH timelines are legally binding; today only a single SLA countdown exists |
| A2 | **Escalation ladder** — extend the existing hourly SLA cron to notify ICC → presiding officer → super admin as a deadline approaches, with a recorded escalation trail | Escalations currently exist but produce no accountability |
| A3 | **Two-way confidential messaging** between complainant and ICC, threaded per case | Students can only read one-way "public updates" today |
| A4 | **Support person / representative** assignment per case | POSH §13 grants the right to be accompanied; there is no field for it |
| A5 | **Tamper-evident audit ledger** — hash-chain each audit entry (`hash = H(prev_hash + payload)`) and expose a verify endpoint | Turns the audit trail into evidence that survives a legal challenge |
| A6 | **Watermarked downloads** — stamp every generated PDF and evidence file with viewer name, timestamp and document hash | Deterrence plus traceability when a confidential document leaks |
| A7 | **Inquiry workflow**: notice to respondent, reply window, hearing scheduling with quorum, minutes, conflict-of-interest declarations, recommendation → employer action → appeal register | The platform currently stops at status changes; the actual ICC procedure is missing |
| A8 | **Section 21 annual report generator** (District Officer format) + per-year export | Mandatory annual filing, currently manual |
| A9 | **Sealed/archived lifecycle instead of delete** with reason codes and legal-hold flag | Complaint records must not be hard-deleted; today `delete` is destructive |
| A10 | **Consent & confidentiality acknowledgements** captured at submission | Documents that the complainant understood the process |

## B. Student experience

| # | Feature | Why it matters |
| - | ------- | -------------- |
| B1 | **"What happens next" tracker** — current stage, who holds the case, what the clock says | Silence is the main source of distrust in grievance systems |
| B2 | **Privacy / quick-exit mode** — one tap blurs the screen and clears navigation traces | Users may be on a shared or monitored device |
| B3 | **Anonymous intake mode** — identity visible to the ICC only, masked everywhere else including PDFs | Removes the biggest barrier to reporting |
| B4 | **Draft autosave + guided incident timeline builder** | Complainants rarely write a perfect narrative in one sitting |
| B5 | **Evidence UX**: image/PDF preview, per-file captions, chronological evidence view | Uploading exists; reviewing what you uploaded does not |
| B6 | **Awareness learning module**: per-department courses, quizzes, completion %, completion certificate PDF | Reuses the existing Awareness page and PDF pipeline |
| B7 | **Support resources hub** — one-tap helpline, counsellor booking, "is this harassment?" explainer with examples | Immediate help at the moment of need |
| B8 | **Post-resolution feedback** (anonymous, aggregate only) | Feeds ICC performance metrics without identifying anyone |
| B9 | **PWA + offline awareness content + push notifications** | Students live on phones; email-only notifications get missed |
| B10 | **Language toggle (English / Hindi / Telugu)** | Institutional reach across the student body |

## C. Faculty

| # | Feature | Why it matters |
| - | ------- | -------------- |
| C1 | **Faculty-as-respondent integrity** — no self-review, mandatory conflict-of-interest declaration before opening a case | Faculty can be respondents; a fair process needs this |
| C2 | **Mandatory training compliance dashboard** per faculty member | POSH §19 requires awareness programmes; compliance is currently untracked |
| C3 | **Department climate pulse** — short confidential surveys ("would you know how to report?") with anonymised aggregates | Early signal of hostile environments before complaints surface |
| C4 | **Faculty raise-complaint parity** — same tracker, anonymity and evidence tools as students | The route exists but the experience is thinner than the student one |
| C5 | **Teaching-load aware assignment policy** for faculty who sit on the ICC | Prevents burning out the same committee members |

## D. ICC Admin

| # | Feature | Why it matters |
| - | ------- | -------------- |
| D1 | **Workload-aware auto-assignment** with skill and conflict constraints, explaining why an officer was suggested | Today assignment is fully manual |
| D2 | **Aging buckets & SLA dashboard** (0-7 / 8-30 / 31-90 / 90+ days) with breach reasons | Turns the workload page from descriptive to actionable |
| D3 | **Bulk actions + saved filter views + CSV export** of the complaint repository | 20 cases is fine by hand; 200 is not |
| D4 | **Note & decision templates** with a snippet library | Cuts drafting time and standardises language |
| D5 | **Hearing calendar, minutes and document templates** (notice, report, recommendation) | The paperwork is the slowest part of an ICC's week |
| D6 | **Related-case linking** (same respondent/department/pattern) under strict confidentiality | Repeat patterns are invisible in a flat list |
| D7 | **Internal SLA reasons** — record *why* a case aged (awaiting reply, evidence pending) | Makes the annual report meaningful |

## E. Super Admin & platform operations

| # | Feature | Why it matters |
| - | ------- | -------------- |
| E1 | **Analytics that answer questions**: time-to-resolution percentiles, department heatmap, category trends, caseload forecast, "unassigned > 24h" alert | The dashboard currently reports counts, not insight |
| E2 | **2FA + session/device management + IP allowlist** for admin and super admin, step-up auth for role changes | Highest-privilege accounts deserve more than a password |
| E3 | **Notification channels**: email (nodemailer is already wired), optional SMS/WhatsApp, digests, quiet hours | Status changes should not depend on someone opening the app |
| E4 | **Demo tenant isolation** — `npm run seed -- --demo` into a separate database/namespace, and refuse sample complaints in production mode | Directly prevents the mock-data-in-production problem |
| E5 | **Observability**: error tracking, structured request-id logs, uptime checks, alerting on 5xx rate | We debugged the PDF failure by inference; logs should answer this in one look |
| E6 | **CI + e2e smoke tests**, including generating both PDFs on every deploy | The PDF breakage was environment-specific; only a deploy-time smoke test catches that |
| E7 | **Backups + a rehearsed restore**, retention policy for audit logs | A statutory record store with no restore drill is a risk |
| E8 | **Audit log export** (signed CSV) + integrity verification button | Supervisors and auditors ask for this |
| E9 | **Accessibility pass** — WCAG AA, keyboard navigation, screen-reader labels, focus management | Public institutional platform, public obligations |
| E10 | **Upload hardening** — MIME sniffing, AV scanning, size quotas per user | Evidence uploads are an attack surface |
| E11 | **Feature flags** so a new workflow can ship dark and be rolled out per department | Safer releases for a platform used in live proceedings |

## F. Bold bets

| # | Feature | Why it matters |
| - | ------- | -------------- |
| F1 | **Voice-note intake** with on-device transcription and automatic name redaction | People narrate trauma far more easily than they type it |
| F2 | **ICC copilot** that drafts the inquiry report and recommendation from case history, under confidentiality controls | Removes hours of drafting while keeping humans in the loop |
| F3 | **Public verification page** that resolves scanned document IDs + tokens | The QR code currently resolves cases, not the document itself |
| F4 | **WhatsApp status bot** with OTP verification | Meets students where they already are |
| F5 | **Anonymous department pulse surveys** feeding a climate-risk heatmap | Prevention, which is the actual point of the Act |

## If you build only five

1. **A1 + A2** — statutory clocks with escalation. Compliance is the platform's reason to exist.
2. **A3 + A4** — two-way confidential messaging and support persons. Directly required by the Act.
3. **A5 + A6** — hash-chained ledger and watermarked documents. Turns the system into admissible evidence.
4. **A8 + E1** — annual report generator and real analytics. Saves the ICC weeks per year.
5. **E4 + E6** — demo tenant isolation and a deploy-time smoke test. Keeps production clean and catches environment-specific breakage.
