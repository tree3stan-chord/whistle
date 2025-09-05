# Session Management Roadmap

## Phase 1: Local Storage Foundation (No Backend Required)

### Goals
- Complete offline functionality
- Import/export capability  
- Auto-save and recovery
- No external dependencies

### Implementation

#### 1.1 Core Session Manager
```javascript
class LocalSessionManager {
    // Save current notation state
    saveSession(name, metadata)
    
    // Load session from localStorage
    loadSession(sessionId)
    
    // List all saved sessions
    listSessions()
    
    // Export session as .whistle file
    exportSession(sessionId)
    
    // Import .whistle file
    importSession(file)
    
    // Auto-save current work
    enableAutoSave(intervalMs)
    
    // Recover from browser crash
    recoverSession()
}
```

#### 1.2 Session Data Structure
```javascript
{
    metadata: {
        id: "uuid",
        name: "My Recording Session",
        created: "2024-01-15T10:30:00Z",
        modified: "2024-01-15T11:45:00Z",
        version: "1.0",
        tags: ["jazz", "improvisation"],
        duration: 180000, // ms
        noteCount: 45
    },
    configuration: {
        // All staff/audio config settings
        keySignature: "Bb",
        timeSignature: {numerator: 4, denominator: 4},
        tempo: 120,
        clef: "treble",
        autoKeyDetection: true,
        audioConfig: {
            deviceId: "default",
            inputGain: 1.2,
            sensitivity: 0.8
        }
    },
    notation: {
        // All recorded notes with timestamps
        notes: [...],
        measures: [...],
        keyChanges: [...],
        clefChanges: [...]
    },
    analytics: {
        // Optional practice analytics
        pitchAccuracy: 0.92,
        rhythmConsistency: 0.87,
        commonErrors: [...]
    }
}
```

#### 1.3 UI Components
- Session browser/manager
- Save/load dialogs
- Auto-save indicators
- Recovery prompts
- Import/export buttons

### Benefits
✅ Works completely offline
✅ No server costs
✅ Full privacy (data never leaves device)
✅ No account signup friction
✅ Fast and reliable

### Limitations
❌ No cross-device sync
❌ Data lost if localStorage cleared
❌ No sharing/collaboration
❌ Limited to browser storage quotas

---

## Phase 2: Optional Cloud Sync (Pocketbase Backend)

### Goals  
- Cross-device synchronization
- Optional accounts for persistence
- Guest sessions with temporary IDs
- Maintains offline-first approach

### Pocketbase Setup

#### 2.1 Installation
```bash
# Download single binary
wget https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip
unzip pocketbase_0.20.0_linux_amd64.zip
chmod +x pocketbase

# Run with custom config
./pocketbase serve --http="0.0.0.0:8090"
```

#### 2.2 Database Schema
```javascript
// Collections
sessions: {
    id: "string",
    name: "string", 
    user: "relation(users)", // nullable for guests
    guest_token: "string", // for anonymous sessions
    data: "json", // session content
    created: "datetime",
    updated: "datetime",
    public: "boolean" // for sharing
}

users: {
    // Built-in Pocketbase auth
    id, email, username, created, updated
}

shared_sessions: {
    // For public sharing
    session: "relation(sessions)",
    share_token: "string",
    expires: "datetime"
}
```

#### 2.3 API Endpoints
```javascript
// Authentication (optional)
POST /api/auth/guest-session
POST /api/auth/register  
POST /api/auth/login

// Sessions
GET /api/sessions
POST /api/sessions
GET /api/sessions/:id
PUT /api/sessions/:id
DELETE /api/sessions/:id

// Sharing
POST /api/sessions/:id/share
GET /api/shared/:token
```

#### 2.4 Frontend Integration
```javascript
class HybridSessionManager extends LocalSessionManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.pocketbase = new PocketBase('https://whistle-api.yourdomain.com');
    }
    
    // Override save to sync when online
    async saveSession(name, metadata) {
        const session = await super.saveSession(name, metadata);
        
        if (this.isOnline) {
            await this.syncToCloud(session);
        } else {
            this.queueForSync(session);
        }
        
        return session;
    }
    
    // Sync when connection restored
    async syncAll() {
        for (const session of this.syncQueue) {
            await this.syncToCloud(session);
        }
        this.syncQueue = [];
    }
}
```

### Benefits
✅ Cross-device sync
✅ Optional accounts (no forced signup)
✅ Guest sessions work without accounts
✅ Session sharing capability
✅ Still works offline
✅ Minimal server footprint

---

## Phase 3: Advanced Features

### 3.1 Real-time Collaboration
- Multiple users editing same session
- Conflict resolution
- Live cursor positions

### 3.2 Public Gallery
- Users can publish sessions
- Browse community recordings
- Like/comment system

### 3.3 Practice Analytics
- Track improvement over time
- Pitch accuracy metrics
- Rhythm consistency analysis

---

## Deployment Strategy

### Local Development
```bash
# Start Pocketbase locally
./pocketbase serve --dev

# Frontend continues to work normally
# API calls fallback to localStorage if server unavailable
```

### Production Options

#### Option 1: VPS + Systemd
```bash
# /etc/systemd/system/whistle-api.service
[Unit]
Description=Whistle API (Pocketbase)

[Service]
ExecStart=/opt/whistle/pocketbase serve --http="0.0.0.0:8090"
Restart=always
User=whistle

[Install]
WantedBy=multi-user.target
```

#### Option 2: Docker
```dockerfile
FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY pocketbase /usr/local/bin/
EXPOSE 8090
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090"]
```

#### Option 3: Fly.io (Recommended)
```toml
# fly.toml
app = "whistle-api"
primary_region = "dfw"

[http_service]
  internal_port = 8090
  force_https = true
  
[[mounts]]
  source = "whistle_data"
  destination = "/app/pb_data"
```

---

## Implementation Timeline

### Week 1: Local Storage Foundation
- [ ] LocalSessionManager class
- [ ] Session data structure
- [ ] Save/load UI
- [ ] Auto-save functionality
- [ ] Import/export .whistle files

### Week 2: Pocketbase Integration  
- [ ] Pocketbase setup and deployment
- [ ] API client integration
- [ ] Hybrid online/offline sync
- [ ] Guest session support

### Week 3: Advanced Features
- [ ] Session sharing
- [ ] Public gallery
- [ ] User accounts (optional)
- [ ] Real-time sync

---

## Cost Analysis

### Local Only: $0
- No server costs
- No maintenance
- Works forever

### Pocketbase Backend: ~$5-10/month
- **Fly.io**: $5/month (256MB RAM sufficient)
- **Railway**: $5/month
- **VPS**: $5-10/month
- **Storage**: Minimal (SQLite + file uploads)

### Scalability
- Pocketbase handles 1000+ concurrent users easily
- SQLite performs well up to ~100GB
- Horizontal scaling available if needed later

---

## Security Considerations

### Local Storage
- Data encrypted with Web Crypto API
- Sessions stored in IndexedDB for larger size limits
- Export files use symmetric encryption

### Cloud Storage
- JWT authentication
- HTTPS only
- Rate limiting built into Pocketbase
- Guest sessions expire after 30 days
- User sessions persist until deletion

---

## Progressive Enhancement Strategy

1. **Build local-first**: App works completely offline
2. **Add optional sync**: Backend enhances but doesn't replace local storage
3. **Graceful degradation**: If server unavailable, app continues working locally
4. **User choice**: Users can opt into accounts or stay anonymous

This approach ensures the app remains lightweight and user-friendly while providing enterprise-grade features for users who want them.