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
  // KratosID passwordless auth
  KRATOSID_API_KEY: process.env.KRATOSID_API_KEY || '',
  KRATOSID_PRODUCT_ID: process.env.KRATOSID_PRODUCT_ID || '',
  KRATOSID_BASE_URL: process.env.KRATOSID_BASE_URL || 'https://api-prod.kratosid.com',
  KRATOSID_APP_NAME: process.env.KRATOSID_APP_NAME || 'KratosID',
  // Email (Gmail SMTP — use App Password, NOT account password)
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
};
