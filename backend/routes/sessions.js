const express = require('express');
const { getDatabase } = require('../config/database');
const AuthMiddleware = require('../middleware/auth');
const RateLimitMiddleware = require('../middleware/rateLimit');
const ValidationUtils = require('../utils/validation');
const CryptoUtils = require('../utils/crypto');
const config = require('../config');

const router = express.Router();

/**
 * Session Management Routes
 * Handles CRUD operations for notation sessions
 */

// Apply authentication and rate limiting middleware
router.use(RateLimitMiddleware.sessions());
router.use(AuthMiddleware.logAuthEvent);

/**
 * GET /sessions
 * List user's sessions with pagination and filtering
 */
router.get('/',
  AuthMiddleware.authenticateGuest,
  ValidationUtils.validatePagination(),
  ValidationUtils.handleValidationErrors,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { page = 1, limit = 20, sort = 'updated_at', order = 'desc' } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const orderClause = `${sort} ${order.toUpperCase()}`;
      
      // Build query based on authentication type
      let query, countQuery, params;
      
      if (req.user) {
        // Authenticated user - show their sessions
        query = `
          SELECT s.session_id, s.name, s.description, s.is_public, 
                 s.created_at, s.updated_at, s.metadata,
                 COUNT(ss.id) as share_count
          FROM sessions s
          LEFT JOIN shared_sessions ss ON s.session_id = ss.session_id
          WHERE s.user_id = ?
          GROUP BY s.session_id
          ORDER BY ${orderClause}
          LIMIT ? OFFSET ?
        `;
        
        countQuery = 'SELECT COUNT(*) as total FROM sessions WHERE user_id = ?';
        params = [req.user.userId, parseInt(limit), offset];
      } else {
        // Guest user - show their sessions
        query = `
          SELECT s.session_id, s.name, s.description, s.is_public,
                 s.created_at, s.updated_at, s.metadata,
                 COUNT(ss.id) as share_count
          FROM sessions s
          LEFT JOIN shared_sessions ss ON s.session_id = ss.session_id
          WHERE s.guest_token = ?
          GROUP BY s.session_id
          ORDER BY ${orderClause}
          LIMIT ? OFFSET ?
        `;
        
        countQuery = 'SELECT COUNT(*) as total FROM sessions WHERE guest_token = ?';
        params = [req.guestToken, parseInt(limit), offset];
      }
      
      // Get sessions
      const sessions = db.prepare(query).all(...params);
      
      // Get total count for pagination
      const countParams = req.user ? [req.user.userId] : [req.guestToken];
      const totalResult = db.prepare(countQuery).get(...countParams);
      const total = totalResult.total;
      
      // Format sessions for response
      const formattedSessions = sessions.map(session => ({
        sessionId: session.session_id,
        name: session.name,
        description: session.description,
        isPublic: Boolean(session.is_public),
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        metadata: JSON.parse(session.metadata || '{}'),
        shareCount: session.share_count,
      }));
      
      res.json({
        sessions: formattedSessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
      
    } catch (error) {
      console.error('Session list error:', error);
      res.status(500).json({
        error: 'Failed to retrieve sessions',
        code: 'SESSION_LIST_FAILED',
      });
    }
  }
);

/**
 * POST /sessions
 * Create a new notation session
 */
