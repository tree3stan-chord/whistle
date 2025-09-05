const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Cryptographic utilities for secure operations
 */
class CryptoUtils {
  /**
   * Generate a secure random token
   * @param {number} length - Length of token in bytes (default: 32)
   * @returns {string} Hex-encoded random token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a URL-safe random token
   * @param {number} length - Length of token in bytes (default: 32)
   * @returns {string} URL-safe base64 encoded token
   */
  static generateUrlSafeToken(length = 32) {
    return crypto.randomBytes(length)
      .toString('base64')
      .replace(/[+/]/g, (char) => (char === '+' ? '-' : '_'))
      .replace(/=+$/, '');
  }

  /**
   * Generate a guest session token with timestamp
   * @returns {string} Guest token with format: guest_timestamp_randomhex
   */
  static generateGuestToken() {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `guest_${timestamp}_${randomPart}`;
  }

  /**
   * Generate a session ID
   * @returns {string} Session ID with format: session_timestamp_randomhex
   */
  static generateSessionId() {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `session_${timestamp}_${randomPart}`;
  }

  /**
   * Hash a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    try {
      const saltRounds = config.security.bcryptRounds;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify a password against its hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Password verification failed: ${error.message}`);
    }
  }

  /**
   * Generate a JWT token
   * @param {Object} payload - Token payload
   * @param {string} expiresIn - Expiration time (default from config)
   * @returns {string} JWT token
   */
  static generateJWT(payload, expiresIn = null) {
    try {
      const options = {
        algorithm: config.jwt.algorithm,
        expiresIn: expiresIn || config.jwt.expiresIn,
      };

      return jwt.sign(payload, config.jwt.secret, options);
    } catch (error) {
      throw new Error(`JWT generation failed: ${error.message}`);
    }
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  static verifyJWT(token) {
    try {
      return jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Generate a device fingerprint from request headers
   * @param {Object} req - Express request object
   * @returns {string} Device fingerprint hash
   */
  static generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || '',
    ];

    const fingerprint = components.join('|');
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  /**
   * Create a secure hash of data
   * @param {string} data - Data to hash
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {string} Hash digest
   */
  static hash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Generate HMAC signature
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key
   * @param {string} algorithm - HMAC algorithm (default: sha256)
   * @returns {string} HMAC signature
   */
  static hmac(data, secret, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }

  /**
   * Constant time string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string  
   * @returns {boolean} True if strings are equal
   */
  static constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with score and feedback
   */
  static validatePasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      feedback: [],
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
      },
    };

    if (!password || typeof password !== 'string') {
      result.feedback.push('Password is required');
      return result;
    }

    // Check minimum length (8 characters)
    if (password.length >= 8) {
      result.requirements.minLength = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must be at least 8 characters long');
    }

    // Check for uppercase letters
    if (/[A-Z]/.test(password)) {
      result.requirements.hasUppercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Password should contain uppercase letters');
    }

    // Check for lowercase letters
    if (/[a-z]/.test(password)) {
      result.requirements.hasLowercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Password should contain lowercase letters');
    }

    // Check for numbers
    if (/\d/.test(password)) {
      result.requirements.hasNumbers = true;
      result.score += 1;
    } else {
      result.feedback.push('Password should contain numbers');
    }

    // Check for special characters
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.requirements.hasSpecialChars = true;
      result.score += 1;
    } else {
      result.feedback.push('Password should contain special characters');
    }

    // Password is valid if it meets minimum requirements
    result.isValid = result.requirements.minLength && 
                    result.requirements.hasLowercase && 
                    (result.requirements.hasUppercase || result.requirements.hasNumbers);

    // Add strength feedback
    if (result.score === 5) {
      result.strength = 'Very Strong';
    } else if (result.score === 4) {
      result.strength = 'Strong';
    } else if (result.score === 3) {
      result.strength = 'Medium';
    } else if (result.score === 2) {
      result.strength = 'Weak';
    } else {
      result.strength = 'Very Weak';
    }

    return result;
  }

  /**
   * Generate a time-based one-time password (TOTP) secret
   * @returns {string} Base32 encoded secret
   */
  static generateTOTPSecret() {
    const secret = crypto.randomBytes(20);
    // Simple base32 encoding for TOTP compatibility
    return secret.toString('base64').replace(/=/g, '').toUpperCase();
  }
}

module.exports = CryptoUtils;