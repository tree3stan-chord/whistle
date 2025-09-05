/**
 * Session Manager - Hybrid API Integration
 * Handles authentication, session persistence, and offline/online synchronization
 */

class SessionManager {
    constructor(app) {
        this.app = app;
        this.apiBase = '/api';
        this.isOnline = navigator.onLine;
        this.currentSession = null;
        this.authToken = null;
        this.guestToken = null;
        this.user = null;
        this.pendingSync = [];
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
        
        this.init();
    }
    
    async init() {
        // Setup connectivity monitoring
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Load auth state from localStorage
        this.loadAuthState();
        
        // Initialize guest session or validate existing auth
        await this.initializeAuth();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Setup UI event handlers
        this.bindAuthUI();
        
        console.log('Session Manager initialized');
    }
    
    /**
     * Authentication Management
     */
    
    loadAuthState() {
        try {
            this.authToken = localStorage.getItem('whistle_auth_token');
            this.guestToken = localStorage.getItem('whistle_guest_token');
            const userData = localStorage.getItem('whistle_user');
            this.user = userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.warn('Failed to load auth state:', error);
            this.clearAuthState();
        }
    }
    
    saveAuthState() {
        try {
            if (this.authToken) {
                localStorage.setItem('whistle_auth_token', this.authToken);
            }
            if (this.guestToken) {
                localStorage.setItem('whistle_guest_token', this.guestToken);
            }
            if (this.user) {
                localStorage.setItem('whistle_user', JSON.stringify(this.user));
            }
        } catch (error) {
            console.warn('Failed to save auth state:', error);
        }
    }
    
    clearAuthState() {
        localStorage.removeItem('whistle_auth_token');
        localStorage.removeItem('whistle_guest_token');
        localStorage.removeItem('whistle_user');
        this.authToken = null;
        this.guestToken = null;
        this.user = null;
    }
    
    async initializeAuth() {
        if (this.authToken) {
            // Try to validate existing user token
            try {
                const response = await this.apiCall('/auth/me', 'GET');
                this.user = response.user;
                this.updateAuthUI();
                console.log('Authenticated user:', this.user);
                return;
            } catch (error) {
                console.warn('Token validation failed, falling back to guest:', error);
                this.clearAuthState();
            }
        }
        
        // Initialize or validate guest session
        if (this.guestToken) {
            try {
                const response = await this.apiCall('/auth/guest/validate', 'POST', {
                    guest_token: this.guestToken
                });
                console.log('Guest session validated');
                this.updateAuthUI();
                return;
            } catch (error) {
                console.warn('Guest token validation failed, creating new session:', error);
                this.guestToken = null;
            }
        }
        
        // Create new guest session
        await this.createGuestSession();
    }
    
    async createGuestSession() {
        try {
            const response = await this.apiCall('/auth/guest', 'POST');
            this.guestToken = response.guestToken;
            this.saveAuthState();
            this.updateAuthUI();
            console.log('New guest session created:', this.guestToken);
        } catch (error) {
            console.error('Failed to create guest session:', error);
            // Fall back to offline mode
            this.handleOffline();
        }
    }
    
