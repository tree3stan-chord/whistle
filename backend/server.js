const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initializeDatabase, closeDatabase, getDatabase } = require('./config/database');
const config = require('./config');

// Import middleware
const AuthMiddleware = require('./middleware/auth');
const RateLimitMiddleware = require('./middleware/rateLimit');
const ValidationUtils = require('./utils/validation');

// Import routes
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

const app = express();

/**
 * Security middleware configuration
 */

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for web audio
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow SharedArrayBuffer for audio processing
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (config.isDevelopment) {
      return callback(null, true);
    }
    
    // In production, check allowed origins
    const allowedOrigins = config.cors.allowedOrigins;
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'X-Guest-Token',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining', 
    'X-RateLimit-Reset',
  ],
};

app.use(cors(corsOptions));

// Rate limiting - apply pattern tracking to all requests
app.use(RateLimitMiddleware.trackPatterns());

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: config.server.maxRequestSize,
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: config.server.maxRequestSize 
}));

// Request sanitization
app.use(ValidationUtils.sanitizeRequest);

// Trust proxy if behind reverse proxy (nginx, etc.)
if (config.server.trustProxy) {
  app.set('trust proxy', config.server.trustProxy);
}

/**
 * Health check and monitoring
 */

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.environment,
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 as test').get();
    
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: config.isDevelopment ? error.message : 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// System info (development only)
if (config.isDevelopment) {
  app.get('/health/system', (req, res) => {
    const db = getDatabase();
    
    try {
      const stats = {
        database: {
          userCount: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
          sessionCount: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
          guestSessionCount: db.prepare('SELECT COUNT(*) as count FROM guest_sessions').get().count,
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          environment: config.environment,
        },
        features: config.features,
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get system stats',
        message: error.message,
      });
    }
  });
}

/**
 * API Routes
 */

// Apply authentication cleanup middleware to all API routes
app.use('/api', AuthMiddleware.cleanupExpired);

// Authentication routes
app.use('/api/auth', authRoutes);

// Session management routes  
app.use('/api/sessions', sessionRoutes);

// Public shared session access (no /api prefix for easier sharing)
app.use('/shared', (req, res, next) => {
  // Forward to the sessions router shared endpoint
  req.url = '/shared' + req.url;
  sessionRoutes(req, res, next);
});

/**
 * Static file serving for frontend
 */

// Serve static files from public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath, {
  dotfiles: 'ignore',
  etag: true,
  lastModified: true,
  maxAge: config.isDevelopment ? 0 : '1d', // Cache for 1 day in production
  setHeaders: (res, path) => {
    // Set security headers for static files
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  },
}));

// Serve index.html for SPA routes (catch-all)
app.get('*', (req, res, next) => {
  // Skip API routes and shared routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/shared/') || req.path.startsWith('/health')) {
    return next();
  }
  
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Failed to serve index.html:', err);
      res.status(404).json({ 
        error: 'Frontend not found',
        message: 'Make sure the frontend is built and available in the public directory',
      });
    }
  });
});

/**
 * Error handling middleware
 */

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Handle CORS errors
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'This origin is not allowed to access this resource',
    });
  }
  
  // Handle JSON parsing errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
    });
  }
  
  // Handle payload too large
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds limit of ${config.server.maxRequestSize}`,
    });
  }
  
  // Handle rate limit errors
  if (error.statusCode === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message || 'Too many requests',
      retryAfter: error.retryAfter,
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'Internal server error',
    message: config.isDevelopment ? error.message : 'Something went wrong',
    ...(config.isDevelopment && { stack: error.stack }),
  });
});

/**
 * Server initialization and lifecycle management
 */

async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start HTTP server
    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`🎵 Whistle Server running at http://${config.server.host}:${config.server.port}`);
      console.log(`Environment: ${config.environment}`);
      console.log(`Features: ${JSON.stringify(config.features)}`);
      
      if (config.isDevelopment) {
        console.log('\n🚀 Development endpoints:');
        console.log(`   Health: http://${config.server.host}:${config.server.port}/health`);
        console.log(`   DB Health: http://${config.server.host}:${config.server.port}/health/db`);
        console.log(`   System: http://${config.server.host}:${config.server.port}/health/system`);
        console.log(`   API: http://${config.server.host}:${config.server.port}/api/`);
      }
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.server.port} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error closing server:', err);
          process.exit(1);
        }
        
        console.log('✅ HTTP server closed');
        
        // Close database connection
        try {
          closeDatabase();
          console.log('✅ Database connection closed');
        } catch (dbError) {
          console.error('❌ Error closing database:', dbError);
        }
        
        console.log('👋 Goodbye!');
        process.exit(0);
      });
      
      // Force close after timeout
      setTimeout(() => {
        console.error('❌ Forced shutdown due to timeout');
        process.exit(1);
      }, 10000); // 10 seconds
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };