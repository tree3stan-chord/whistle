-- Whistle Database Schema
-- SQLite database for session management and user authentication

-- Users table (optional accounts)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    reset_password_token TEXT,
    reset_password_expires DATETIME
);

-- Guest sessions (anonymous usage)
CREATE TABLE IF NOT EXISTS guest_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_token TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER, -- NULL until claimed by account
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Music sessions (the actual saved projects)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER, -- NULL for guest sessions
    guest_token TEXT, -- for anonymous sessions
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    data TEXT NOT NULL, -- JSON blob with all notation data
    metadata TEXT DEFAULT '{}', -- JSON with stats, key sig, tempo, etc
    is_public BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1, -- for optimistic locking
    size_bytes INTEGER DEFAULT 0, -- track data size
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (guest_token) REFERENCES guest_sessions(guest_token) ON DELETE CASCADE,
    CONSTRAINT valid_ownership CHECK (
        (user_id IS NOT NULL AND guest_token IS NULL) OR 
        (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

-- Shared sessions (public links)
CREATE TABLE IF NOT EXISTS shared_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    created_by INTEGER, -- user who created the share
    expires_at DATETIME,
    view_count INTEGER DEFAULT 0,
    max_views INTEGER, -- optional view limit
    password_hash TEXT, -- optional password protection
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Session analytics (optional performance tracking)
CREATE TABLE IF NOT EXISTS session_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id INTEGER,
    guest_token TEXT,
    event_type TEXT NOT NULL, -- 'create', 'update', 'play', 'export', 'share'
    event_data TEXT, -- JSON with event details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- API request logs (for rate limiting and monitoring)
CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    user_id INTEGER,
    guest_token TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON guest_sessions(guest_token);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires ON guest_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_user_id ON guest_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_guest_token ON sessions(guest_token);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_public ON sessions(is_public);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_shared_sessions_token ON shared_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_session_id ON shared_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_expires ON shared_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_active ON shared_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON session_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON session_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON session_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_request_logs_ip ON request_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions
    BEGIN
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_guest_activity 
    AFTER UPDATE ON sessions
    WHEN NEW.guest_token IS NOT NULL
    BEGIN
        UPDATE guest_sessions 
        SET last_activity = CURRENT_TIMESTAMP 
        WHERE guest_token = NEW.guest_token;
    END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS user_session_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(s.id) as session_count,
    MAX(s.updated_at) as last_session_update,
    SUM(s.size_bytes) as total_storage_bytes
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id, u.email;

CREATE VIEW IF NOT EXISTS session_details AS
SELECT 
    s.session_id,
    s.name,
    s.description,
    s.is_public,
    s.size_bytes,
    s.created_at,
    s.updated_at,
    CASE 
        WHEN s.user_id IS NOT NULL THEN 'user'
        ELSE 'guest'
    END as owner_type,
    COALESCE(u.email, 'guest') as owner_identifier,
    COUNT(ss.id) as share_count,
    MAX(ss.view_count) as max_share_views
FROM sessions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN shared_sessions ss ON s.session_id = ss.session_id AND ss.is_active = 1
GROUP BY s.session_id;

-- Cleanup procedures (for maintenance)
-- Remove expired guest sessions
-- DELETE FROM guest_sessions WHERE expires_at < datetime('now');

-- Remove orphaned sessions (guests expired, but sessions remain)
-- DELETE FROM sessions WHERE guest_token NOT IN (SELECT guest_token FROM guest_sessions);

-- Archive old analytics (move to separate table or export)
-- DELETE FROM session_analytics WHERE created_at < datetime('now', '-90 days');

-- Remove old request logs
-- DELETE FROM request_logs WHERE created_at < datetime('now', '-30 days');