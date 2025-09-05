const path = require('path');
const crypto = require('crypto');

/**
 * Application configuration
 * Environment variables take precedence over defaults
 */

const environment = process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';
const isProduction = environment === 'production';

// Generate secure defaults if not provided
const generateSecureDefault = (envVar, length = 64) => {
  return process.env[envVar] || crypto.randomBytes(length).toString('hex');
};

const config = {
  environment,
  isDevelopment,
  isProduction,
  
  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || '127.0.0.1',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '50mb',
    trustProxy: process.env.TRUST_PROXY === 'true' || isDevelopment,
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'whistle.db'),
    backupPath: process.env.DB_BACKUP_PATH || path.join(__dirname, '..', 'data', 'backups'),
    enableWAL: process.env.DB_ENABLE_WAL !== 'false', // WAL mode enabled by default
    enableBackups: process.env.DB_ENABLE_BACKUPS !== 'false',
    backupInterval: parseInt(process.env.DB_BACKUP_INTERVAL) || (24 * 60 * 60 * 1000), // 24 hours
  },
  
  // JWT configuration
  jwt: {
    secret: generateSecureDefault('JWT_SECRET', 64),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || (isDevelopment ? 10 : 12),
    sessionSecret: generateSecureDefault('SESSION_SECRET', 32),
    csrfSecret: generateSecureDefault('CSRF_SECRET', 32),
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || (isDevelopment ? 1000 : 100),
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
  },
  
  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      (isDevelopment ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  },
  
  // Session configuration
  session: {
    guestExpiryDays: parseInt(process.env.GUEST_EXPIRY_DAYS) || 30,
    userSessionDays: parseInt(process.env.USER_SESSION_DAYS) || 7,
    cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL) || (6 * 60 * 60 * 1000), // 6 hours
  },
  
  // Feature flags
  features: {
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableSharing: process.env.ENABLE_SHARING !== 'false',
    enableGuestSessions: process.env.ENABLE_GUEST_SESSIONS !== 'false',
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    enablePasswordReset: process.env.ENABLE_PASSWORD_RESET === 'true', // Disabled by default
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true', // Disabled by default
    maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER) || 100,
    maxSessionsPerGuest: parseInt(process.env.MAX_SESSIONS_PER_GUEST) || 10,
  },
  
  // Email configuration (if email features are enabled)
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
    from: process.env.EMAIL_FROM || 'noreply@whistle.local',
  },

  
  // File upload configuration
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
    allowedTypes: process.env.ALLOWED_FILE_TYPES ? 
      process.env.ALLOWED_FILE_TYPES.split(',') : 
      ['application/json', 'text/plain'],
    uploadPath: process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads'),
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    logPath: process.env.LOG_PATH || path.join(__dirname, '..', 'logs'),
    maxLogSize: process.env.MAX_LOG_SIZE || '10mb',
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
  },
  
  // Frontend configuration (passed to client)
  frontend: {
    appName: process.env.APP_NAME || 'Whistle',
    appVersion: process.env.APP_VERSION || '1.0.0',
    apiUrl: process.env.API_URL || '',
    enableDevTools: isDevelopment,
    maxSessionDataSize: process.env.MAX_SESSION_DATA_SIZE || '10mb',
    audioSampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 44100,
    fftSize: parseInt(process.env.FFT_SIZE) || 4096,
  },
  
  // Performance monitoring
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT) || 3002,
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
  },
};

// Validation and warnings
if (isDevelopment) {
  // Warn about generated secrets in development
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set - using generated value for development');
  }
  
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️  SESSION_SECRET not set - using generated value for development');
  }
}

if (isProduction) {
  // Validate required production settings
  const requiredEnvVars = ['JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables for production:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }
  
  // Warn about insecure configurations
  if (config.security.bcryptRounds < 12) {
    console.warn('⚠️  bcrypt rounds should be at least 12 in production');
  }
  
  if (config.cors.allowedOrigins.includes('*')) {
    console.warn('⚠️  CORS is allowing all origins in production');
  }
}

// Create required directories
const fs = require('fs');
const requiredDirs = [
  path.dirname(config.database.path),
  config.database.backupPath,
  config.upload.uploadPath,
  config.logging.logPath,
];

requiredDirs.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error.message);
  }
});

module.exports = config;