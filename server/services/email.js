const nodemailer = require('nodemailer');
const config = require('../config');

let _transporter = null;

/**
 * Lazy singleton transporter — avoids crashing startup when SMTP env vars
 * are missing. Falls back to console logging in development.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  if (!config.SMTP_USER || !config.SMTP_PASS) {
    console.warn('[Email] SMTP credentials not configured. Emails will be logged to console only.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS, // Gmail App Password (not account password)
    },
  });

  return _transporter;
}

/**
 * Send an email. If SMTP is not configured, logs the message to console.
 * @param {object} opts
 * @param {string} opts.to      - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html    - HTML body
 * @param {string} [opts.text]  - Plain text fallback
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  const from = config.SMTP_FROM || config.SMTP_USER || 'no-reply@vposh.vercel.app';

  if (!transporter) {
    // Dev fallback — log to console
    console.log('═══════════════════════════════════════════════');
    console.log(`[Email → ${to}] Subject: ${subject}`);
    console.log(html || text || '(empty body)');
    console.log('═══════════════════════════════════════════════');
    return { success: true, dev: true };
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[Email] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Pre-built email templates ──────────────────────────────────────────────

const TEMPLATES = {
  complaintSubmitted: (data) => ({
    subject: `Complaint Registered — ${data.referenceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0F172A; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">V-POSH · VIT-AP</h1>
          <p style="margin: 5px 0 0; color: #94A3B8; font-size: 13px;">ICC Portal Notification</p>
        </div>
        <div style="padding: 24px; background: #F8FAFC;">
          <h2 style="color: #0F172A;">Complaint Successfully Registered</h2>
          <p>Dear <strong>${data.studentName}</strong>,</p>
          <p>Your complaint has been officially registered with the Internal Complaints Committee (ICC).</p>
          <div style="background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Reference ID:</strong> ${data.referenceId}</p>
            <p style="margin: 4px 0;"><strong>Title:</strong> ${data.title}</p>
            <p style="margin: 4px 0;"><strong>Category:</strong> ${data.category}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> Submitted</p>
          </div>
          <p style="color: #64748B; font-size: 13px;">You will receive updates as your case progresses. You can also track your complaint through the student dashboard.</p>
          <p style="color: #64748B; font-size: 13px;">If you have questions, contact the ICC committee.</p>
        </div>
        <div style="background: #1E293B; color: #94A3B8; padding: 16px; text-align: center; font-size: 12px;">
          V-POSH · VIT-AP University ICC Portal
        </div>
      </div>
    `
  }),

  caseAssigned: (data) => ({
    subject: `Case Assigned to You — ${data.referenceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0F172A; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">V-POSH · VIT-AP</h1>
          <p style="margin: 5px 0 0; color: #94A3B8; font-size: 13px;">ICC Portal Notification</p>
        </div>
        <div style="padding: 24px; background: #F8FAFC;">
          <h2 style="color: #0F172A;">New Case Assignment</h2>
          <p>Dear <strong>${data.officerName}</strong>,</p>
          <p>A new complaint has been assigned to you by <strong>${data.assignedBy}</strong>.</p>
          <div style="background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Reference ID:</strong> ${data.referenceId}</p>
            <p style="margin: 4px 0;"><strong>Title:</strong> ${data.title}</p>
            <p style="margin: 4px 0;"><strong>Priority:</strong> ${data.priority}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> ${data.status}</p>
          </div>
          <p>Please review and take appropriate action on this case through the admin dashboard.</p>
        </div>
        <div style="background: #1E293B; color: #94A3B8; padding: 16px; text-align: center; font-size: 12px;">
          V-POSH · VIT-AP University ICC Portal
        </div>
      </div>
    `
  }),

  statusUpdated: (data) => ({
    subject: `Complaint Status Updated — ${data.referenceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0F172A; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">V-POSH · VIT-AP</h1>
          <p style="margin: 5px 0 0; color: #94A3B8; font-size: 13px;">ICC Portal Notification</p>
        </div>
        <div style="padding: 24px; background: #F8FAFC;">
          <h2 style="color: #0F172A;">Complaint Status Update</h2>
          <p>Dear <strong>${data.studentName}</strong>,</p>
          <p>The status of your complaint has been updated.</p>
          <div style="background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Reference ID:</strong> ${data.referenceId}</p>
            <p style="margin: 4px 0;"><strong>Previous Status:</strong> ${data.previousStatus}</p>
            <p style="margin: 4px 0;"><strong>New Status:</strong> ${data.newStatus}</p>
            ${data.comment ? `<p style="margin: 8px 0 4px; color: #64748B;"><em>"${data.comment}"</em></p>` : ''}
          </div>
          <p style="color: #64748B; font-size: 13px;">You can track the full progress through the student dashboard.</p>
        </div>
        <div style="background: #1E293B; color: #94A3B8; padding: 16px; text-align: center; font-size: 12px;">
          V-POSH · VIT-AP University ICC Portal
        </div>
      </div>
    `
  }),

  officialUpdate: (data) => ({
    subject: `Official Update on Complaint — ${data.referenceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0F172A; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">V-POSH · VIT-AP</h1>
          <p style="margin: 5px 0 0; color: #94A3B8; font-size: 13px;">ICC Portal Notification</p>
        </div>
        <div style="padding: 24px; background: #F8FAFC;">
          <h2 style="color: #0F172A;">Official Update Posted</h2>
          <p>Dear <strong>${data.studentName}</strong>,</p>
          <p>An official update has been posted on your complaint by <strong>${data.authorName}</strong>.</p>
          <div style="background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Reference ID:</strong> ${data.referenceId}</p>
            <p style="margin: 12px 0 4px; color: #334155;">${data.updateText}</p>
          </div>
        </div>
        <div style="background: #1E293B; color: #94A3B8; padding: 16px; text-align: center; font-size: 12px;">
          V-POSH · VIT-AP University ICC Portal
        </div>
      </div>
    `
  }),
};

module.exports = { sendEmail, TEMPLATES };
