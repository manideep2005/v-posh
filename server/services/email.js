/**
 * Email service layer.
 *
 * One Gmail/Workspace mailbox (`SMTP_USER`, default `vposh@vitap.ac.in`) sends
 * every transactional message the ICC portal produces. The module exposes:
 *
 *   sendEmail({ to, subject, html, text })   — low-level, never throws
 *   sendService('status_update', { to, data }) — catalog dispatcher
 *   getCatalog()                             — every email service + its state
 *   verifyTransport() / sendTestEmail(to)    — SMTP health checks
 *
 * Behaviour guarantees:
 *   - Missing SMTP_PASS degrades to console logging instead of crashing startup,
 *     so local development never blocks on mail credentials.
 *   - Sends are serialized with a minimum gap and one retry on transient SMTP
 *     errors, because Gmail throttles burst senders (421 / "Too many messages").
 *   - Every attempt is written to the `email_log` collection, which gives the
 *     ICC a delivery record for statutory notices.
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const db = require('../db');

// ─── Brand + layout ─────────────────────────────────────────────────────────

const BRAND = {
  product: 'V-POSH',
  institution: 'VIT-AP University',
  cell: 'Internal Complaints Committee (ICC)',
};

const TONES = {
  info:     '#1E3A5F',
  success:  '#1B5E42',
  warning:  '#7A4500',
  critical: '#7B1D1D',
};

/** Escape interpolated values — titles and comments are user-supplied. */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Absolute link into the running app, for in-email calls to action. */
function appUrl(pathname) {
  const base = String(config.EMAIL_LINK_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return pathname || '';
  if (!pathname) return base;
  return `${base}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return String(value || '');
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' IST';
}

function rowsTable(rows) {
  if (!rows || !rows.length) return '';
  const cells = rows
    .filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== '')
    .map(([label, value], i) => `
              <tr style="background:${i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'};">
                <td style="padding:9px 14px; color:#4B5563; font-size:11px; font-weight:600; vertical-align:top; white-space:nowrap; text-transform:uppercase; letter-spacing:.04em; width:38%; border-right:1px solid #E5E7EB;">${esc(label)}</td>
                <td style="padding:9px 14px; color:#111827; font-size:13px; vertical-align:top;">${value}</td>
              </tr>`)
    .join('');

  if (!cells) return '';
  return `
          <div style="border:1px solid #D1D5DB; overflow:hidden; margin:18px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%;">
${cells}
            </table>
          </div>`;
}

function layout({ heading, tone = 'info', greeting, intro, rows, paragraphs = [], ctaLabel, ctaUrl, banner, footerNote }) {
  const accent = TONES[tone] || TONES.info;
  const paras = (intro ? [intro] : []).concat(paragraphs);
  const body = paras
    .map(p => `<p style="margin:0 0 14px; color:#374151; font-size:14px; line-height:1.75; font-family:Arial,Helvetica,sans-serif;">${p}</p>`)
    .join('');

  return `
    <div style="background:#F3F4F6; padding:28px 12px; font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:620px; margin:0 auto; background:#FFFFFF; border:1px solid #D1D5DB; border-top:5px solid ${accent};">

        <!-- Letterhead -->
        <div style="padding:24px 32px 20px; border-bottom:1px solid #E5E7EB;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle; width:64px; padding-right:14px;">
                <img src="${appUrl('/vit-ap-logo.png')}" alt="VIT-AP University" width="60" height="auto" style="display:block; max-height:52px; width:auto;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="color:#111827; font-size:15px; font-weight:700; letter-spacing:0.2px; font-family:Georgia,'Times New Roman',serif;">${esc(BRAND.institution)}</div>
                <div style="color:#6B7280; font-size:11.5px; margin-top:2px;">${esc(BRAND.cell)}</div>
              </td>
              <td style="vertical-align:top; text-align:right; padding-left:12px;">
                <div style="color:#9CA3AF; font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">OFFICIAL COMMUNICATION</div>
                <div style="color:#6B7280; font-size:11px; margin-top:3px;">${formatDate()}</div>
              </td>
            </tr>
          </table>
        </div>

        ${banner ? `<div style="background:${accent}; color:#FFFFFF; padding:8px 32px; font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${esc(banner)}</div>` : ''}

        <!-- Body -->
        <div style="padding:28px 32px 24px;">
          <h2 style="margin:0 0 20px; color:#111827; font-size:18px; font-weight:700; font-family:Georgia,'Times New Roman',serif; padding-bottom:12px; border-bottom:2px solid ${accent};">${esc(heading)}</h2>
          ${greeting ? `<p style="margin:0 0 16px; color:#1F2937; font-size:14px; font-family:Arial,Helvetica,sans-serif;">Dear <strong>${esc(greeting)}</strong>,</p>` : ''}
          ${body}
          ${rowsTable(rows)}
          ${ctaUrl ? `
          <div style="text-align:center; margin:28px 0 6px;">
            <a href="${esc(ctaUrl)}" style="display:inline-block; background:${accent}; color:#FFFFFF; text-decoration:none; padding:12px 30px; font-size:13px; font-weight:700; letter-spacing:.04em; font-family:Arial,Helvetica,sans-serif;">${esc(ctaLabel || 'Open the portal')}</a>
          </div>` : ''}
        </div>

        <!-- Footer -->
        <div style="background:#F9FAFB; border-top:1px solid #E5E7EB; padding:18px 32px; text-align:center;">
          <p style="margin:0 0 4px; color:#374151; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; font-family:Arial,Helvetica,sans-serif;">${BRAND.product} &mdash; ${esc(BRAND.institution)}</p>
          <p style="margin:0 0 8px; color:#6B7280; font-size:11px; font-family:Arial,Helvetica,sans-serif;">${esc(BRAND.cell)} &bull; vposh@vitap.ac.in</p>
          <p style="margin:0; color:#9CA3AF; font-size:10px; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">${esc(footerNote || 'This is an official communication from VIT-AP University. It is strictly confidential and intended solely for the named recipient. If received in error, please delete it and notify vposh@vitap.ac.in immediately.')}</p>
        </div>

      </div>
    </div>`;
}

function toPlainText({ heading, greeting, intro, rows, paragraphs = [], ctaLabel, ctaUrl, banner, footerNote }) {
  const lines = [];
  lines.push(`${BRAND.product} · ${BRAND.institution} — ${BRAND.cell}`);
  if (banner) lines.push(`** ${banner} **`);
  lines.push('', heading.toUpperCase());
  if (greeting) lines.push(`Dear ${greeting},`, '');
  if (intro) lines.push(stripTags(intro), '');
  for (const p of paragraphs) lines.push(stripTags(p), '');
  for (const [label, value] of rows || []) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`  ${label}: ${stripTags(value)}`);
  }
  if (rows && rows.length) lines.push('');
  if (ctaUrl) lines.push(`${ctaLabel || 'Open the portal'}: ${ctaUrl}`, '');
  lines.push(footerNote || 'Confidential. Intended only for the named recipient. If this was not meant for you, delete it and inform vposh@vitap.ac.in.');
  return lines.join('\n');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Turn a spec into the { subject, html, text } triple nodemailer wants. */
function render(spec) {
  return { subject: spec.subject, html: layout(spec), text: toPlainText(spec) };
}

// ─── Service catalog ────────────────────────────────────────────────────────
//
// Every key below is an independently switchable email service. Add
// EMAIL_SERVICES_DISABLED="sla_warning,feedback_request" to silence a subset
// without touching code.

const SERVICES = {
  // 1 ── Student submits a complaint
  complaint_acknowledgement: {
    label: 'Complaint Acknowledgement',
    description: 'Confirms registration and hands the student their reference ID and tracking link.',
    audience: 'Complainant (student)',
    trigger: 'Student submits a complaint',
    render: (d) => render({
      subject: `Complaint Registered — ${d.referenceId}`,
      heading: 'Complaint Successfully Registered',
      tone: 'success',
      greeting: d.studentName,
      intro: 'Your complaint has been officially registered with the Internal Complaints Committee (ICC). The reference ID below is what you should quote in every follow-up.',
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Category', esc(d.category)],
        ['Priority', esc(d.priority || 'Medium')],
        ['Status', 'Submitted'],
        ['Registered on', esc(d.submittedAt ? formatDate(d.submittedAt) : formatDate())],
      ],
      paragraphs: [
        'Your identity is kept confidential. Only ICC members handling this case can see the details you filed.',
        `Under the POSH Act, 2013 the committee aims to complete the inquiry within 90 days. You can follow every status change from your dashboard.`,
      ],
      ctaLabel: 'Track your complaint',
      ctaUrl: appUrl('/student/complaints'),
    }),
  },

  // 2 ── Any new complaint lands in the ICC queue
  new_complaint_alert: {
    label: 'New Complaint Alert',
    description: 'Tells the ICC committee that a new case is waiting for allocation.',
    audience: 'ICC members and super admins',
    trigger: 'Student or faculty files a complaint',
    render: (d) => render({
      subject: `[New Case] ${d.referenceId} — ${d.title}`,
      heading: 'A new complaint needs allocation',
      tone: 'info',
      greeting: d.officerName,
      intro: `A complaint was filed ${d.raisedByRole === 'faculty' ? 'by a faculty member on a student\u2019s behalf' : 'by a student'} and is waiting in the ICC queue.`,
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Category', esc(d.category)],
        ['Priority', esc(d.priority || 'Medium')],
        ['Filed by', `${esc(d.raisedByName || 'Student')} (${esc(d.raisedByRole || 'student')})`],
        ['Department', esc(d.department)],
        ['Filed on', esc(d.submittedAt ? formatDate(d.submittedAt) : formatDate())],
        ['SLA deadline', esc(d.slaDeadline || '48 hours for acknowledgement')],
      ],
      paragraphs: [
        'Allocate the case to an officer so the statutory acknowledgement clock starts on time.',
      ],
      ctaLabel: 'Open the allocation queue',
      ctaUrl: appUrl('/admin/allocation'),
    }),
  },

  // 3 ── Case allocated / reassigned
  case_assigned: {
    label: 'Case Assignment',
    description: 'Notifies the officer a case is now theirs (manual, reassignment, bulk or auto allocation).',
    audience: 'Assigned ICC officer',
    trigger: 'Case allocated, reassigned, bulk-allocated or auto-allocated',
    render: (d) => {
      // Bulk allocation passes `cases` so one officer gets a single digest
      // instead of one email per case (Gmail throttles burst senders).
      const bulk = Array.isArray(d.cases) && d.cases.length > 0;
      const total = bulk ? d.cases.length : 1;
      const caseRows = bulk
        ? d.cases.map(c => [c.referenceId, `${esc(c.title)} — ${esc(c.priority || 'Medium')} priority`])
        : [
          ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
          ['Title', esc(d.title)],
          ['Category', esc(d.category)],
          ['Priority', esc(d.priority || 'Medium')],
          ['Status', esc(d.status || 'Acknowledged')],
        ];

      return render({
        subject: bulk
          ? `${total} cases assigned to you — ${d.cases.map(c => c.referenceId).join(', ')}`
          : `Case Assigned to You — ${d.referenceId}`,
        heading: bulk ? `${total} new cases assigned to you` : 'New case assignment',
        tone: 'info',
        greeting: d.officerName,
        intro: `The following ${total > 1 ? 'complaints have' : 'complaint has'} been assigned to you${d.assignedBy ? ` by <strong>${esc(d.assignedBy)}</strong>` : ''}.`,
        rows: caseRows.concat([
          ['Allocation mode', esc(d.mode || 'Manual')],
          ['Statutory deadline', esc(d.slaDeadline || 'Acknowledgement due within 48 hours')],
        ]),
        paragraphs: [
          'Please review the case, record your first action in the workspace, and keep the timeline updated — every entry is written to the tamper-evident audit ledger.',
        ],
        ctaLabel: 'Open case workspace',
        ctaUrl: appUrl(d.casePath || '/admin/complaints'),
      });
    },
  },

  // 4 ── Status change
  status_update: {
    label: 'Status Update',
    description: 'Informs the complainant each time the case status moves.',
    audience: 'Complainant (student)',
    trigger: 'ICC officer changes complaint status',
    render: (d) => render({
      subject: `Complaint Status Updated — ${d.referenceId} (${d.newStatus})`,
      heading: 'Your complaint status has changed',
      tone: 'info',
      greeting: d.studentName,
      intro: 'The ICC committee has updated the status of your complaint.',
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Previous status', esc(d.previousStatus)],
        ['New status', `<strong>${esc(d.newStatus)}</strong>`],
        ['Updated by', esc(d.changedBy)],
        ['Updated on', esc(d.changedAt ? formatDate(d.changedAt) : formatDate())],
      ],
      paragraphs: d.comment ? [`<em style="color:#475569;">"${esc(d.comment)}"</em>`] : [],
      ctaLabel: 'View the case timeline',
      ctaUrl: appUrl(d.casePath || '/student/complaints'),
    }),
  },

  // 5 ── Case resolved: outcome summary
  resolution_summary: {
    label: 'Resolution Summary',
    description: 'Closes the loop with the outcome, duration and formal next steps.',
    audience: 'Complainant (student)',
    trigger: 'Case status set to Resolved',
    render: (d) => render({
      subject: `Case Resolved — ${d.referenceId}`,
      heading: 'Your complaint has been resolved',
      tone: 'success',
      greeting: d.studentName,
      intro: 'The Internal Complaints Committee has closed your complaint. The summary below is for your records.',
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Outcome', esc(d.outcome || 'Resolved — action completed')],
        ['Resolved by', esc(d.resolvedBy)],
        ['Resolved on', esc(d.resolvedAt ? formatDate(d.resolvedAt) : formatDate())],
        ['Time taken', esc(d.duration)],
      ],
      paragraphs: [
        'If you believe the resolution is inadequate, you may request a review through the ICC within the period stated in the institutional POSH policy. The portal also lets you share anonymous feedback about how the process treated you.',
      ],
      ctaLabel: 'View the case and share feedback',
      ctaUrl: appUrl(d.casePath || '/student/complaints'),
      footerNote: 'This summary is an institutional record of closure. Retain it for your reference. Confidential — ICC communication.',
    }),
  },

  // 6 ── Optional feedback nudge after closure
  feedback_request: {
    label: 'Feedback Request',
    description: 'Invites the complainant to submit anonymous post-case feedback.',
    audience: 'Complainant (student)',
    trigger: 'Sent after a case is resolved',
    render: (d) => render({
      subject: `How did we handle ${d.referenceId}?`,
      heading: 'Your feedback shapes how the ICC works',
      tone: 'info',
      greeting: d.studentName,
      intro: 'Your case is closed. The committee would value a short, fully anonymous survey — it is not linked to your name or complaint ID in any report.',
      rows: [
        ['Reference ID', esc(d.referenceId)],
        ['Survey length', '4 quick questions, about a minute'],
      ],
      paragraphs: ['Feedback is voluntary and never affects the outcome of a case.'],
      ctaLabel: 'Give anonymous feedback',
      ctaUrl: appUrl(d.feedbackPath || '/student/feedback'),
    }),
  },

  // 7 ── Public update from the committee
  official_update: {
    label: 'Official Update',
    description: 'Delivers a public update posted by an ICC member to the complainant.',
    audience: 'Complainant (student)',
    trigger: 'ICC member posts a public update on a case',
    render: (d) => render({
      subject: `Official Update — ${d.referenceId}`,
      heading: 'An official update was posted on your case',
      tone: 'info',
      greeting: d.studentName,
      intro: `<strong>${esc(d.authorName)}</strong> posted an official update visible to you.`,
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Posted by', esc(d.authorName)],
        ['Posted on', esc(d.postedAt ? formatDate(d.postedAt) : formatDate())],
      ],
      paragraphs: [
        `<div style="background:#FFFFFF; border-left:3px solid #0F172A; padding:12px 14px; border-radius:4px; color:#334155; font-size:14px;">${esc(d.updateText).replace(/\n/g, '<br>')}</div>`,
      ],
      ctaLabel: 'View the update thread',
      ctaUrl: appUrl(d.casePath || '/student/complaints'),
    }),
  },

  // 8 ── Deadline approaching
  sla_warning: {
    label: 'SLA Deadline Warning',
    description: 'Warns the assigned officer before a statutory deadline lapses.',
    audience: 'Assigned officer',
    trigger: 'Deadline within the warning window (default 48 hours)',
    render: (d) => render({
      subject: `[Deadline Soon] ${d.referenceId} — ${d.slaLabel} due in ${d.hoursRemaining}h`,
      heading: 'A statutory deadline is approaching',
      tone: 'warning',
      greeting: d.officerName,
      intro: `The ${esc(d.slaLabel)} deadline for this case falls within the next ${esc(d.hoursRemaining)} hours.`,
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Obligation', esc(d.slaLabel)],
        ['Deadline', esc(formatDate(d.deadline))],
        ['Current status', esc(d.status)],
      ],
      paragraphs: ['Record the pending action in the case timeline so the committee has an audit trail before the deadline lapses.'],
      ctaLabel: 'Act on this case',
      ctaUrl: appUrl(d.casePath || '/admin/complaints'),
    }),
  },

  // 9 ── Deadline breached
  sla_breach_alert: {
    label: 'SLA Breach Alert',
    description: 'Escalates a lapsed deadline to the officer and super admins.',
    audience: 'Assigned officer and super admins',
    trigger: 'Statutory deadline passes without the required action',
    render: (d) => render({
      subject: `[SLA Breached] ${d.referenceId} — ${d.slaLabel}`,
      heading: 'Statutory deadline breached',
      tone: 'critical',
      banner: `SLA BREACHED — ${d.slaLabel}`,
      greeting: d.recipientName,
      intro: 'This case has passed a deadline set by the POSH Act, 2013 and requires immediate action.',
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Obligation', esc(d.slaLabel)],
        ['Deadline was', esc(formatDate(d.deadline))],
        ['Overdue by', esc(d.overdueLabel || `${d.daysOverdue} day(s)`)],
        ['Assigned to', esc(d.assignedTo || 'Unassigned')],
        ['Current status', esc(d.status)],
      ],
      paragraphs: ['Every day past this deadline is reportable in the annual POSH compliance return. Open the workspace and record the action taken.'],
      ctaLabel: 'Open case workspace',
      ctaUrl: appUrl(d.casePath || '/admin/complaints'),
    }),
  },

  // 10 ── Statutory escalation ladder (L1–L3)
  statutory_escalation: {
    label: 'Statutory Escalation',
    description: 'The L1/L2/L3 escalation ladder for cases that breach statutory timelines.',
    audience: 'Officer, ICC committee, super admins (by level)',
    trigger: 'Escalation sweep finds a breached statutory milestone',
    render: (d) => render({
      subject: `[L${d.level} Escalation] ${d.referenceId} — ${d.reason}`,
      heading: `Level ${d.level} statutory escalation`,
      tone: d.level >= 3 ? 'critical' : d.level === 2 ? 'warning' : 'info',
      banner: `Level ${d.level} of ${d.levels || 3}`,
      greeting: d.recipientName,
      intro: 'A case in the ICC workspace has breached a milestone mandated by the POSH Act, 2013.',
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Breach', esc(d.reason)],
        ['Days overdue', esc(d.daysOverdue)],
        ['Current status', esc(d.status)],
        ['Assigned to', esc(d.assignedTo || 'Unassigned')],
        ['Escalated on', esc(d.escalatedAt ? formatDate(d.escalatedAt) : formatDate())],
      ],
      paragraphs: ['Record the corrective action in the case workspace. Escalation events are written to the tamper-evident audit ledger and surface in statutory reports.'],
      ctaLabel: 'Open the escalated case',
      ctaUrl: appUrl(d.casePath || '/admin/complaints'),
    }),
  },

  // 11 ── Password reset
  password_reset: {
    label: 'Password Reset',
    description: 'Sends a single-use reset link valid for 30 minutes.',
    audience: 'Any portal user',
    trigger: 'User requests a password reset',
    render: (d) => render({
      subject: 'Reset your V-POSH password',
      heading: 'Password reset requested',
      tone: 'warning',
      greeting: d.userName,
      intro: 'Use the button below to choose a new password. The link can be used once and expires shortly.',
      rows: [
        ['Requested from', esc(d.ip || 'unknown')],
        ['Requested on', esc(d.requestedAt ? formatDate(d.requestedAt) : formatDate())],
        ['Valid for', `${esc(d.expiresInMinutes || 30)} minutes`],
      ],
      paragraphs: ['If you did not request this, ignore this email — your current password stays unchanged. Contact the ICC immediately if you see repeated reset attempts you did not make.'],
      ctaLabel: 'Set a new password',
      ctaUrl: d.resetLink,
    }),
  },

  // 12 ── Account provisioned by the super admin
  account_provisioned: {
    label: 'Welcome / Account Provisioned',
    description: 'Welcome email for a first-time signup (self, Google SSO, KratosID, QR) and for accounts provisioned by the ICC.',
    audience: 'Newly created user',
    trigger: 'First-time signup or super admin provisions an account',
    render: (d) => {
      // `welcome: true` is set by the signup/SSO provisioning paths; accounts
      // created by an administrator keep the more formal provisioning wording.
      const welcome = Boolean(d.welcome);

      return render({
        subject: welcome ? 'Welcome to V-POSH · VIT-AP' : 'Your V-POSH ICC account is ready',
        heading: welcome ? `Welcome to the V-POSH portal, ${d.userName || ''}`.trim() : 'Your ICC portal account has been created',
        tone: welcome ? 'success' : 'info',
        greeting: d.userName,
        intro: welcome
          ? `Your account is active as <strong>${esc(d.roleLabel || d.role)}</strong>. V-POSH is the VIT-AP University portal for raising and tracking Prevention of Sexual Harassment complaints with the Internal Complaints Committee.`
          : `An account has been provisioned for you as <strong>${esc(d.roleLabel || d.role)}</strong>.`,
        rows: [
          ['Sign-in email', esc(d.email)],
          ['Role', esc(d.roleLabel || d.role)],
          ['Student / Employee ID', esc(d.employeeId)],
          ['Department', esc(d.department)],
          ['Designation', esc(d.designation)],
          ['Account created via', esc(d.createdBy)],
        ],
        paragraphs: welcome
          ? [
            'What you can do from here: raise a complaint with evidence, receive every committee update by email, follow the statutory timeline, and share anonymous feedback once a case closes. Your identity is never disclosed to the respondent.',
            'Read the awareness section to understand what counts as harassment, what the law requires of the committee, and how the inquiry process works before you need it.',
          ]
          : (d.tempPassword
            ? [`Use the initial password below and change it immediately after your first sign-in.<div style="margin-top:8px; background:#FFFFFF; border:1px dashed #94A3B8; border-radius:6px; padding:10px 12px; font-family:monospace; font-size:14px;">${esc(d.tempPassword)}</div>`]
            : ['Sign in with your institutional account, then set a password if you have not already.']),
        ctaLabel: welcome ? 'Open your dashboard' : 'Sign in to the portal',
        ctaUrl: d.loginUrl || appUrl(welcome ? '/' : '/login'),
        footerNote: 'Never share this email. ICC correspondence is confidential and audited.',
      });
    },
  },

  // 13 ── Account enabled / disabled
  account_status_changed: {
    label: 'Account Status Changed',
    description: 'Tells a user their portal access was enabled or revoked.',
    audience: 'Affected user',
    trigger: 'Super admin activates or deactivates an account',
    render: (d) => render({
      subject: `V-POSH account ${d.newStatus === 'disabled' ? 'deactivated' : 'activated'}`,
      heading: d.newStatus === 'disabled' ? 'Your portal access has been revoked' : 'Your portal access has been restored',
      tone: d.newStatus === 'disabled' ? 'warning' : 'success',
      greeting: d.userName,
      intro: d.newStatus === 'disabled'
        ? 'Your V-POSH account has been deactivated. You can no longer sign in or access case records.'
        : 'Your V-POSH account has been reactivated. You can sign in again with your existing credentials.',
      rows: [
        ['Account', esc(d.email)],
        ['New status', `<strong>${esc(d.newStatus)}</strong>`],
        ['Changed by', esc(d.changedBy)],
        ['Effective', esc(d.changedAt ? formatDate(d.changedAt) : formatDate())],
        ['Reason', esc(d.reason || 'Not specified')],
      ],
      paragraphs: ['If you believe this was a mistake, contact the ICC at vposh@vitap.ac.in. Case records you filed remain preserved either way.'],
      footerNote: 'Security notice from the V-POSH ICC Portal. Do not forward.',
    }),
  },

  // 14 ── Security events (password change, session-level notices)
  security_alert: {
    label: 'Security Alert',
    description: 'Alerts a user about credential changes and unusual account activity.',
    audience: 'Affected user',
    trigger: 'Password changed or a security-sensitive account change',
    render: (d) => render({
      subject: `Security alert — ${d.event}`,
      heading: d.event,
      tone: 'warning',
      greeting: d.userName,
      intro: 'This is a security notice about your V-POSH account. You are receiving it because the change below was recorded.',
      rows: [
        ['Event', esc(d.event)],
        ['When', esc(d.changedAt ? formatDate(d.changedAt) : formatDate())],
        ['IP address', esc(d.ip || 'unknown')],
        ['Device', esc(d.userAgent || 'unknown')],
      ],
      paragraphs: ['If this was not you, reset your password immediately and inform the ICC at vposh@vitap.ac.in so the session can be reviewed.'],
      ctaLabel: d.actionUrl ? 'Reset your password' : undefined,
      ctaUrl: d.actionUrl,
      footerNote: 'Security notice from the V-POSH ICC Portal. Do not forward.',
    }),
  },

  // 15 ── Faculty files a complaint for a student
  faculty_filed_on_behalf: {
    label: 'Complaint Filed On Your Behalf',
    description: 'Tells a student that a faculty member registered a complaint for them.',
    audience: 'Student named in the complaint',
    trigger: 'Faculty raises a complaint on behalf of a student',
    render: (d) => render({
      subject: `Complaint Filed On Your Behalf — ${d.referenceId}`,
      heading: 'A complaint was filed on your behalf',
      tone: 'info',
      greeting: d.studentName,
      intro: `<strong>${esc(d.facultyName)}</strong> from ${esc(d.department)} has registered a POSH complaint in which you are the complainant.`,
      rows: [
        ['Reference ID', `<strong>${esc(d.referenceId)}</strong>`],
        ['Title', esc(d.title)],
        ['Category', esc(d.category)],
        ['Filed by', esc(d.facultyName)],
        ['Filed on', esc(d.filedAt ? formatDate(d.filedAt) : formatDate())],
      ],
      paragraphs: [
        'You can follow the case, respond to the committee and add context from your own dashboard.',
        'If you did not consent to this complaint being filed, tell the ICC straight away so the record can be corrected.',
      ],
      ctaLabel: 'Open your dashboard',
      ctaUrl: appUrl('/student/complaints'),
    }),
  },
};

// ─── Transport ──────────────────────────────────────────────────────────────

let _transporter = null;
let _queue = Promise.resolve();
let _lastSendAt = 0;
let _pending = 0;

/** Is any mail currently in flight? Used to decide whether a serverless response must wait. */
function hasPendingSends() {
  return _pending > 0;
}

function isConfigured() {
  return Boolean(config.SMTP_USER && config.SMTP_PASS);
}

/**
 * Lazy singleton transporter — avoids crashing startup when SMTP env vars are
 * missing, and reuses pooled connections across serverless warm starts.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  if (!isConfigured()) {
    console.warn('[Email] SMTP_PASS not configured — emails are logged to console only.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    // Pooled connections are a win on a long-running server, but on serverless
    // each frozen invocation can leave a dead socket behind — pay the small
    // per-send handshake instead so sends never fail on a stale connection.
    pool: !config.IS_SERVERLESS,
    maxConnections: config.IS_SERVERLESS ? 1 : 3,
    maxMessages: 50,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 25000,
    tls: { minVersion: 'TLSv1.2' },
  });

  return _transporter;
}

function fromAddress() {
  return { name: config.SMTP_FROM_NAME, address: config.SMTP_FROM || config.SMTP_USER };
}

/** Serialize sends and keep a minimum gap so Gmail does not throttle us. */
function serialize(task) {
  const run = _queue.then(task, task);
  _queue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Wait until every queued send has finished.
 *
 * Long-running hosts don't need this, but a serverless function is frozen the
 * moment it responds — so background sweeps that fire mail without awaiting
 * (for example the SLA sweep) must flush before returning or the sends are lost
 * mid-flight. Bounded by `timeoutMs` so a slow relay never hangs a cron.
 */
async function flushPendingSends(timeoutMs = 20000) {
  const pending = _queue;
  const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs));
  try {
    return await Promise.race([pending.then(() => 'drained', () => 'drained'), timeout]);
  } catch {
    return 'drained';
  }
}

async function respectMinGap() {
  const gap = Number(config.EMAIL_MIN_SEND_GAP_MS) || 0;
  if (gap <= 0) return;
  const wait = _lastSendAt + gap - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  _lastSendAt = Date.now();
}

const TRANSIENT_SMTP = /ECONNRESET|ETIMEDOUT|ESOCKET|EDNS|EAI_AGAIN|421|450|451|452|4\.7\.0|4\.7\.1|too many|throttl/i;

function normalizeRecipients(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value || '';
}

async function logDelivery(entry) {
  if (!config.EMAIL_LOG_ENABLED) return;
  try {
    await db.emailLog.insertOne(entry);
  } catch (err) {
    // Logging must never break delivery.
    console.warn('[Email] Could not write delivery log:', err.message);
  }
}

/**
 * Send an email. Never throws; always resolves to a result object so callers
 * can fire-and-forget safely.
 *
 * @returns {Promise<{success:boolean, messageId?:string, dev?:boolean,
 *                    skipped?:boolean, dryRun?:boolean, error?:string}>}
 */
async function sendEmail({ to, subject, html, text, cc, bcc, replyTo, service, meta }) {
  const recipients = normalizeRecipients(to);

  if (!recipients) {
    await logDelivery({ service: service || null, to: '', subject, status: 'skipped', error: 'no recipient' });
    return { success: false, skipped: true, error: 'no recipient' };
  }

  if (!config.EMAIL_ENABLED) {
    await logDelivery({ service: service || null, to: recipients, subject, status: 'suppressed', error: 'EMAIL_ENABLED=false' });
    return { success: false, skipped: true, error: 'email disabled' };
  }

  const transporter = getTransporter();

  // Dev fallback — no SMTP_PASS configured.
  if (!transporter || config.EMAIL_DRY_RUN) {
    const mode = transporter ? 'DRY RUN' : 'NO SMTP CREDENTIALS';
    console.log('═══════════════════════════════════════════════');
    console.log(`[Email · ${mode}] → ${recipients}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html || '(empty body)');
    console.log('═══════════════════════════════════════════════');
    await logDelivery({
      service: service || null, to: recipients, subject,
      status: transporter ? 'dry_run' : 'logged',
      meta: meta || null,
    });
    return { success: true, dev: !transporter, dryRun: Boolean(transporter) };
  }

  _pending++;
  return serialize(async () => {
    try {
      return await deliverWithRetry(recipients, { subject, html, text, cc, bcc, replyTo, service, meta });
    } finally {
      _pending--;
    }
  });
}

