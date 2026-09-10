module.exports = {
  PORT: process.env.PORT || 5001,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me-in-production-8f3a91c2',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  // Empty by default so password-reset links derive from the incoming request
  // host (works on any deploy domain). Set explicitly to pin a fixed domain.
  APP_BASE_URL: process.env.APP_BASE_URL || '',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'posh_platform',
  UPLOAD_DIR: 'server/uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};