router.post('/',
  AuthMiddleware.authenticateGuest,
  RateLimitMiddleware.custom({ windowMs: 60 * 1000, max: 10 }), // 10 per minute
  ValidationUtils.validateSession(),
  ValidationUtils.validateBodySize(10), // 10MB max
  ValidationUtils.handleValidationErrors,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { name, description, data, metadata = {}, is_public = false } = req.body;
      
      const sessionId = CryptoUtils.generateSessionId();
      const now = new Date().toISOString();
      
      // Prepare session data
      const sessionData = {
        session_id: sessionId,
        name: name || 'Untitled Session',
        description: description || '',
        data: JSON.stringify(data),
        metadata: JSON.stringify(metadata),
        is_public: is_public,
        user_id: req.user?.userId || null,
        guest_token: req.user ? null : req.guestToken,
        created_at: now,
        updated_at: now,
      };
      
      // Insert session
      const insertSession = db.prepare(`
        INSERT INTO sessions (
          session_id, name, description, data, metadata, is_public,
          user_id, guest_token, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertSession.run(
        sessionData.session_id,
        sessionData.name,
        sessionData.description,
        sessionData.data,
        sessionData.metadata,
        sessionData.is_public,
        sessionData.user_id,
        sessionData.guest_token,
        sessionData.created_at,
        sessionData.updated_at
      );
      
      console.log(`New session created: ${sessionId} by ${req.user?.email || req.guestToken}`);
      
      res.status(201).json({
        sessionId: sessionId,
        name: sessionData.name,
        description: sessionData.description,
        isPublic: sessionData.is_public,
        createdAt: sessionData.created_at,
        message: 'Session created successfully',
      });
      
    } catch (error) {
      console.error('Session creation error:', error);
      
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Session ID conflict. Please try again.',
          code: 'SESSION_ID_CONFLICT',
        });
      }
      
      res.status(500).json({
        error: 'Failed to create session',
        code: 'SESSION_CREATION_FAILED',
      });
    }
  }
);

/**
 * GET /sessions/:sessionId
 * Get a specific session (with ownership or sharing check)
 */
router.get('/:sessionId',
  ValidationUtils.validateSessionId(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.authenticateGuest,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;
      
      // First check if session exists and get basic info
      const session = db.prepare(`
        SELECT s.*, ss.share_token, ss.permissions, ss.expires_at as share_expires_at
        FROM sessions s
        LEFT JOIN shared_sessions ss ON s.session_id = ss.session_id
        WHERE s.session_id = ?
      `).get(sessionId);
      
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }
      
      // Check access permissions
      const hasUserAccess = req.user && session.user_id === req.user.userId;
      const hasGuestAccess = req.guestToken && session.guest_token === req.guestToken;
      const isPublic = Boolean(session.is_public);
      
      if (!hasUserAccess && !hasGuestAccess && !isPublic) {
        return res.status(403).json({
          error: 'Access denied to private session',
          code: 'SESSION_ACCESS_DENIED',
        });
      }
      
      // Update analytics if enabled
      if (config.features.enableAnalytics) {
        try {
          const insertAnalytics = db.prepare(`
            INSERT INTO session_analytics (
              session_id, user_id, guest_token, action, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          insertAnalytics.run(
            sessionId,
            req.user?.userId || null,
            req.guestToken || null,
            'view',
            req.ip,
            req.get('User-Agent') || ''
          );
        } catch (analyticsError) {
          console.warn('Analytics logging failed:', analyticsError);
        }
      }
      
      // Format response
      const response = {
        sessionId: session.session_id,
        name: session.name,
        description: session.description,
        data: JSON.parse(session.data),
        metadata: JSON.parse(session.metadata || '{}'),
        isPublic: Boolean(session.is_public),
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        access: {
          canEdit: hasUserAccess || hasGuestAccess,
          canShare: hasUserAccess || hasGuestAccess,
          isOwner: hasUserAccess || hasGuestAccess,
          accessType: hasUserAccess ? 'owner' : hasGuestAccess ? 'owner' : 'public',
        },
      };
      
      // Add share info if applicable
      if (session.share_token) {
        response.sharing = {
          shareToken: session.share_token,
          permissions: session.permissions,
          expiresAt: session.share_expires_at,
        };
      }
      
      res.json(response);
      
    } catch (error) {
      console.error('Session retrieval error:', error);
      res.status(500).json({
        error: 'Failed to retrieve session',
        code: 'SESSION_RETRIEVAL_FAILED',
      });
    }
  }
);

/**
 * PUT /sessions/:sessionId
 * Update a session (requires ownership)
 */
