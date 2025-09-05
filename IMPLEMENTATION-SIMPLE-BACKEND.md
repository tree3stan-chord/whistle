# Simple Backend Implementation: PHP + SQLite

## Why This Approach Is Perfect

✅ **Zero Configuration**: Upload PHP files, they just work
✅ **Uses Your Existing Web Server**: Apache/Nginx already handles PHP
✅ **SQLite**: Single database file, your preference
✅ **No Process Management**: No gunicorn/uwsgi complexity
✅ **Familiar**: Standard LAMP-style development
✅ **Lightweight**: Minimal resource usage
✅ **Secure**: Standard web server security model

## File Structure

```
whistle/
├── index.html (existing frontend)
├── js/ (existing frontend code)
├── api/
│   ├── sessions.php (main API endpoint)
│   ├── config.php (database config)
│   └── database.sql (schema)
└── data/
    └── whistle.db (SQLite database file)
```

## Implementation

### 1. Database Schema (database.sql)
```sql
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    guest_token TEXT,
    user_id INTEGER,
    name TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON blob
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_session_id ON sessions(session_id);
CREATE INDEX idx_guest_token ON sessions(guest_token);
CREATE INDEX idx_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

### 2. Database Config (api/config.php)
```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

class Database {
    private static $instance = null;
    private $db;
    
    private function __construct() {
        $dbPath = __DIR__ . '/../data/whistle.db';
        
        // Create data directory if it doesn't exist
        $dataDir = dirname($dbPath);
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0755, true);
        }
        
        // Create database if it doesn't exist
        $this->db = new SQLite3($dbPath);
        $this->db->enableExceptions(true);
        
        // Create tables
        $this->initializeTables();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->db;
    }
    
    private function initializeTables() {
        $schema = file_get_contents(__DIR__ . '/database.sql');
        $this->db->exec($schema);
    }
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function generateToken() {
    return bin2hex(random_bytes(32));
}

function validateSessionData($data) {
    if (!isset($data['metadata']) || !isset($data['notation'])) {
        return false;
    }
    return true;
}
?>
```

### 3. Main API (api/sessions.php)
```php
<?php
require_once 'config.php';

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Simple routing
$endpoint = $pathParts[count($pathParts) - 1];

switch ($method) {
    case 'GET':
        if (isset($_GET['session_id'])) {
            getSession($_GET['session_id']);
        } elseif (isset($_GET['guest_token'])) {
            getSessionsByGuest($_GET['guest_token']);
        } else {
            getAllSessions();
        }
        break;
        
    case 'POST':
        createSession();
        break;
        
    case 'PUT':
        if (isset($_GET['session_id'])) {
            updateSession($_GET['session_id']);
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['session_id'])) {
            deleteSession($_GET['session_id']);
        }
        break;
        
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function getAllSessions() {
    global $db;
    
    $guestToken = $_GET['guest_token'] ?? null;
    
    if ($guestToken) {
        $stmt = $db->prepare('SELECT session_id, name, created_at, updated_at FROM sessions WHERE guest_token = ? ORDER BY updated_at DESC');
        $stmt->bindValue(1, $guestToken, SQLITE3_TEXT);
    } else {
        $stmt = $db->prepare('SELECT session_id, name, created_at, updated_at FROM sessions WHERE is_public = 1 ORDER BY updated_at DESC LIMIT 50');
    }
    
    $result = $stmt->execute();
    $sessions = [];
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $sessions[] = $row;
    }
    
    jsonResponse(['sessions' => $sessions]);
}

function getSession($sessionId) {
    global $db;
    
    $stmt = $db->prepare('SELECT * FROM sessions WHERE session_id = ?');
    $stmt->bindValue(1, $sessionId, SQLITE3_TEXT);
    $result = $stmt->execute();
    $session = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$session) {
        jsonResponse(['error' => 'Session not found'], 404);
    }
    
    // Parse JSON data
    $session['data'] = json_decode($session['data'], true);
    
    jsonResponse(['session' => $session]);
}

function createSession() {
    global $db;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !validateSessionData($input)) {
        jsonResponse(['error' => 'Invalid session data'], 400);
    }
    
    $sessionId = $input['session_id'] ?? uniqid('whistle_', true);
    $guestToken = $input['guest_token'] ?? generateToken();
    $name = $input['name'] ?? 'Unnamed Session';
    $data = json_encode($input);
    $isPublic = $input['is_public'] ?? false;
    
    try {
        $stmt = $db->prepare('INSERT INTO sessions (session_id, guest_token, name, data, is_public) VALUES (?, ?, ?, ?, ?)');
        $stmt->bindValue(1, $sessionId, SQLITE3_TEXT);
        $stmt->bindValue(2, $guestToken, SQLITE3_TEXT);
        $stmt->bindValue(3, $name, SQLITE3_TEXT);
        $stmt->bindValue(4, $data, SQLITE3_TEXT);
        $stmt->bindValue(5, $isPublic ? 1 : 0, SQLITE3_INTEGER);
        $stmt->execute();
        
        jsonResponse([
            'session_id' => $sessionId,
            'guest_token' => $guestToken,
            'message' => 'Session created successfully'
        ], 201);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'Failed to create session'], 500);
    }
}

function updateSession($sessionId) {
    global $db;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !validateSessionData($input)) {
        jsonResponse(['error' => 'Invalid session data'], 400);
    }
    
    $name = $input['name'] ?? 'Unnamed Session';
    $data = json_encode($input);
    
    try {
        $stmt = $db->prepare('UPDATE sessions SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?');
        $stmt->bindValue(1, $name, SQLITE3_TEXT);
        $stmt->bindValue(2, $data, SQLITE3_TEXT);
        $stmt->bindValue(3, $sessionId, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        if ($db->changes() === 0) {
            jsonResponse(['error' => 'Session not found'], 404);
        }
        
        jsonResponse(['message' => 'Session updated successfully']);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'Failed to update session'], 500);
    }
}

