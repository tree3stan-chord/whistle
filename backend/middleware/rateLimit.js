const rateLimit = require('express-rate-limit');
const config = require('../config');
const { getDatabase } = require('../config/database');

/**
 * Rate limiting middleware with different rules for different endpoints
 */
class RateLimitMiddleware {
  /**
   * General API rate limiter
   */
  static general() {
    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for certain IPs (localhost in development)
      skip: (req) => {
        if (config.isDevelopment) {
          return req.ip === '127.0.0.1' || req.ip === '::1';
        }
        return false;
      },
      // Custom key generator (can include user info for authenticated requests)
      keyGenerator: (req) => {
        if (req.user) {
          return `user:${req.user.userId}`;
        } else if (req.guestToken) {
          return `guest:${req.guestToken}`;
        } else {
          return req.ip;
        }
      },
    });
  }

  /**
   * Strict rate limiter for authentication endpoints
   */
  static auth() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: {
        error: 'Too many authentication attempts',
        retryAfter: 15 * 60,
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false, // Count both successful and failed attempts
      skipFailedRequests: false,
    });
  }

  /**
   * Moderate rate limiter for session operations
   */
  static sessions() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 session operations per minute
      message: {
        error: 'Too many session operations',
        retryAfter: 60,
        code: 'SESSION_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Higher limits for authenticated users
      keyGenerator: (req) => {
        if (req.user) {
          return `user:${req.user.userId}:sessions`;
        } else if (req.guestToken) {
          return `guest:${req.guestToken}:sessions`;
        } else {
          return `${req.ip}:sessions`;
        }
      },
      // Different limits based on user type
      max: (req) => {
        if (req.user) {
          return 50; // Higher limit for registered users
        } else {
          return 20; // Lower limit for guests
        }
      },
    });
  }

  /**
   * Lenient rate limiter for read-only operations
   */
  static readonly() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 read operations per minute
      message: {
        error: 'Too many read requests',
        retryAfter: 60,
        code: 'READ_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip for authenticated users making reasonable requests
        return req.user && req.method === 'GET';
      },
    });
  }

  /**
   * Very strict rate limiter for registration
   */
  static registration() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registrations per hour per IP
      message: {
        error: 'Registration rate limit exceeded. Please try again later.',
        retryAfter: 60 * 60,
        code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Rate limiter for sharing operations
   */
  static sharing() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 share operations per 5 minutes
      message: {
        error: 'Too many sharing operations',
        retryAfter: 5 * 60,
        code: 'SHARING_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Dynamic rate limiter based on database activity
   * Implements more sophisticated rate limiting with database tracking
   */
  static dynamic() {
    return async (req, res, next) => {
      try {
        const db = getDatabase();
        const now = new Date();
        const windowStart = new Date(now.getTime() - 60 * 1000); // 1 minute window
        
        // Determine identifier for rate limiting
        let identifier;
        let maxRequests;
        
        if (req.user) {
          identifier = `user:${req.user.userId}`;
          maxRequests = 120; // Higher limit for authenticated users
        } else if (req.guestToken) {
          identifier = `guest:${req.guestToken}`;
          maxRequests = 60; // Medium limit for guests
        } else {
          identifier = `ip:${req.ip}`;
          maxRequests = 30; // Lower limit for anonymous requests
        }

        // Count recent requests for this identifier
        const recentRequests = db.prepare(`
          SELECT COUNT(*) as count
          FROM request_logs
          WHERE (ip_address = ? OR user_id = ? OR guest_token = ?)
          AND created_at > ?
        `).get(
          req.ip,
          req.user?.userId || null,
          req.guestToken || null,
          windowStart.toISOString()
        );

        if (recentRequests.count >= maxRequests) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            limit: maxRequests,
            remaining: 0,
            resetTime: new Date(now.getTime() + 60 * 1000).toISOString(),
            code: 'DYNAMIC_RATE_LIMIT_EXCEEDED'
          });
        }

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': maxRequests - recentRequests.count,
          'X-RateLimit-Reset': new Date(now.getTime() + 60 * 1000).toISOString(),
        });

        next();
      } catch (error) {
        console.error('Dynamic rate limit error:', error);
        // Fall back to allowing request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Adaptive rate limiter that adjusts based on system load
   */
  static adaptive() {
    let systemLoad = 0; // Track system load (0-1 scale)
    
    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: (req) => {
        const baseLimit = config.rateLimit.maxRequests;
        
        // Adjust limit based on system load
        const loadFactor = Math.max(0.1, 1 - systemLoad);
        const adjustedLimit = Math.floor(baseLimit * loadFactor);
        
        // Higher limits for authenticated users even under load
        if (req.user) {
          return Math.max(adjustedLimit, 10);
        } else {
          return adjustedLimit;
        }
      },
      message: (req, res) => ({
        error: 'System under high load. Please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        systemLoad: systemLoad.toFixed(2),
        code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED'
      }),
      standardHeaders: true,
      legacyHeaders: false,
      // Update system load periodically
      onHit: () => {
        // Simple load calculation based on hit rate
        // In production, you might want to use actual system metrics
        systemLoad = Math.min(1, systemLoad + 0.01);
      },
      onLimitReached: () => {
        systemLoad = Math.min(1, systemLoad + 0.1);
      },
    });
  }

  /**
   * Middleware to track request patterns for security analysis
   */
  static trackPatterns() {
    const suspiciousPatterns = new Map();
    
    return (req, res, next) => {
      const identifier = req.user?.userId || req.guestToken || req.ip;
      const pattern = `${req.method}:${req.path}`;
      
      // Track request patterns
      if (!suspiciousPatterns.has(identifier)) {
        suspiciousPatterns.set(identifier, new Map());
      }
      
      const userPatterns = suspiciousPatterns.get(identifier);
      const count = userPatterns.get(pattern) || 0;
      userPatterns.set(pattern, count + 1);
      
      // Simple anomaly detection - too many identical requests
      if (count > 50) { // Threshold for suspicious activity
        console.warn(`Suspicious pattern detected: ${identifier} - ${pattern} (${count} times)`);
        
        // Could trigger additional security measures here
        res.set('X-Suspicious-Activity', 'true');
      }
      
      // Clean up old patterns periodically
      if (Math.random() < 0.01) { // 1% chance
        suspiciousPatterns.clear();
      }
      
      next();
    };
  }

  /**
   * Create a custom rate limiter with specific options
   * @param {Object} options - Rate limit options
   * @returns {Function} Express middleware
   */
  static custom(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        error: 'Rate limit exceeded',
        code: 'CUSTOM_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Bypass rate limiting for certain conditions
   * @param {Function} condition - Function that returns true to bypass rate limiting
   * @param {Function} rateLimiter - Rate limiter middleware to bypass
   * @returns {Function} Express middleware
   */
  static bypass(condition, rateLimiter) {
    return (req, res, next) => {
      if (condition(req)) {
        return next();
      }
      return rateLimiter(req, res, next);
    };
  }
}

module.exports = RateLimitMiddleware;