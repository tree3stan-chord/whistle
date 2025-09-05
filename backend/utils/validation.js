const { body, param, query, validationResult } = require('express-validator');
const CryptoUtils = require('./crypto');

/**
 * Validation utilities and middleware
 */
class ValidationUtils {
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate username format
   * @param {string} username - Username to validate  
   * @returns {boolean} True if valid username format
   */
  static isValidUsername(username) {
    if (!username || typeof username !== 'string') return false;
    
    // Username: 3-30 chars, alphanumeric, underscore, hyphen
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate session name
   * @param {string} name - Session name to validate
   * @returns {boolean} True if valid session name
   */
  static isValidSessionName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Session name: 1-100 chars, allow most characters except control chars
    return name.length >= 1 && name.length <= 100 && !/[\x00-\x1F\x7F]/.test(name);
  }

  /**
   * Validate session data structure
   * @param {Object} sessionData - Session data to validate
   * @returns {boolean} True if valid session data
   */
  static isValidSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') return false;

    // Must have required fields
    const requiredFields = ['metadata', 'configuration', 'notation'];
    const hasRequired = requiredFields.every(field => sessionData.hasOwnProperty(field));
    
    if (!hasRequired) return false;

    // Validate metadata structure
    if (!sessionData.metadata || typeof sessionData.metadata !== 'object') return false;

    // Validate notation structure (should be array of notes)
    if (!sessionData.notation || typeof sessionData.notation !== 'object') return false;

    // Validate configuration structure
    if (!sessionData.configuration || typeof sessionData.configuration !== 'object') return false;

    return true;
  }

  /**
   * Sanitize string input (remove dangerous characters)
   * @param {string} str - String to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} Sanitized string
   */
  static sanitizeString(str, maxLength = 1000) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .trim()
      .slice(0, maxLength)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
  }

  /**
   * Check if IP address is in allowed range (for rate limiting bypass)
   * @param {string} ip - IP address to check
   * @returns {boolean} True if IP is allowed
   */
  static isAllowedIP(ip) {
    // Localhost addresses
    const localhostPatterns = [
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
    ];
    
    return localhostPatterns.includes(ip);
  }

  /**
   * Express validator middleware for user registration
   */
  static validateRegistration() {
    return [
      body('email')
        .isEmail()
        .withMessage('Must be a valid email address')
        .isLength({ max: 254 })
        .withMessage('Email too long')
        .normalizeEmail(),
      
      body('password')
        .custom((password) => {
          const validation = CryptoUtils.validatePasswordStrength(password);
          if (!validation.isValid) {
            throw new Error(validation.feedback.join('. '));
          }
          return true;
        }),
      
      body('username')
        .optional()
        .custom((username) => {
          if (username && !ValidationUtils.isValidUsername(username)) {
            throw new Error('Username must be 3-30 characters, alphanumeric, underscore, or hyphen only');
          }
          return true;
        }),
      
      body('guestToken')
        .optional()
        .isString()
        .isLength({ min: 10, max: 100 })
        .withMessage('Invalid guest token format'),
    ];
  }

  /**
   * Express validator middleware for user login
   */
  static validateLogin() {
    return [
      body('email')
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
      
      body('password')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Password is required'),
    ];
  }

  /**
   * Express validator middleware for session creation/update
   */
  static validateSession() {
    return [
      body('name')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .withMessage('Session name must be 1-100 characters')
        .customSanitizer(value => ValidationUtils.sanitizeString(value, 100)),
      
      body('description')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .customSanitizer(value => ValidationUtils.sanitizeString(value, 500)),
      
      body('data')
        .custom((data) => {
          if (!ValidationUtils.isValidSessionData(data)) {
            throw new Error('Invalid session data structure');
          }
          
          // Check data size (prevent abuse)
          const dataStr = JSON.stringify(data);
          const sizeMB = Buffer.byteLength(dataStr, 'utf8') / (1024 * 1024);
          const maxSizeMB = 10; // 10MB limit
          
          if (sizeMB > maxSizeMB) {
            throw new Error(`Session data too large (${sizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB`);
          }
          
          return true;
        }),
      
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object'),
      
      body('is_public')
        .optional()
        .isBoolean()
        .withMessage('is_public must be a boolean'),
    ];
  }

  /**
   * Express validator middleware for session ID parameter
   */
  static validateSessionId() {
    return [
      param('sessionId')
        .isString()
        .isLength({ min: 10, max: 100 })
        .matches(/^session_\d+_[a-f0-9]+$/)
        .withMessage('Invalid session ID format'),
    ];
  }

  /**
   * Express validator middleware for share token
   */
  static validateShareToken() {
    return [
      param('shareToken')
        .isString()
        .isLength({ min: 10, max: 100 })
        .isAlphanumeric()
        .withMessage('Invalid share token format'),
    ];
  }

  /**
   * Express validator middleware for guest token
   */
  static validateGuestToken() {
    return [
      body('guest_token')
        .optional()
        .isString()
        .isLength({ min: 10, max: 100 })
        .matches(/^guest_\d+_[a-f0-9]+$/)
        .withMessage('Invalid guest token format'),
    ];
  }

  /**
   * Express validator middleware for pagination
   */
  static validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be a number between 1 and 1000'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be a number between 1 and 100'),
      
      query('sort')
        .optional()
        .isIn(['created_at', 'updated_at', 'name'])
        .withMessage('Sort must be one of: created_at, updated_at, name'),
      
      query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Order must be asc or desc'),
    ];
  }

  /**
   * Middleware to handle validation results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.param || error.path,
        message: error.msg,
        value: error.value,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages,
      });
    }
    
    next();
  }

  /**
   * Validate JSON request body size
   * @param {number} maxSizeMB - Maximum size in MB
   * @returns {Function} Express middleware
   */
  static validateBodySize(maxSizeMB = 10) {
    return (req, res, next) => {
      if (req.body) {
        const bodyStr = JSON.stringify(req.body);
        const sizeMB = Buffer.byteLength(bodyStr, 'utf8') / (1024 * 1024);
        
        if (sizeMB > maxSizeMB) {
          return res.status(413).json({
            error: 'Request body too large',
            maxSize: `${maxSizeMB}MB`,
            actualSize: `${sizeMB.toFixed(2)}MB`,
          });
        }
      }
      
      next();
    };
  }

  /**
   * Sanitize request data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static sanitizeRequest(req, res, next) {
    // Sanitize common string fields in body
    const stringFields = ['name', 'description', 'email', 'username'];
    
    stringFields.forEach(field => {
      if (req.body && req.body[field]) {
        req.body[field] = ValidationUtils.sanitizeString(req.body[field]);
      }
    });
    
    next();
  }

  /**
   * Custom validator for file uploads
   * @param {string} fieldName - Field name to validate
   * @param {Array} allowedTypes - Allowed MIME types
   * @param {number} maxSizeMB - Maximum file size in MB
   * @returns {Function} Express middleware
   */
  static validateFileUpload(fieldName, allowedTypes = [], maxSizeMB = 5) {
    return (req, res, next) => {
      if (!req.files || !req.files[fieldName]) {
        return next(); // No file uploaded, let other validators handle if required
      }
      
      const file = req.files[fieldName];
      
      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          allowed: allowedTypes,
          received: file.mimetype,
        });
      }
      
      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return res.status(413).json({
          error: 'File too large',
          maxSize: `${maxSizeMB}MB`,
          actualSize: `${sizeMB.toFixed(2)}MB`,
        });
      }
      
      next();
    };
  }
}

module.exports = ValidationUtils;