router.put('/:sessionId',
  ValidationUtils.validateSessionId(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.authenticateGuest,
  AuthMiddleware.requireSessionOwnership,
  ValidationUtils.validateSession(),
  ValidationUtils.validateBodySize(10), // 10MB max
  ValidationUtils.handleValidationErrors,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;
      const { name, description, data, metadata, is_public } = req.body;
      
      const updates = [];
      const values = [];
      
      // Build dynamic update query
      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      
      if (data !== undefined) {
        updates.push('data = ?');
        values.push(JSON.stringify(data));
      }
      
      if (metadata !== undefined) {
        updates.push('metadata = ?');
        values.push(JSON.stringify(metadata));
      }
      
      if (is_public !== undefined) {
        updates.push('is_public = ?');
        values.push(is_public);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_UPDATE_FIELDS',
        });
      }
      
      // Always update the updated_at timestamp
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(sessionId);
      
      const updateQuery = `
        UPDATE sessions 
        SET ${updates.join(', ')}
        WHERE session_id = ?
      `;
      
      const result = db.prepare(updateQuery).run(...values);
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Session not found or no changes made',
          code: 'SESSION_UPDATE_FAILED',
        });
      }
      
      console.log(`Session updated: ${sessionId} by ${req.user?.email || req.guestToken}`);
      
      res.json({
        sessionId: sessionId,
        message: 'Session updated successfully',
        updatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Session update error:', error);
      res.status(500).json({
        error: 'Failed to update session',
        code: 'SESSION_UPDATE_FAILED',
      });
    }
  }
);

/**
 * DELETE /sessions/:sessionId
 * Delete a session (requires ownership)
 */
router.delete('/:sessionId',
  ValidationUtils.validateSessionId(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.authenticateGuest,
  AuthMiddleware.requireSessionOwnership,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;
      
      // Use transaction to ensure cleanup
      const deleteTransaction = db.transaction(() => {
        // Delete related shared sessions first
        db.prepare('DELETE FROM shared_sessions WHERE session_id = ?').run(sessionId);
        
        // Delete analytics data
        db.prepare('DELETE FROM session_analytics WHERE session_id = ?').run(sessionId);
        
        // Delete the session itself
        const result = db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
        
        return result;
      });
      
      const result = deleteTransaction();
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }
      
      console.log(`Session deleted: ${sessionId} by ${req.user?.email || req.guestToken}`);
      
      res.json({
        message: 'Session deleted successfully',
        sessionId: sessionId,
      });
      
    } catch (error) {
      console.error('Session deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete session',
        code: 'SESSION_DELETION_FAILED',
      });
    }
  }
);

/**
 * POST /sessions/:sessionId/share
 * Create a share link for a session
 */
router.post('/:sessionId/share',
  ValidationUtils.validateSessionId(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.authenticateGuest,
  AuthMiddleware.requireSessionOwnership,
  RateLimitMiddleware.sharing(),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;
      const { permissions = 'read', expiresIn } = req.body;
      
      // Validate permissions
      const validPermissions = ['read', 'comment'];
      if (!validPermissions.includes(permissions)) {
        return res.status(400).json({
          error: 'Invalid permissions. Must be: read, comment',
          code: 'INVALID_PERMISSIONS',
        });
      }
      
      // Calculate expiry
      let expiresAt = null;
      if (expiresIn) {
        const expiryMs = parseInt(expiresIn) * 1000;
        if (expiryMs > 0 && expiryMs <= 30 * 24 * 60 * 60 * 1000) { // Max 30 days
          expiresAt = new Date(Date.now() + expiryMs).toISOString();
        }
      }
      
      const shareToken = CryptoUtils.generateToken(16);
      
      // Check if share already exists
      const existing = db.prepare('SELECT share_token FROM shared_sessions WHERE session_id = ?').get(sessionId);
      
      if (existing) {
        // Update existing share
        db.prepare(`
          UPDATE shared_sessions 
          SET permissions = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `).run(permissions, expiresAt, sessionId);
        
        res.json({
          shareToken: existing.share_token,
          permissions: permissions,
          expiresAt: expiresAt,
          shareUrl: `${req.protocol}://${req.get('host')}/shared/${existing.share_token}`,
          message: 'Share settings updated',
        });
      } else {
        // Create new share
        db.prepare(`
          INSERT INTO shared_sessions (session_id, share_token, permissions, expires_at)
          VALUES (?, ?, ?, ?)
        `).run(sessionId, shareToken, permissions, expiresAt);
        
        res.status(201).json({
          shareToken: shareToken,
          permissions: permissions,
          expiresAt: expiresAt,
          shareUrl: `${req.protocol}://${req.get('host')}/shared/${shareToken}`,
          message: 'Share link created',
        });
      }
      
    } catch (error) {
      console.error('Share creation error:', error);
      res.status(500).json({
        error: 'Failed to create share link',
        code: 'SHARE_CREATION_FAILED',
      });
    }
  }
);

