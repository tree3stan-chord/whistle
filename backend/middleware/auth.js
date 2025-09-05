const { getDatabase } = require('../config/database');
const CryptoUtils = require('../utils/crypto');
const config = require('../config');

/**
 * Authentication middleware for Express routes
 * Handles both JWT user authentication and guest sessions
 */
class AuthMiddleware {
  /**
   * Middleware to authenticate JWT tokens (registered users)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({ 
          error: 'Access token required',
          code: 'TOKEN_MISSING' 
        });
      }

      // Verify JWT token
      const decoded = CryptoUtils.verifyJWT(token);
      
      // Check if user still exists in database
      const db = getDatabase();
      const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'User no longer exists',
          code: 'USER_NOT_FOUND' 
        });
      }

      // Attach user info to request
      req.user = {
        userId: user.id,
        email: user.email,
        username: user.username,
      };

      next();
    } catch (error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({ 
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED' 
        });
      } else if (error.message.includes('invalid')) {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'TOKEN_INVALID' 
        });
      } else {
        console.error('Token verification error:', error);
        return res.status(401).json({ 
          error: 'Authentication failed',
          code: 'AUTH_FAILED' 
        });
      }
    }
  }

  /**
   * Middleware to authenticate guest sessions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static authenticateGuest(req, res, next) {
    try {
      // First try to authenticate as registered user
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        try {
          const decoded = CryptoUtils.verifyJWT(token);
          
          // Check if user still exists
          const db = getDatabase();
          const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(decoded.userId);
          
          if (user) {
            req.user = {
              userId: user.id,
              email: user.email,
              username: user.username,
            };
            return next();
          }
        } catch (jwtError) {
          // JWT verification failed, fall through to guest authentication
        }
      }

      // Try guest token authentication
      const guestToken = req.headers['x-guest-token'] || 
                        req.body?.guest_token || 
                        req.query?.guest_token;

      if (!guestToken) {
        return res.status(401).json({ 
          error: 'Authentication required. Provide either JWT token or guest token',
          code: 'AUTH_REQUIRED' 
        });
      }

      // Validate guest token format
      if (!guestToken.match(/^guest_\d+_[a-f0-9]+$/)) {
        return res.status(401).json({ 
          error: 'Invalid guest token format',
          code: 'INVALID_GUEST_TOKEN' 
        });
      }

      // Check if guest session exists and is not expired
      const db = getDatabase();
      const guestSession = db.prepare(`
        SELECT guest_token, expires_at, user_id 
        FROM guest_sessions 
        WHERE guest_token = ? AND expires_at > datetime('now')
      `).get(guestToken);

      if (!guestSession) {
        // Create new guest session if token doesn't exist
        const expiresAt = new Date(Date.now() + (config.session.guestExpiryDays * 24 * 60 * 60 * 1000));
        const deviceFingerprint = CryptoUtils.generateDeviceFingerprint(req);

        const insertGuest = db.prepare(`
          INSERT INTO guest_sessions (guest_token, device_fingerprint, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        try {
          insertGuest.run(
            guestToken,
            deviceFingerprint,
            req.ip,
            req.get('User-Agent') || '',
            expiresAt.toISOString()
          );

          console.log(`New guest session created: ${guestToken}`);
        } catch (insertError) {
          console.error('Failed to create guest session:', insertError);
          return res.status(500).json({ 
            error: 'Failed to create guest session',
            code: 'GUEST_CREATION_FAILED' 
          });
        }
      } else if (guestSession.user_id) {
        // Guest session has been claimed by a user account
        return res.status(401).json({ 
          error: 'Guest session has been upgraded to user account. Please login.',
          code: 'GUEST_UPGRADED' 
        });
      } else {
        // Update last activity for existing guest session
        try {
          db.prepare('UPDATE guest_sessions SET last_activity = CURRENT_TIMESTAMP WHERE guest_token = ?')
            .run(guestToken);
        } catch (updateError) {
          console.warn('Failed to update guest session activity:', updateError);
          // Continue anyway, this is not critical
        }
      }

      // Attach guest token to request
      req.guestToken = guestToken;

      next();
    } catch (error) {
      console.error('Guest authentication error:', error);
      return res.status(500).json({ 
        error: 'Authentication failed',
        code: 'AUTH_ERROR' 
      });
    }
  }

  /**
   * Middleware that allows both user and guest authentication
   * Prioritizes user authentication but falls back to guest
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static authenticateOptional(req, res, next) {
    // Try user authentication first
    AuthMiddleware.authenticateToken(req, res, (err) => {
      if (!err) {
        return next(); // User authentication successful
      }

      // Fall back to guest authentication
      AuthMiddleware.authenticateGuest(req, res, next);
    });
  }

  /**
   * Middleware to require user authentication (no guests allowed)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static requireUser(req, res, next) {
    AuthMiddleware.authenticateToken(req, res, (err) => {
      if (err) {
        return res.status(401).json({ 
          error: 'User account required for this action',
          code: 'USER_REQUIRED' 
        });
      }
      next();
    });
  }

  /**
   * Middleware to check if user owns a resource or is admin
   * @param {Function} getResourceOwner - Function to get resource owner ID
   * @returns {Function} Express middleware
   */
  static requireOwnership(getResourceOwner) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED' 
          });
        }

        const ownerId = await getResourceOwner(req);
        
        if (ownerId !== req.user.userId) {
          return res.status(403).json({ 
            error: 'Access denied. You do not own this resource.',
            code: 'OWNERSHIP_REQUIRED' 
          });
        }

        next();
      } catch (error) {
        console.error('Ownership check error:', error);
        return res.status(500).json({ 
          error: 'Failed to verify resource ownership',
          code: 'OWNERSHIP_CHECK_FAILED' 
        });
      }
    };
  }

  /**
   * Middleware to check session ownership (user or guest)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static requireSessionOwnership(req, res, next) {
    try {
      const { sessionId } = req.params;
      const db = getDatabase();

      // Get session ownership info
      const session = db.prepare('SELECT user_id, guest_token FROM sessions WHERE session_id = ?').get(sessionId);

      if (!session) {
        return res.status(404).json({ 
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND' 
        });
      }

      // Check ownership
      const hasUserAccess = req.user && session.user_id === req.user.userId;
      const hasGuestAccess = req.guestToken && session.guest_token === req.guestToken;

      if (!hasUserAccess && !hasGuestAccess) {
        return res.status(403).json({ 
          error: 'Access denied. You do not own this session.',
          code: 'SESSION_ACCESS_DENIED' 
        });
      }

      // Attach session info to request
      req.sessionOwnership = {
        userId: session.user_id,
        guestToken: session.guest_token,
        isUserOwned: hasUserAccess,
        isGuestOwned: hasGuestAccess,
      };

      next();
    } catch (error) {
      console.error('Session ownership check error:', error);
      return res.status(500).json({ 
        error: 'Failed to verify session ownership',
        code: 'SESSION_OWNERSHIP_CHECK_FAILED' 
      });
    }
  }

  /**
   * Middleware to log authentication events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static logAuthEvent(req, res, next) {
    const originalJson = res.json;

    res.json = function(data) {
      // Log authentication events
      if (config.features.enableAnalytics) {
        try {
          const db = getDatabase();
          const eventData = {
            endpoint: req.path,
            method: req.method,
            user_id: req.user?.userId || null,
            guest_token: req.guestToken || null,
            success: res.statusCode < 400,
            ip_address: req.ip,
            user_agent: req.get('User-Agent') || '',
          };

          // Don't block response for logging
          setImmediate(() => {
            try {
              db.prepare(`
                INSERT INTO request_logs (ip_address, user_id, guest_token, endpoint, method, status_code, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(
                eventData.ip_address,
                eventData.user_id,
                eventData.guest_token,
                eventData.endpoint,
                eventData.method,
                res.statusCode,
                eventData.user_agent
              );
            } catch (logError) {
              console.warn('Failed to log auth event:', logError);
            }
          });
        } catch (error) {
          console.warn('Auth event logging error:', error);
        }
      }

      return originalJson.call(this, data);
    };

    next();
  }

  /**
   * Middleware to cleanup expired tokens and sessions
   * Runs periodically on auth requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static cleanupExpired(req, res, next) {
    // Run cleanup randomly to avoid performance impact
    if (Math.random() < 0.1) { // 10% chance
      setImmediate(() => {
        try {
          const db = getDatabase();
          
          // Clean expired guest sessions
          db.prepare('DELETE FROM guest_sessions WHERE expires_at < datetime(\'now\')').run();
          
          // Clean expired shared sessions
          db.prepare('DELETE FROM shared_sessions WHERE expires_at IS NOT NULL AND expires_at < datetime(\'now\')').run();
          
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      });
    }
    
    next();
  }
}

module.exports = AuthMiddleware;