function deleteSession($sessionId) {
    global $db;
    
    try {
        $stmt = $db->prepare('DELETE FROM sessions WHERE session_id = ?');
        $stmt->bindValue(1, $sessionId, SQLITE3_TEXT);
        $stmt->execute();
        
        if ($db->changes() === 0) {
            jsonResponse(['error' => 'Session not found'], 404);
        }
        
        jsonResponse(['message' => 'Session deleted successfully']);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'Failed to delete session'], 500);
    }
}
?>
```

## Frontend Integration

### 4. Session Manager with API (js/session-manager.js)
```javascript
class SessionManager {
    constructor() {
        this.apiBase = '/whistle/api';
        this.guestToken = localStorage.getItem('whistle_guest_token') || this.generateGuestToken();
        this.isOnline = navigator.onLine;
        this.localSessions = new Map(); // Local storage cache
        
        // Listen for online/offline
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }
    
    generateGuestToken() {
        const token = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('whistle_guest_token', token);
        return token;
    }
    
    async saveSession(sessionData, name) {
        const sessionId = sessionData.metadata?.id || this.generateSessionId();
        
        const session = {
            session_id: sessionId,
            guest_token: this.guestToken,
            name: name,
            metadata: sessionData.metadata,
            configuration: sessionData.configuration,
            notation: sessionData.notation,
            is_public: false
        };
        
        // Always save locally first
        this.saveToLocalStorage(sessionId, session);
        
        // Try to sync to server if online
        if (this.isOnline) {
            try {
                await this.syncToServer(session);
                console.log('Session synced to server');
            } catch (error) {
                console.warn('Server sync failed, saved locally only:', error);
            }
        }
        
        return sessionId;
    }
    
    async loadSession(sessionId) {
        // Try local first
        let session = this.loadFromLocalStorage(sessionId);
        
        // If not local and we're online, try server
        if (!session && this.isOnline) {
            try {
                session = await this.loadFromServer(sessionId);
                if (session) {
                    this.saveToLocalStorage(sessionId, session);
                }
            } catch (error) {
                console.warn('Server load failed:', error);
            }
        }
        
        return session;
    }
    
    async listSessions() {
        let sessions = this.listLocalSessions();
        
        // Merge with server sessions if online
        if (this.isOnline) {
            try {
                const serverSessions = await this.listServerSessions();
                // Merge and deduplicate
                const sessionMap = new Map();
                [...sessions, ...serverSessions].forEach(s => sessionMap.set(s.session_id, s));
                sessions = Array.from(sessionMap.values());
            } catch (error) {
                console.warn('Server session list failed:', error);
            }
        }
        
        return sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }
    
    // Local storage methods
    saveToLocalStorage(sessionId, session) {
        const key = `whistle_session_${sessionId}`;
        localStorage.setItem(key, JSON.stringify(session));
    }
    
    loadFromLocalStorage(sessionId) {
        const key = `whistle_session_${sessionId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
    
    listLocalSessions() {
        const sessions = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('whistle_session_')) {
                try {
                    const session = JSON.parse(localStorage.getItem(key));
                    sessions.push({
                        session_id: session.session_id,
                        name: session.name,
                        created_at: session.metadata.created,
                        updated_at: session.metadata.modified,
                        source: 'local'
                    });
                } catch (e) {
                    console.warn('Failed to parse local session:', key);
                }
            }
        }
        return sessions;
    }
    
    // Server API methods
    async syncToServer(session) {
        const response = await fetch(`${this.apiBase}/sessions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session)
        });
        
        if (!response.ok) {
            throw new Error('Server sync failed');
        }
        
        return await response.json();
    }
    
    async loadFromServer(sessionId) {
        const response = await fetch(`${this.apiBase}/sessions.php?session_id=${sessionId}`);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        return data.session;
    }
    
    async listServerSessions() {
        const response = await fetch(`${this.apiBase}/sessions.php?guest_token=${this.guestToken}`);
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        return data.sessions.map(s => ({ ...s, source: 'server' }));
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    handleOnline() {
        this.isOnline = true;
        console.log('Back online - syncing sessions...');
        // Optionally sync all pending local sessions
    }
    
    handleOffline() {
        this.isOnline = false;
        console.log('Offline - saving locally only');
    }
}
```

## Deployment Steps

### 1. Upload Files to Your Web Server
```bash
# Upload to your existing web server
scp -r whistle/ user@yourserver.com:/var/www/html/
```

### 2. Set Permissions
```bash
# Make sure PHP can write to data directory
chmod 755 /var/www/html/whistle/data
chmod 644 /var/www/html/whistle/data/whistle.db  # after first creation
```

### 3. Test API
```bash
# Test that it works
curl https://yourserver.com/whistle/api/sessions.php
```

## Benefits of This Approach

✅ **No Configuration**: Upload files and it works
✅ **Uses Your Existing Setup**: No new services to configure
✅ **SQLite**: Single database file, easy backups
✅ **Offline-First**: App works without backend
✅ **Guest Sessions**: No forced user accounts
✅ **Secure**: Standard web server security model
✅ **Lightweight**: Minimal resource usage
✅ **Familiar**: Standard web development patterns

## Backup Strategy

```bash
# Simple backup of entire data directory
cp /var/www/html/whistle/data/whistle.db /backups/whistle-$(date +%Y%m%d).db
```

This approach gives you the best of both worlds: the simplicity of static files with the power of database persistence, all running on your existing web server infrastructure with zero configuration headaches!