    async registerUser(email, password, username = null) {
        try {
            const response = await this.apiCall('/auth/register', 'POST', {
                email,
                password,
                username,
                guestToken: this.guestToken
            });
            
            this.authToken = response.token;
            this.user = response.user;
            this.saveAuthState();
            this.updateAuthUI();
            
            console.log('User registered successfully:', this.user);
            return { success: true };
        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async loginUser(email, password) {
        try {
            const response = await this.apiCall('/auth/login', 'POST', {
                email,
                password
            });
            
            this.authToken = response.token;
            this.user = response.user;
            this.saveAuthState();
            this.updateAuthUI();
            
            console.log('User logged in successfully:', this.user);
            return { success: true };
        } catch (error) {
            console.error('Login failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async logout() {
        if (this.authToken) {
            try {
                await this.apiCall('/auth/logout', 'POST');
            } catch (error) {
                console.warn('Logout API call failed:', error);
            }
        }
        
        this.clearAuthState();
        await this.createGuestSession();
        this.updateAuthUI();
        console.log('Logged out, switched to guest session');
    }
    
    /**
     * Session Data Management
     */
    
    async saveSession(sessionData, sessionName = null, description = null) {
        const data = this.prepareSessionData(sessionData, sessionName, description);
        
        if (this.isOnline) {
            try {
                let response;
                if (this.currentSession?.sessionId) {
                    // Update existing session
                    response = await this.apiCall(`/sessions/${this.currentSession.sessionId}`, 'PUT', data);
                    console.log('Session updated:', response);
                } else {
                    // Create new session
                    response = await this.apiCall('/sessions', 'POST', data);
                    this.currentSession = {
                        sessionId: response.sessionId,
                        name: data.name,
                        createdAt: response.createdAt
                    };
                    console.log('New session created:', response);
                }
                
                // Clear any pending offline saves for this session
                this.removePendingSync('session', this.currentSession?.sessionId);
                
                return { success: true, session: this.currentSession };
            } catch (error) {
                console.error('Failed to save session online:', error);
                // Fall back to offline storage
                return this.saveSessionOffline(data);
            }
        } else {
            return this.saveSessionOffline(data);
        }
    }
    
    saveSessionOffline(data) {
        try {
            // Save to localStorage and queue for sync
            const localKey = `whistle_session_${Date.now()}`;
            localStorage.setItem(localKey, JSON.stringify(data));
            
            this.addPendingSync({
                type: 'session',
                action: 'create',
                data: data,
                localKey: localKey
            });
            
            console.log('Session saved offline, will sync when online');
            return { success: true, offline: true };
        } catch (error) {
            console.error('Failed to save session offline:', error);
            return { success: false, error: 'Storage full or unavailable' };
        }
    }
    
    async loadSession(sessionId) {
        if (this.isOnline) {
            try {
                const response = await this.apiCall(`/sessions/${sessionId}`, 'GET');
                this.currentSession = {
                    sessionId: response.sessionId,
                    name: response.name,
                    createdAt: response.createdAt
                };
                return { success: true, data: response.data };
            } catch (error) {
                console.error('Failed to load session:', error);
                return { success: false, error: error.message };
            }
        } else {
            // Try to load from localStorage
            return this.loadSessionOffline(sessionId);
        }
    }
    
    loadSessionOffline(sessionId) {
        try {
            const data = localStorage.getItem(`whistle_session_${sessionId}`);
            if (data) {
                return { success: true, data: JSON.parse(data), offline: true };
            } else {
                return { success: false, error: 'Session not found offline' };
            }
        } catch (error) {
            console.error('Failed to load session offline:', error);
            return { success: false, error: error.message };
        }
    }
    
    async listSessions() {
        if (this.isOnline) {
            try {
                const response = await this.apiCall('/sessions', 'GET');
                return { success: true, sessions: response.sessions };
            } catch (error) {
                console.error('Failed to list sessions:', error);
                return this.listSessionsOffline();
            }
        } else {
            return this.listSessionsOffline();
        }
    }
    
    listSessionsOffline() {
        try {
            const sessions = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('whistle_session_')) {
                    const data = JSON.parse(localStorage.getItem(key));
                    sessions.push({
                        sessionId: key,
                        name: data.name,
                        createdAt: data.metadata?.createdAt,
                        offline: true
                    });
                }
            }
            return { success: true, sessions, offline: true };
        } catch (error) {
            console.error('Failed to list offline sessions:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deleteSession(sessionId) {
        if (this.isOnline) {
            try {
                await this.apiCall(`/sessions/${sessionId}`, 'DELETE');
                if (this.currentSession?.sessionId === sessionId) {
                    this.currentSession = null;
                }
                return { success: true };
            } catch (error) {
                console.error('Failed to delete session:', error);
                return { success: false, error: error.message };
            }
        } else {
            return this.deleteSessionOffline(sessionId);
        }
    }
    
    deleteSessionOffline(sessionId) {
        try {
            localStorage.removeItem(`whistle_session_${sessionId}`);
            return { success: true, offline: true };
        } catch (error) {
            console.error('Failed to delete offline session:', error);
            return { success: false, error: error.message };
        }
    }
    
    prepareSessionData(sessionData, name, description) {
        // Get current configuration from the app
        const staffConfig = this.app.staffConfig?.getConfiguration() || {};
        const audioConfig = this.app.audioConfig?.getConfiguration() || {};
        
        return {
            name: name || `Session ${new Date().toLocaleString()}`,
            description: description || '',
            data: {
                metadata: {
                    version: '1.0',
                    createdAt: new Date().toISOString(),
                    totalNotes: sessionData.notes?.length || 0,
                    appVersion: '1.0.0'
                },
                configuration: {
                    staff: staffConfig,
                    audio: audioConfig,
                    tempo: staffConfig.tempo || 120,
                    keySignature: staffConfig.keySignature || 'C',
                    timeSignature: staffConfig.timeSignature || { numerator: 4, denominator: 4 },
                    clef: staffConfig.clef || 'treble'
                },
                notation: {
                    notes: sessionData.notes || [],
                    measures: sessionData.measures || [],
                    keySignature: sessionData.keySignature || 'C',
                    timeSignature: sessionData.timeSignature || '4/4',
                    clef: sessionData.clef || 'treble'
                }
            },
            metadata: {
                lastModified: new Date().toISOString(),
                noteCount: sessionData.notes?.length || 0
            }
        };
    }
    
    /**
     * Connectivity and Sync Management
     */
    
    handleOnline() {
        console.log('Connection restored');
        this.isOnline = true;
        this.syncPendingData();
        this.updateConnectivityUI();
    }
    
    handleOffline() {
        console.log('Connection lost - switching to offline mode');
        this.isOnline = false;
        this.updateConnectivityUI();
    }
    
    addPendingSync(syncItem) {
        this.pendingSync.push({
            ...syncItem,
            timestamp: Date.now()
        });
    }
    
    removePendingSync(type, id) {
        this.pendingSync = this.pendingSync.filter(item => 
            !(item.type === type && item.sessionId === id)
        );
    }
    
    async syncPendingData() {
        if (!this.isOnline || this.pendingSync.length === 0) return;
        
        console.log(`Syncing ${this.pendingSync.length} pending items...`);
        
        const syncPromises = this.pendingSync.map(async (item) => {
            try {
                if (item.type === 'session' && item.action === 'create') {
                    const response = await this.apiCall('/sessions', 'POST', item.data);
                    localStorage.removeItem(item.localKey);
                    console.log('Synced offline session:', response.sessionId);
                    return { success: true, item };
                }
            } catch (error) {
                console.error('Failed to sync item:', error);
                return { success: false, item, error };
            }
        });
        
        const results = await Promise.all(syncPromises);
        
        // Remove successfully synced items
        results.forEach(result => {
            if (result.success) {
                this.pendingSync = this.pendingSync.filter(item => item !== result.item);
            }
        });
        
        console.log('Sync completed');
    }
    
    /**
     * Auto-save functionality
     */
    
    setupAutoSave() {
        // Clear existing interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Set up new auto-save
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, this.autoSaveDelay);
    }
    
    async autoSave() {
        if (!this.app.notationRenderer?.allNotes?.length) {
            return; // Nothing to save
        }
        
        try {
            const sessionData = this.getCurrentSessionData();
            await this.saveSession(sessionData, null, 'Auto-saved');
            console.log('Auto-save completed');
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
    
    getCurrentSessionData() {
        const notationRenderer = this.app.notationRenderer;
        if (!notationRenderer) return { notes: [] };
        
        return {
            notes: notationRenderer.allNotes || [],
            keySignature: notationRenderer.keySignature || 'C',
            timeSignature: notationRenderer.timeSignature || '4/4',
            clef: notationRenderer.clefType || 'treble',
            measures: notationRenderer.measureCount || 1
        };
    }
    
    /**
     * API Communication
     */
    
    async apiCall(endpoint, method = 'GET', data = null) {
        const url = `${this.apiBase}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add authentication headers
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (this.guestToken) {
            headers['X-Guest-Token'] = this.guestToken;
        }
        
        const options = {
            method,
            headers
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        return response.json();
    }
    
    /**
     * UI Integration
     */
    
    bindAuthUI() {
        // This will be connected to UI elements when they exist
        // For now, expose methods globally for testing
        window.whistleAuth = {
            register: (email, password, username) => this.registerUser(email, password, username),
            login: (email, password) => this.loginUser(email, password),
            logout: () => this.logout(),
            saveSession: (name, description) => this.saveSession(this.getCurrentSessionData(), name, description),
            loadSession: (sessionId) => this.loadSession(sessionId),
            listSessions: () => this.listSessions(),
            deleteSession: (sessionId) => this.deleteSession(sessionId),
            getStatus: () => ({
                isOnline: this.isOnline,
                user: this.user,
                hasAuth: !!this.authToken,
                hasGuest: !!this.guestToken,
                currentSession: this.currentSession,
                pendingSync: this.pendingSync.length
            })
        };
    }
    
    updateAuthUI() {
        // Update UI elements based on auth state
        // This would integrate with actual UI elements
        const authInfo = document.getElementById('authInfo');
        if (authInfo) {
            if (this.user) {
                authInfo.textContent = `Logged in as: ${this.user.email}`;
            } else if (this.guestToken) {
                authInfo.textContent = 'Guest session active';
            } else {
                authInfo.textContent = 'Offline mode';
            }
        }
        
        console.log('Auth UI updated:', {
            user: this.user,
            hasAuth: !!this.authToken,
            hasGuest: !!this.guestToken
        });
    }
    
    updateConnectivityUI() {
        const connectivityIndicator = document.getElementById('connectivityStatus');
        if (connectivityIndicator) {
            connectivityIndicator.textContent = this.isOnline ? 'Online' : 'Offline';
            connectivityIndicator.className = this.isOnline ? 'online' : 'offline';
        }
        
        console.log('Connectivity UI updated:', this.isOnline ? 'Online' : 'Offline');
    }
    
    /**
     * Cleanup
     */
    
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}