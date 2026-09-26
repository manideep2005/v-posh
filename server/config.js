// Env values are often pasted with stray quotes/whitespace — e.g. a Vercel
// dashboard entry written as KRATOSID_BASE_URL="https://..." keeps the quotes
// literally, which would build an invalid request URL. Normalize them.
function cleanEnv(value) {
  if (typeof value !== 'string') return value;
  let v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

// Hostname the KratosID vendor retired. It no longer resolves (ENOTFOUND), so
// a deployment still pointing at it fails every Kratos call. Treat it as unset.
const RETIRED_KRATOS_HOST = 'https://api.kratosid.com';
const KRATOS_PROD_HOST = 'https://api-prod.kratosid.com';

function resolveKratosBaseUrl() {
  const raw = cleanEnv(process.env.KRATOSID_BASE_URL) || KRATOS_PROD_HOST;
  const normalized = raw.replace(/\/+$/, '');
  if (normalized === RETIRED_KRATOS_HOST) {
    console.warn('[config] KRATOSID_BASE_URL points at ' + RETIRED_KRATOS_HOST +
      ', which no longer resolves. Using ' + KRATOS_PROD_HOST + ' instead — update the environment variable.');
    return KRATOS_PROD_HOST;
  }
  return normalized;
}

module.exports = {
  PORT: process.env.PORT || 5001,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me-in-production-8f3a91c2',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  APP_BASE_URL: process.env.APP_BASE_URL || '',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'posh_platform',
  UPLOAD_DIR: 'server/uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  // Students: @vitapstudent.ac.in  |  Faculty: @vitap.ac.in
  ALLOWED_STUDENT_DOMAINS: (process.env.ALLOWED_STUDENT_DOMAINS || 'vitapstudent.ac.in').split(',').map(d => d.trim().toLowerCase()),
  ALLOWED_FACULTY_DOMAINS: (process.env.ALLOWED_FACULTY_DOMAINS || 'vitap.ac.in').split(',').map(d => d.trim().toLowerCase()),
  // Emails that bypass domain role restrictions (can have any role)
  WHITELIST_EMAILS: (process.env.WHITELIST_EMAILS || 'mani.23mis7006@vitapstudent.ac.in,manideep.gonugunta1802@gmail.com').split(',').map(e => e.trim().toLowerCase()),
  // Hard role assignments — wins over domain auto-provisioning and repairs
  // accounts that were previously provisioned with a lower role.
  // Format: ROLE_OVERRIDES="email@domain:role, other@domain:other_role"
  ROLE_OVERRIDES: (process.env.ROLE_OVERRIDES || 'superadmin@vitap.ac.in:super_admin,manideep.gonugunta1802@gmail.com:super_admin')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [email, role] = pair.split(':');
      if (email && role) acc[email.trim().toLowerCase()] = role.trim();
      return acc;
    }, {}),
  // KratosID passwordless auth
  KRATOSID_API_KEY: cleanEnv(process.env.KRATOSID_API_KEY) || '',
  KRATOSID_PRODUCT_ID: cleanEnv(process.env.KRATOSID_PRODUCT_ID) || '',
  // Production host is api-prod.kratosid.com (api.kratosid.com does not
  // resolve — a missing env var used to silently point every Kratos call at a
  // dead hostname on Vercel, where .env is not deployed).
  KRATOSID_BASE_URL: resolveKratosBaseUrl(),
  KRATOSID_APP_NAME: cleanEnv(process.env.KRATOSID_APP_NAME) || 'KratosID',
  // QR payload shaping. Empty values keep KratosID's payload exactly as
  // delivered (what the vendor SDK documents). See server/services/qrPayload.js
  // for why the variants exist and how to use them to diagnose a rejected scan.
  KRATOSID_QR_VARIANT: cleanEnv(process.env.KRATOSID_QR_VARIANT) || '',
  KRATOSID_QR_TYPE: cleanEnv(process.env.KRATOSID_QR_TYPE) || '',

  // Shared secret for scheduled maintenance jobs (escalation sweep, ledger
  // checks). On Vercel set the same value as CRON_SECRET so Cron can call it.
  MAINTENANCE_TOKEN: process.env.MAINTENANCE_TOKEN || process.env.CRON_SECRET || '',

  // True on serverless hosts, where the process is frozen the moment a response
  // is sent — background work must therefore be finished before responding.
  IS_SERVERLESS: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY),

  // ── Email (SMTP) ─────────────────────────────────────────────────────────
  // Sending mailbox. `vposh@vitap.ac.in` is a Google Workspace address, so the
  // password must be a per-account App Password (never the account password).
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false', // 465 = implicit TLS
  SMTP_USER: process.env.SMTP_USER || 'vposh@vitap.ac.in',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'V-POSH ICC · VIT-AP',
  SMTP_REPLY_TO: process.env.SMTP_REPLY_TO || '',
  // Mailbox the ICC reads — receives new-complaint and escalation copies.
  ICC_NOTIFICATION_EMAIL: process.env.ICC_NOTIFICATION_EMAIL || 'vposh@vitap.ac.in',

  // Master switches
  EMAIL_ENABLED: process.env.EMAIL_ENABLED !== 'false',
  EMAIL_DRY_RUN: process.env.EMAIL_DRY_RUN === 'true',
  EMAIL_LOG_ENABLED: process.env.EMAIL_LOG_ENABLED !== 'false',
  // Comma-separated service keys to silence, e.g. "sla_warning,feedback_request"
  EMAIL_SERVICES_DISABLED: (process.env.EMAIL_SERVICES_DISABLED || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  // Base URL used to build deep links inside emails
  EMAIL_LINK_BASE_URL: process.env.EMAIL_LINK_BASE_URL || process.env.APP_BASE_URL || 'https://v-posh.vercel.app',
  // Minimum gap between two SMTP sends — Gmail throttles burst senders.
  EMAIL_MIN_SEND_GAP_MS: parseInt(process.env.EMAIL_MIN_SEND_GAP_MS || '300', 10),
  EMAIL_SEND_ATTEMPTS: parseInt(process.env.EMAIL_SEND_ATTEMPTS || '2', 10),
};