/** The actual SMTP send loop — retried inside the serialized queue. */
async function deliverWithRetry(recipients, { subject, html, text, cc, bcc, replyTo, service, meta }) {
  const transporter = getTransporter();
  const attempts = Math.max(1, Number(config.EMAIL_SEND_ATTEMPTS) || 1);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await respectMinGap();
    try {
      const info = await transporter.sendMail({
        from: fromAddress(),
        to: recipients,
        cc: normalizeRecipients(cc) || undefined,
        bcc: normalizeRecipients(bcc) || undefined,
        replyTo: replyTo || config.SMTP_REPLY_TO || config.SMTP_USER,
        subject,
        html,
        text,
      });

      console.log(`[Email] Sent (${service || 'custom'}) → ${recipients}: ${info.messageId}`);
      await logDelivery({
        service: service || null, to: recipients, cc: normalizeRecipients(cc) || null,
        subject, status: 'sent', messageId: info.messageId,
        attempts: attempt, meta: meta || null,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const transient = TRANSIENT_SMTP.test(err.message || '');
      const lastAttempt = attempt === attempts;
      console.error(`[Email] Attempt ${attempt}/${attempts} to ${recipients} failed: ${err.message}`);

      if (!lastAttempt && transient) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      await logDelivery({
        service: service || null, to: recipients, subject, status: 'failed',
        error: err.message, attempts: attempt, meta: meta || null,
      });
      return { success: false, error: err.message, transient };
    }
  }

  return { success: false, error: 'send failed' };
}

/**
 * Render and send one of the catalogued email services.
 * Unknown keys, disabled services and missing recipients all resolve quietly.
 */
async function sendService(key, { to, cc, bcc, data = {}, meta } = {}) {
  const service = SERVICES[key];

  if (!service) {
    console.error(`[Email] Unknown service "${key}" — not sent.`);
    return { success: false, error: `unknown service: ${key}`, skipped: true };
  }

  if (config.EMAIL_SERVICES_DISABLED.includes(key)) {
    await logDelivery({
      service: key,
      to: normalizeRecipients(to),
      subject: service.label,
      status: 'suppressed',
      error: 'service disabled',
      meta: meta || null,
    });
    return { success: false, skipped: true, error: 'service disabled' };
  }

  const mail = service.render(data);
  return sendEmail({ to, cc, bcc, ...mail, service: key, meta });
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

/** Full service catalog with per-service enabled state (for admin surfaces). */
function getCatalog() {
  return Object.entries(SERVICES).map(([key, svc]) => ({
    key,
    label: svc.label,
    description: svc.description,
    audience: svc.audience,
    trigger: svc.trigger,
    enabled: config.EMAIL_ENABLED && !config.EMAIL_SERVICES_DISABLED.includes(key),
  }));
}

/** SMTP connectivity probe — safe to call from a health check. */
async function verifyTransport() {
  const details = {
    configured: isConfigured(),
    enabled: config.EMAIL_ENABLED,
    dryRun: config.EMAIL_DRY_RUN,
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER || '(unset)',
    from: `${config.SMTP_FROM_NAME} <${config.SMTP_FROM || config.SMTP_USER || 'unset'}>`,
    services: getCatalog().length,
  };

  if (!isConfigured()) {
    return {
      ...details,
      ok: false,
      error: 'SMTP_PASS is not set. Add the Gmail App Password for ' + (config.SMTP_USER || 'the sending mailbox') + '.',
    };
  }

  try {
    await getTransporter().verify();
    return { ...details, ok: true };
  } catch (err) {
    return { ...details, ok: false, error: err.message };
  }
}

/** Send a diagnostic message through the real transport. */
async function sendTestEmail(to, requestedBy) {
  const result = await sendEmail({
    to,
    subject: `[V-POSH] SMTP test — ${new Date().toISOString()}`,
    service: 'smtp_test',
    html: layout({
      heading: 'SMTP configuration works',
      tone: 'success',
      greeting: 'ICC Portal Administrator',
      intro: 'This message confirms the portal can send mail through the configured mailbox.',
      rows: [
        ['Mailbox', esc(config.SMTP_USER)],
        ['SMTP host', esc(`${config.SMTP_HOST}:${config.SMTP_PORT}`)],
        ['Encryption', config.SMTP_SECURE ? 'Implicit TLS (465)' : 'STARTTLS (587)'],
        ['Sent at', esc(formatDate())],
        ['Requested by', esc(requestedBy || 'system')],
        ['Services', `${getCatalog().length} catalogued`],
      ],
      paragraphs: ['Nothing else to do — transactional emails will now be delivered from this address.'],
    }),
    text: `V-POSH SMTP test successful.\nMailbox: ${config.SMTP_USER}\nHost: ${config.SMTP_HOST}:${config.SMTP_PORT}\nSent at: ${formatDate()}\n`,
  });
  return result;
}

// ─── Backwards-compatible template facade ───────────────────────────────────
// Older call sites use TEMPLATES.<name>(data) → { subject, html }. They now
// delegate to the catalog so every message shares one layout.

const TEMPLATES = {
  complaintSubmitted: (d) => SERVICES.complaint_acknowledgement.render(d),
  caseAssigned: (d) => SERVICES.case_assigned.render(d),
  statusUpdated: (d) => SERVICES.status_update.render(d),
  officialUpdate: (d) => SERVICES.official_update.render(d),
  statutoryEscalation: (d) => SERVICES.statutory_escalation.render(d),
};

module.exports = {
  sendEmail,
  sendService,
  flushPendingSends,
  hasPendingSends,
  getCatalog,
  verifyTransport,
  sendTestEmail,
  isConfigured,
  SERVICES,
  SERVICE_KEYS: Object.keys(SERVICES),
  TEMPLATES,
};
