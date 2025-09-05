# Node.js Backend Architecture Plan

## Overview: Progressive Authentication Strategy

### Core Philosophy: Guest-First, Accounts Optional
- **Guest Sessions**: Work immediately with browser fingerprinting + tokens
- **Optional Accounts**: Users can "claim" their guest sessions later
- **Seamless Upgrade**: Guest → Account without losing data
- **Privacy-First**: Anonymous usage fully supported

## Technical Stack

```
Frontend: Vanilla JS (existing)
Backend: Node.js + Express + SQLite
Auth: JWT + bcrypt
Session Store: SQLite + memory cache
Process Management: PM2 (simple systemd alternative)
```

## Authentication Flow Design

### Phase 1: Guest Sessions (No Account Required)
```javascript
// User visits site
1. Frontend generates device fingerprint + random token
2. Backend creates guest session with 30-day expiry
3. User creates music, saves to guest session
4. All data tied to guest token (stored in localStorage)
```

### Phase 2: Optional Account Creation
```javascript
// User wants to save permanently / access from other devices
1. User clicks "Create Account" (email + password)
2. Backend migrates all guest sessions to new account
3. Guest token becomes linked to user account
4. User can now login from other devices
```

### Phase 3: Cross-Device Sync
```javascript
// User logs in from another device
1. Frontend gets JWT token after login
2. Backend returns all sessions for that user
3. Local storage syncs with server data
4. Offline-first approach continues working
```

## File Structure

```
whistle/
├── frontend/ (existing files)
│   ├── index.html
│   ├── js/
│   └── styles.css
├── backend/
│   ├── server.js (main Express app)
│   ├── package.json
│   ├── config/
│   │   ├── database.js
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Session.js
│   │   └── GuestSession.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── sessions.js
│   │   └── guest.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rateLimit.js
│   └── utils/
│       ├── crypto.js
│       └── validation.js
├── data/
│   └── whistle.db (SQLite database)
└── scripts/
    ├── start.sh
    └── deploy.sh
```

## Database Schema

```sql
-- Users table (optional accounts)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME
);

-- Guest sessions (anonymous usage)
CREATE TABLE guest_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_token TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    user_id INTEGER, -- NULL until claimed by account
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Music sessions (the actual saved projects)
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER, -- NULL for guest sessions
    guest_token TEXT, -- for anonymous sessions
    name TEXT NOT NULL,
    description TEXT,
    data TEXT NOT NULL, -- JSON blob with all notation data
    metadata TEXT, -- JSON with stats, key sig, tempo, etc
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (guest_token) REFERENCES guest_sessions(guest_token)
);

-- Shared sessions (public links)
CREATE TABLE shared_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Simple analytics (optional)
CREATE TABLE session_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'create', 'update', 'play', 'export'
    metadata TEXT, -- JSON with event details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_guest_token ON sessions(guest_token);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX idx_guest_sessions_token ON guest_sessions(guest_token);
CREATE INDEX idx_shared_sessions_token ON shared_sessions(share_token);
```

## Backend Implementation

