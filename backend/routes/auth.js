const express = require('express');
const { getDatabase } = require('../config/database');
const CryptoUtils = require('../utils/crypto');
const ValidationUtils = require('../utils/validation');
const AuthMiddleware = require('../middleware/auth');
const RateLimitMiddleware = require('../middleware/rateLimit');
const config = require('../config');

const router = express.Router();

/**
 * Authentication Routes
 * Handles user registration, login, guest sessions, and account management
 */

// Apply rate limiting and validation middleware
router.use(RateLimitMiddleware.auth());
router.use(AuthMiddleware.logAuthEvent);

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', 
  RateLimitMiddleware.registration(),
  ValidationUtils.validateRegistration(),
  ValidationUtils.handleValidationErrors,
  ValidationUtils.sanitizeRequest,
  async (req, res) => {
    try {
      const { email, password, username, guestToken } = req.body;
      const db = getDatabase();

      // Check if registration is enabled
      if (!config.features.enableRegistration) {
        return res.status(403).json({
          error: 'Registration is currently disabled',
          code: 'REGISTRATION_DISABLED'
        });
      }

      // Check if email already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'Email address is already registered',
          code: 'EMAIL_EXISTS'
        });
      }

      // Check if username already exists (if provided)
      if (username) {
        const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUsername) {
          return res.status(409).json({
            error: 'Username is already taken',
            code: 'USERNAME_EXISTS'
          });
        }
      }

      // Hash password
      const passwordHash = await CryptoUtils.hashPassword(password);

      // Start transaction for atomic operations
      const transaction = db.transaction(() => {
        // Create user
        const insertUser = db.prepare(`
          INSERT INTO users (email, username, password_hash)
          VALUES (?, ?, ?)
        `);
        
        const result = insertUser.run(email, username || null, passwordHash);
        const userId = result.lastInsertRowid;

        // If user had guest sessions, migrate them to the new account
        if (guestToken) {
          try {
            // Verify guest token exists and is valid
            const guestSession = db.prepare(`
              SELECT id FROM guest_sessions 
              WHERE guest_token = ? AND expires_at > datetime('now')
            `).get(guestToken);

            if (guestSession) {
              // Link guest session to new user account
              db.prepare(`
                UPDATE guest_sessions 
                SET user_id = ? 
                WHERE guest_token = ?
              `).run(userId, guestToken);

              // Migrate guest sessions to user account
              const migratedSessions = db.prepare(`
                UPDATE sessions 
                SET user_id = ?, guest_token = NULL 
                WHERE guest_token = ?
              `).run(userId, guestToken);

              console.log(`Migrated ${migratedSessions.changes} sessions from guest to user ${userId}`);
            }
          } catch (migrationError) {
            console.warn('Guest session migration warning:', migrationError);
            // Don't fail registration if migration fails
          }
        }

        return userId;
      });

      const userId = transaction();

      // Generate JWT token
      const token = CryptoUtils.generateJWT({ 
        userId, 
        email,
        username: username || null 
      });

      // Log successful registration
      console.log(`New user registered: ${email} (ID: ${userId})`);

      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: userId,
          email,
          username: username || null,
          created_at: new Date().toISOString()
        },
        migratedSessions: guestToken ? true : false
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'Email or username already exists',
          code: 'CONSTRAINT_VIOLATION'
        });
      }
      
      res.status(500).json({
        error: 'Registration failed. Please try again.',
        code: 'REGISTRATION_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login',
  ValidationUtils.validateLogin(),
  ValidationUtils.handleValidationErrors,
  ValidationUtils.sanitizeRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const db = getDatabase();

      // Find user by email
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Verify password
      const isValidPassword = await CryptoUtils.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login timestamp
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
        .run(user.id);

      // Generate JWT token
      const token = CryptoUtils.generateJWT({
        userId: user.id,
        email: user.email,
        username: user.username
      });

      // Log successful login
      console.log(`User logged in: ${email} (ID: ${user.id})`);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.created_at,
          last_login: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed. Please try again.',
        code: 'LOGIN_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/guest
 * Create or validate a guest session
 */
router.post('/guest',
  RateLimitMiddleware.sessions(),
  ValidationUtils.validateGuestToken(),
  ValidationUtils.handleValidationErrors,
  (req, res) => {
    try {
      const { guest_token } = req.body;
      const db = getDatabase();

      // Check if guest sessions are enabled
      if (!config.features.enableGuestSessions) {
        return res.status(403).json({
          error: 'Guest sessions are currently disabled',
          code: 'GUEST_SESSIONS_DISABLED'
        });
      }

      let guestToken = guest_token;
      let isNewGuest = false;

      // Generate new guest token if not provided
      if (!guestToken) {
        guestToken = CryptoUtils.generateGuestToken();
        isNewGuest = true;
      }

      // Check if guest session exists
      const existingGuest = db.prepare(`
        SELECT guest_token, expires_at, user_id 
        FROM guest_sessions 
        WHERE guest_token = ?
      `).get(guestToken);

      if (existingGuest) {
        // Check if session is expired
        if (new Date(existingGuest.expires_at) < new Date()) {
          // Remove expired session
          db.prepare('DELETE FROM guest_sessions WHERE guest_token = ?').run(guestToken);
          
          return res.status(410).json({
            error: 'Guest session has expired',
            code: 'GUEST_SESSION_EXPIRED'
          });
        }

        // Check if guest session has been claimed by a user
        if (existingGuest.user_id) {
          return res.status(409).json({
            error: 'Guest session has been upgraded to a user account',
            code: 'GUEST_SESSION_UPGRADED'
          });
        }

        // Update last activity
        db.prepare('UPDATE guest_sessions SET last_activity = CURRENT_TIMESTAMP WHERE guest_token = ?')
          .run(guestToken);

        return res.json({
          message: 'Guest session validated',
          guest_token: guestToken,
          expires_at: existingGuest.expires_at,
          is_new: false
        });
      }

      // Create new guest session
      const expiresAt = new Date(Date.now() + (config.session.guestExpiryDays * 24 * 60 * 60 * 1000));
      const deviceFingerprint = CryptoUtils.generateDeviceFingerprint(req);

      const insertGuest = db.prepare(`
        INSERT INTO guest_sessions (guest_token, device_fingerprint, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertGuest.run(
        guestToken,
        deviceFingerprint,
        req.ip,
        req.get('User-Agent') || '',
        expiresAt.toISOString()
      );

      console.log(`New guest session created: ${guestToken}`);

      res.status(201).json({
        message: 'Guest session created',
        guest_token: guestToken,
        expires_at: expiresAt.toISOString(),
        expires_in_days: config.session.guestExpiryDays,
        is_new: true
      });

    } catch (error) {
      console.error('Guest session error:', error);
      
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'Guest token already exists',
          code: 'GUEST_TOKEN_EXISTS'
        });
      }
      
      res.status(500).json({
        error: 'Failed to create guest session',
        code: 'GUEST_SESSION_FAILED'
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me',
  AuthMiddleware.authenticateToken,
  (req, res) => {
    try {
      const db = getDatabase();
      
      // Get complete user information
      const user = db.prepare(`
        SELECT id, email, username, created_at, last_login, is_verified
        FROM users 
        WHERE id = ?
      `).get(req.user.userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Get user statistics
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as session_count,
          MAX(updated_at) as last_session_update,
          SUM(size_bytes) as total_storage_bytes
        FROM sessions 
        WHERE user_id = ?
      `).get(req.user.userId);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.created_at,
          last_login: user.last_login,
          is_verified: user.is_verified
        },
        statistics: {
          session_count: stats.session_count || 0,
          last_session_update: stats.last_session_update,
          total_storage_bytes: stats.total_storage_bytes || 0,
          total_storage_mb: Math.round((stats.total_storage_bytes || 0) / 1024 / 1024 * 100) / 100
        }
      });

    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        error: 'Failed to retrieve user information',
        code: 'USER_INFO_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/upgrade
 * Upgrade guest session to user account
 */
router.post('/upgrade',
  RateLimitMiddleware.registration(),
  ValidationUtils.validateRegistration(),
  ValidationUtils.handleValidationErrors,
  ValidationUtils.sanitizeRequest,
  async (req, res) => {
    try {
      const { email, password, username, guestToken } = req.body;
      const db = getDatabase();

      if (!guestToken) {
        return res.status(400).json({
          error: 'Guest token is required for account upgrade',
          code: 'GUEST_TOKEN_REQUIRED'
        });
      }

      // Check if registration is enabled
      if (!config.features.enableRegistration) {
        return res.status(403).json({
          error: 'Account upgrades are currently disabled',
          code: 'UPGRADE_DISABLED'
        });
      }

      // Verify guest session exists and is valid
      const guestSession = db.prepare(`
        SELECT id, expires_at, user_id 
        FROM guest_sessions 
        WHERE guest_token = ?
      `).get(guestToken);

      if (!guestSession) {
        return res.status(404).json({
          error: 'Guest session not found',
          code: 'GUEST_SESSION_NOT_FOUND'
        });
      }

      if (new Date(guestSession.expires_at) < new Date()) {
        return res.status(410).json({
          error: 'Guest session has expired',
          code: 'GUEST_SESSION_EXPIRED'
        });
      }

      if (guestSession.user_id) {
        return res.status(409).json({
          error: 'Guest session has already been upgraded',
          code: 'ALREADY_UPGRADED'
        });
      }

      // Check if email already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'Email address is already registered',
          code: 'EMAIL_EXISTS'
        });
      }

      // Check if username already exists (if provided)
      if (username) {
        const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUsername) {
          return res.status(409).json({
            error: 'Username is already taken',
            code: 'USERNAME_EXISTS'
          });
        }
      }

      // Hash password
      const passwordHash = await CryptoUtils.hashPassword(password);

      // Upgrade transaction - atomic operation
      const transaction = db.transaction(() => {
        // Create user account
        const insertUser = db.prepare(`
          INSERT INTO users (email, username, password_hash)
          VALUES (?, ?, ?)
        `);
        
        const result = insertUser.run(email, username || null, passwordHash);
        const userId = result.lastInsertRowid;

        // Link guest session to new user account
        db.prepare(`
          UPDATE guest_sessions 
          SET user_id = ? 
          WHERE guest_token = ?
        `).run(userId, guestToken);

        // Migrate all guest sessions to user account
        const migratedSessions = db.prepare(`
          UPDATE sessions 
          SET user_id = ?, guest_token = NULL 
          WHERE guest_token = ?
        `).run(userId, guestToken);

        console.log(`Upgraded guest session to user account: ${email} (ID: ${userId})`);
        console.log(`Migrated ${migratedSessions.changes} sessions`);

        return { userId, migratedSessions: migratedSessions.changes };
      });

      const { userId, migratedSessions } = transaction();

      // Generate JWT token
      const token = CryptoUtils.generateJWT({
        userId,
        email,
        username: username || null
      });

      res.json({
        message: 'Account upgrade successful',
        token,
        user: {
          id: userId,
          email,
          username: username || null,
          created_at: new Date().toISOString()
        },
        migration: {
          sessions_migrated: migratedSessions,
          guest_token: guestToken
        }
      });

    } catch (error) {
      console.error('Account upgrade error:', error);
      
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'Email or username already exists',
          code: 'CONSTRAINT_VIOLATION'
        });
      }
      
      res.status(500).json({
        error: 'Account upgrade failed. Please try again.',
        code: 'UPGRADE_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh',
  AuthMiddleware.authenticateToken,
  (req, res) => {
    try {
      // Generate new token with extended expiration
      const token = CryptoUtils.generateJWT({
        userId: req.user.userId,
        email: req.user.email,
        username: req.user.username
      });

      res.json({
        message: 'Token refreshed successfully',
        token,
        expires_in: config.jwt.expiresIn
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Failed to refresh token',
        code: 'REFRESH_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (mainly for logging purposes)
 */
router.post('/logout',
  AuthMiddleware.authenticateOptional,
  (req, res) => {
    // Log logout event
    console.log(`User logged out: ${req.user?.email || 'guest'} (${req.user?.userId || req.guestToken})`);
    
    res.json({
      message: 'Logged out successfully'
    });
  }
);

/**
 * DELETE /api/auth/account
 * Delete user account (with all associated data)
 */
router.delete('/account',
  AuthMiddleware.requireUser,
  async (req, res) => {
    try {
      const db = getDatabase();
      const userId = req.user.userId;

      // Delete user and all associated data in transaction
      const transaction = db.transaction(() => {
        // Get counts for confirmation
        const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(userId);
        const guestSessionCount = db.prepare('SELECT COUNT(*) as count FROM guest_sessions WHERE user_id = ?').get(userId);

        // Delete user data (cascading deletes will handle related records)
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        return {
          sessions_deleted: sessionCount.count,
          guest_sessions_deleted: guestSessionCount.count
        };
      });

      const deletionStats = transaction();

      console.log(`User account deleted: ${req.user.email} (ID: ${userId})`);
      console.log(`Deleted ${deletionStats.sessions_deleted} sessions, ${deletionStats.guest_sessions_deleted} guest sessions`);

      res.json({
        message: 'Account deleted successfully',
        deleted_data: deletionStats
      });

    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete account',
        code: 'ACCOUNT_DELETION_FAILED'
      });
    }
  }
);

/**
 * GET /api/auth/stats
 * Get authentication system statistics (admin only in future)
 */
router.get('/stats',
  RateLimitMiddleware.readonly(),
  (req, res) => {
    try {
      const db = getDatabase();

      const stats = {
        users: {
          total: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
          verified: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_verified = 1').get().count,
          recent_logins: db.prepare('SELECT COUNT(*) as count FROM users WHERE last_login > datetime(\'now\', \'-7 days\')').get().count
        },
        guests: {
          total: db.prepare('SELECT COUNT(*) as count FROM guest_sessions').get().count,
          active: db.prepare('SELECT COUNT(*) as count FROM guest_sessions WHERE expires_at > datetime(\'now\')').get().count,
          expired: db.prepare('SELECT COUNT(*) as count FROM guest_sessions WHERE expires_at <= datetime(\'now\')').get().count
        },
        sessions: {
          total: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
          user_owned: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id IS NOT NULL').get().count,
          guest_owned: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE guest_token IS NOT NULL').get().count,
          public: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_public = 1').get().count
        },
        system: {
          database_size_mb: 0, // Would be calculated from file size
          uptime_seconds: Math.floor(process.uptime()),
          node_version: process.version,
          memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
      };

      res.json({
        statistics: stats,
        generated_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        code: 'STATS_FAILED'
      });
    }
  }
);

module.exports = router;