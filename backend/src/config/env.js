require('dotenv').config();

const required = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
  'PLATFORM_JWT_ACCESS_SECRET', 'PLATFORM_JWT_REFRESH_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'APP_URL', 'FRONTEND_URL', 'PLATFORM_ADMIN_FRONTEND_URL', 'REDIS_HOST',
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (missing.length > 0) {
  console.error(`[FATAL][Security] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// In production, reject known insecure defaults or weak secrets
if (process.env.NODE_ENV === 'production') {
  const insecureKeywords = ['secret', 'change-in-production', 'changeme', 'password', 'default', '123456'];
  const secretsToCheck = [
    { key: 'JWT_ACCESS_SECRET', val: process.env.JWT_ACCESS_SECRET },
    { key: 'JWT_REFRESH_SECRET', val: process.env.JWT_REFRESH_SECRET },
    { key: 'PLATFORM_JWT_ACCESS_SECRET', val: process.env.PLATFORM_JWT_ACCESS_SECRET },
    { key: 'PLATFORM_JWT_REFRESH_SECRET', val: process.env.PLATFORM_JWT_REFRESH_SECRET },
    { key: 'TOTP_ENCRYPTION_KEY', val: process.env.TOTP_ENCRYPTION_KEY },
    { key: 'PROVIDER_CREDENTIALS_ENCRYPTION_KEY', val: process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY },
    { key: 'ENCRYPTION_KEY', val: process.env.ENCRYPTION_KEY },
  ];

  for (const s of secretsToCheck) {
    if (!s.val || s.val.length < 32 || insecureKeywords.some(kw => s.val.toLowerCase().includes(kw))) {
      console.error(`[FATAL][Security] Insecure or weak ${s.key} detected in production. Minimum 32-character high-entropy secret required.`);
      process.exit(1);
    }
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  appUrl: process.env.APP_URL,
  frontendUrl: process.env.FRONTEND_URL,
  platformAdminFrontendUrl: process.env.PLATFORM_ADMIN_FRONTEND_URL,

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },

  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
    
    platformAccessSecret: process.env.PLATFORM_JWT_ACCESS_SECRET,
    platformRefreshSecret: process.env.PLATFORM_JWT_REFRESH_SECRET,
    platformAccessExpiry: process.env.PLATFORM_JWT_ACCESS_EXPIRY || '15m',
    platformRefreshExpiry: process.env.PLATFORM_JWT_REFRESH_EXPIRY || '30d',
    platformImpersonationExpiry: process.env.PLATFORM_IMPERSONATION_TOKEN_EXPIRY || '30m',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'no-reply@shippingsaas.com',
  },

  totp: {
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
  },

  provider: {
    credentialsEncryptionKey: process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY || '',
    healthCheckStaleMinutes: parseInt(process.env.PROVIDER_HEALTH_CHECK_STALE_MINUTES, 10) || 10,
    defaultTimeoutMs: parseInt(process.env.PROVIDER_DEFAULT_TIMEOUT_MS, 10) || 8000,
  },

  shipment: {
    rateQuoteExpiryMinutes: parseInt(process.env.SHIPMENT_RATE_QUOTE_EXPIRY_MINUTES, 10) || 15,
    rateComparisonTimeoutMs: parseInt(process.env.SHIPMENT_RATE_COMPARISON_TIMEOUT_MS, 10) || 10000,
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },
  
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 5,
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_S3_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET,
    }
  },
  ndr: {
    autoRtoThreshold: parseInt(process.env.NDR_AUTO_RTO_THRESHOLD, 10) || 3,
    slaHours: parseInt(process.env.NDR_SLA_HOURS, 10) || 48,
  },
  billing: {
    gstRatePercent: parseInt(process.env.GST_RATE_PERCENT, 10) || 18,
    entityGstin: process.env.BILLING_ENTITY_GSTIN || '33ABCDE1234F1Z5',
    entityLegalName: process.env.BILLING_ENTITY_LEGAL_NAME || 'ShippingSaaS Logi Solutions Private Limited',
    entityAddress: process.env.BILLING_ENTITY_ADDRESS || 'Plot No. 42, 3rd Floor, Sector 4, Chennai, TN, India',
    entityState: process.env.BILLING_ENTITY_STATE || 'Tamil Nadu',
    fyStartMonth: parseInt(process.env.INVOICE_FINANCIAL_YEAR_START_MONTH, 10) || 4,
    statementDay: parseInt(process.env.MONTHLY_STATEMENT_DAY_OF_MONTH, 10) || 1,
  },
};