### 1. Main Server (backend/server.js)
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const guestRoutes = require('./routes/guest');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for music notation
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Large limit for session data
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/guest', guestRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to frontend for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
    try {
        await initDatabase();
        console.log('Database initialized');
        
        app.listen(PORT, () => {
            console.log(`Whistle backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
```

### 2. Database Config (backend/config/database.js)
```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/whistle.db');
const SCHEMA_PATH = path.join(__dirname, '../schema.sql');

let db = null;

function initDatabase() {
    return new Promise((resolve, reject) => {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // Initialize SQLite database
            db = new Database(DB_PATH);
            
            // Enable WAL mode for better concurrent access
            db.pragma('journal_mode = WAL');
            
            // Create tables if they don't exist
            const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
            db.exec(schema);
            
            console.log(`Database initialized at ${DB_PATH}`);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

module.exports = {
    initDatabase,
    getDatabase
};
```

### 3. Auth Routes (backend/routes/auth.js)
```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { validateEmail, validatePassword } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, guestToken } = req.body;
        
        // Validation
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const db = getDatabase();
        
        // Check if email already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        
        // Create user
        const insertUser = db.prepare(`
            INSERT INTO users (email, password_hash)
            VALUES (?, ?)
        `);
        
        const result = insertUser.run(email, passwordHash);
        const userId = result.lastInsertRowid;
        
        // If user had guest sessions, migrate them
        if (guestToken) {
            const migrateGuest = db.prepare(`
                UPDATE guest_sessions 
                SET user_id = ? 
                WHERE guest_token = ?
            `);
            migrateGuest.run(userId, guestToken);
            
            const migrateSessions = db.prepare(`
                UPDATE sessions 
                SET user_id = ? 
                WHERE guest_token = ?
            `);
            migrateSessions.run(userId, guestToken);
        }
        
        // Generate JWT token
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
        
        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id: userId, email }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = getDatabase();
        
        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
          .run(user.id);
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            JWT_SECRET, 
            { expiresIn: '30d' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
    const db = getDatabase();
    const user = db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?')
                  .get(req.user.userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
});

module.exports = router;
```

### 4. Session Routes (backend/routes/sessions.js)
```javascript
const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, authenticateGuest } = require('../middleware/auth');
const { validateSessionData } = require('../utils/validation');

const router = express.Router();

// Get all sessions for user/guest
router.get('/', authenticateGuest, (req, res) => {
    try {
        const db = getDatabase();
        let query, params;
        
        if (req.user?.userId) {
            // Authenticated user - get all their sessions
            query = `
                SELECT session_id, name, description, created_at, updated_at, is_public
                FROM sessions 
                WHERE user_id = ? 
                ORDER BY updated_at DESC
            `;
            params = [req.user.userId];
        } else {
            // Guest user - get sessions by guest token
            query = `
                SELECT session_id, name, description, created_at, updated_at, is_public
                FROM sessions 
                WHERE guest_token = ? 
                ORDER BY updated_at DESC
            `;
            params = [req.guestToken];
        }
        
        const sessions = db.prepare(query).all(...params);
        res.json({ sessions });
        
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});

// Get specific session
router.get('/:sessionId', authenticateGuest, (req, res) => {
    try {
        const db = getDatabase();
        const { sessionId } = req.params;
        
        let query = `
            SELECT * FROM sessions 
            WHERE session_id = ? AND (
        `;
        let params = [sessionId];
        
        if (req.user?.userId) {
            query += 'user_id = ? OR is_public = 1)';
            params.push(req.user.userId);
        } else {
            query += 'guest_token = ? OR is_public = 1)';
            params.push(req.guestToken);
        }
        
        const session = db.prepare(query).get(...params);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Parse JSON data
        session.data = JSON.parse(session.data);
        session.metadata = JSON.parse(session.metadata || '{}');
        
        res.json({ session });
        
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({ error: 'Failed to retrieve session' });
    }
});

// Create new session
router.post('/', authenticateGuest, (req, res) => {
    try {
        const sessionData = req.body;
        
        if (!validateSessionData(sessionData)) {
            return res.status(400).json({ error: 'Invalid session data' });
        }
        
        const db = getDatabase();
        const sessionId = sessionData.session_id || generateSessionId();
        
        const insertSession = db.prepare(`
            INSERT INTO sessions (session_id, user_id, guest_token, name, description, data, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertSession.run(
            sessionId,
            req.user?.userId || null,
            req.guestToken || null,
            sessionData.name || 'Untitled Session',
            sessionData.description || '',
            JSON.stringify(sessionData.data || {}),
            JSON.stringify(sessionData.metadata || {})
        );
        
        res.status(201).json({
            session_id: sessionId,
            message: 'Session created successfully'
        });
        
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update session
router.put('/:sessionId', authenticateGuest, (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionData = req.body;
        
        if (!validateSessionData(sessionData)) {
            return res.status(400).json({ error: 'Invalid session data' });
        }
        
        const db = getDatabase();
        
        const updateSession = db.prepare(`
            UPDATE sessions 
            SET name = ?, description = ?, data = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ? AND (user_id = ? OR guest_token = ?)
        `);
        
        const result = updateSession.run(
            sessionData.name || 'Untitled Session',
            sessionData.description || '',
            JSON.stringify(sessionData.data || {}),
            JSON.stringify(sessionData.metadata || {}),
            sessionId,
            req.user?.userId || null,
            req.guestToken || null
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Session not found or not authorized' });
        }
        
        res.json({ message: 'Session updated successfully' });
        
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Delete session
router.delete('/:sessionId', authenticateGuest, (req, res) => {
    try {
        const { sessionId } = req.params;
        const db = getDatabase();
        
        const deleteSession = db.prepare(`
            DELETE FROM sessions 
            WHERE session_id = ? AND (user_id = ? OR guest_token = ?)
        `);
        
        const result = deleteSession.run(
            sessionId,
            req.user?.userId || null,
            req.guestToken || null
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Session not found or not authorized' });
        }
        
        res.json({ message: 'Session deleted successfully' });
        
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

module.exports = router;
```

## Deployment Strategy

### 1. Package.json
```json
{
    "name": "whistle-backend",
    "version": "1.0.0",
    "description": "Backend API for Whistle music notation app",
    "main": "server.js",
    "scripts": {
        "start": "node server.js",
        "dev": "nodemon server.js",
        "test": "jest"
    },
    "dependencies": {
        "express": "^4.18.2",
        "better-sqlite3": "^8.7.0",
        "bcrypt": "^5.1.0",
        "jsonwebtoken": "^9.0.2",
        "cors": "^2.8.5",
        "helmet": "^7.0.0",
        "express-rate-limit": "^6.10.0"
    },
    "devDependencies": {
        "nodemon": "^3.0.1",
        "jest": "^29.7.0"
    }
}
```

### 2. Process Management (PM2)
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'whistle-api',
        script: './backend/server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3001
        }
    }]
};
```

### 3. Systemd Service (Alternative to PM2)
```ini
# /etc/systemd/system/whistle-api.service
[Unit]
Description=Whistle API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/whistle
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

## Frontend Integration Changes

The frontend will need minimal changes - mainly updating API endpoints from PHP to Node.js format, but the session manager architecture remains the same.

## Benefits of This Architecture

✅ **Guest-first**: No forced account creation
✅ **Progressive enhancement**: Guest → Account seamless upgrade
✅ **Offline-first**: Works without backend
✅ **Familiar stack**: Node.js + Express standard patterns
✅ **SQLite**: Single file database (your preference)
✅ **JWT auth**: Stateless, secure, scalable
✅ **Easy deployment**: PM2 or systemd, no complex configuration

Want me to start implementing this step by step?