/**
 * DELETE /sessions/:sessionId/share
 * Remove sharing for a session
 */
router.delete('/:sessionId/share',
  ValidationUtils.validateSessionId(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.authenticateGuest,
  AuthMiddleware.requireSessionOwnership,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;
      
      const result = db.prepare('DELETE FROM shared_sessions WHERE session_id = ?').run(sessionId);
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'No share link found for this session',
          code: 'SHARE_NOT_FOUND',
        });
      }
      
      res.json({
        message: 'Share link removed successfully',
        sessionId: sessionId,
      });
      
    } catch (error) {
      console.error('Share removal error:', error);
      res.status(500).json({
        error: 'Failed to remove share link',
        code: 'SHARE_REMOVAL_FAILED',
      });
    }
  }
);

/**
 * GET /shared/:shareToken
 * Access a shared session via share token
 */
router.get('/shared/:shareToken',
  ValidationUtils.validateShareToken(),
  ValidationUtils.handleValidationErrors,
  AuthMiddleware.logAuthEvent,
  async (req, res) => {
    try {
      const db = getDatabase();
      const { shareToken } = req.params;
      
      // Get shared session info
      const sharedSession = db.prepare(`
        SELECT ss.*, s.session_id, s.name, s.description, s.data, 
               s.metadata, s.created_at, s.updated_at
        FROM shared_sessions ss
        JOIN sessions s ON ss.session_id = s.session_id
        WHERE ss.share_token = ?
        AND (ss.expires_at IS NULL OR ss.expires_at > datetime('now'))
      `).get(shareToken);
      
      if (!sharedSession) {
        return res.status(404).json({
          error: 'Share link not found or expired',
          code: 'SHARE_NOT_FOUND',
        });
      }
      
      // Log analytics if enabled
      if (config.features.enableAnalytics) {
        try {
          db.prepare(`
            INSERT INTO session_analytics (
              session_id, action, ip_address, user_agent, metadata
            ) VALUES (?, ?, ?, ?, ?)
          `).run(
            sharedSession.session_id,
            'shared_view',
            req.ip,
            req.get('User-Agent') || '',
            JSON.stringify({ shareToken })
          );
        } catch (analyticsError) {
          console.warn('Analytics logging failed:', analyticsError);
        }
      }
      
      // Format response
      res.json({
        sessionId: sharedSession.session_id,
        name: sharedSession.name,
        description: sharedSession.description,
        data: JSON.parse(sharedSession.data),
        metadata: JSON.parse(sharedSession.metadata || '{}'),
        createdAt: sharedSession.created_at,
        updatedAt: sharedSession.updated_at,
        sharing: {
          shareToken: shareToken,
          permissions: sharedSession.permissions,
          expiresAt: sharedSession.expires_at,
        },
        access: {
          canEdit: false, // Shared sessions are read-only by default
          canShare: false,
          isOwner: false,
          accessType: 'shared',
          permissions: sharedSession.permissions,
        },
      });
      
    } catch (error) {
      console.error('Shared session access error:', error);
      res.status(500).json({
        error: 'Failed to access shared session',
        code: 'SHARED_ACCESS_FAILED',
      });
    }
  }
);

module.exports = router;