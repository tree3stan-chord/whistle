const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Database configuration and initialization
 * Uses SQLite with WAL mode for better concurrent access
 */
class DatabaseConfig {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database connection and schema
   * @param {string} customPath - Optional custom database path
   * @returns {Promise<void>}
   */
  async initialize(customPath = null) {
    try {
      // Determine database path
      this.dbPath = customPath || 
        process.env.DATABASE_PATH || 
        path.join(__dirname, '../../data/whistle.db');

      console.log(`Initializing database at: ${this.dbPath}`);

      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        console.log(`Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize SQLite database with optimized settings
      this.db = new Database(this.dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null,
        fileMustExist: false,
      });

      // Configure SQLite for optimal performance and safety
      this.configureSQLite();

      // Create tables and indexes
      await this.createSchema();

      // Run maintenance tasks
      await this.runMaintenance();

      this.isInitialized = true;
      console.log('Database initialization completed successfully');

      // Setup periodic maintenance
      this.setupPeriodicMaintenance();

    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Configure SQLite pragma settings for optimal performance
   */
  configureSQLite() {
    try {
      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      
      // Set synchronous mode for good balance of performance and safety
      this.db.pragma('synchronous = NORMAL');
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set cache size (negative value = KB, positive = pages)
      this.db.pragma('cache_size = -64000'); // 64MB cache
      
      // Set temp store to memory for better performance
      this.db.pragma('temp_store = MEMORY');
      
      // Set WAL auto-checkpoint
      this.db.pragma('wal_autocheckpoint = 1000');

      console.log('SQLite configuration applied successfully');
    } catch (error) {
      console.error('Failed to configure SQLite:', error);
      throw error;
    }
  }

  /**
   * Create database schema from SQL file
   */
  async createSchema() {
    try {
      const schemaPath = path.join(__dirname, '../schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema in a transaction
      const transaction = this.db.transaction(() => {
        this.db.exec(schema);
      });
      
      transaction();
      console.log('Database schema created successfully');
    } catch (error) {
      console.error('Failed to create database schema:', error);
      throw error;
    }
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance() {
    try {
      console.log('Running database maintenance...');
      
      // Clean up expired guest sessions
      const expiredGuestCleanup = this.db.prepare(`
        DELETE FROM guest_sessions 
        WHERE expires_at < datetime('now')
      `);
      const expiredGuests = expiredGuestCleanup.run();
      
      if (expiredGuests.changes > 0) {
        console.log(`Cleaned up ${expiredGuests.changes} expired guest sessions`);
      }

      // Clean up orphaned sessions (guest tokens that no longer exist)
      const orphanedSessionCleanup = this.db.prepare(`
        DELETE FROM sessions 
        WHERE guest_token IS NOT NULL 
        AND guest_token NOT IN (SELECT guest_token FROM guest_sessions)
      `);
      const orphanedSessions = orphanedSessionCleanup.run();
      
      if (orphanedSessions.changes > 0) {
        console.log(`Cleaned up ${orphanedSessions.changes} orphaned sessions`);
      }

      // Clean up old request logs (older than 30 days)
      const oldLogsCleanup = this.db.prepare(`
        DELETE FROM request_logs 
        WHERE created_at < datetime('now', '-30 days')
      `);
      const oldLogs = oldLogsCleanup.run();
      
      if (oldLogs.changes > 0) {
        console.log(`Cleaned up ${oldLogs.changes} old request logs`);
      }

      // Optimize database
      this.db.pragma('optimize');
      
      console.log('Database maintenance completed');
    } catch (error) {
      console.error('Database maintenance failed:', error);
      // Don't throw - maintenance failures shouldn't prevent startup
    }
  }

  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicMaintenance() {
    // Run maintenance every 6 hours
    const maintenanceInterval = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    
    setInterval(() => {
      console.log('Running scheduled maintenance...');
      this.runMaintenance().catch(error => {
        console.error('Scheduled maintenance failed:', error);
      });
    }, maintenanceInterval);

    console.log('Periodic maintenance scheduled every 6 hours');
  }

  /**
   * Get the database connection
   * @returns {Database} SQLite database instance
   */
  getConnection() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Get database statistics for monitoring
   * @returns {Object} Database statistics
   */
  getStats() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = {};
      
      // Table row counts
      const tables = ['users', 'guest_sessions', 'sessions', 'shared_sessions', 'session_analytics'];
      tables.forEach(table => {
        try {
          const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          stats[`${table}_count`] = result.count;
        } catch (error) {
          stats[`${table}_count`] = 'error';
        }
      });

      // Database file size
      try {
        const fileStat = fs.statSync(this.dbPath);
        stats.database_size_bytes = fileStat.size;
        stats.database_size_mb = Math.round(fileStat.size / 1024 / 1024 * 100) / 100;
      } catch (error) {
        stats.database_size_bytes = 'error';
      }

      // WAL file size if exists
      try {
        const walPath = `${this.dbPath}-wal`;
        if (fs.existsSync(walPath)) {
          const walStat = fs.statSync(walPath);
          stats.wal_size_bytes = walStat.size;
        }
      } catch (error) {
        // WAL file may not exist, that's OK
      }

      return stats;
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Backup the database
   * @param {string} backupPath - Path for backup file
   * @returns {Promise<void>}
   */
  async backup(backupPath = null) {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultBackupPath = path.join(
        path.dirname(this.dbPath),
        `whistle-backup-${timestamp}.db`
      );
      
      const targetPath = backupPath || defaultBackupPath;
      
      // Use SQLite backup API for consistent backup
      await new Promise((resolve, reject) => {
        try {
          const backup = this.db.backup(targetPath);
          backup.run();
          console.log(`Database backed up to: ${targetPath}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      return targetPath;
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      try {
        // Run final checkpoint before closing
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
  }

  /**
   * Health check for the database
   * @returns {Object} Health status
   */
  healthCheck() {
    try {
      if (!this.isInitialized || !this.db) {
        return { healthy: false, error: 'Database not initialized' };
      }

      // Simple query to test database connectivity
      const result = this.db.prepare('SELECT 1 as test').get();
      
      if (result && result.test === 1) {
        return { 
          healthy: true, 
          timestamp: new Date().toISOString(),
          database_path: this.dbPath
        };
      } else {
        return { healthy: false, error: 'Database query failed' };
      }
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

// Create singleton instance
const databaseConfig = new DatabaseConfig();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing database connection...');
  databaseConfig.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing database connection...');
  databaseConfig.close();
  process.exit(0);
});

module.exports = {
  initDatabase: (customPath) => databaseConfig.initialize(customPath),
  getDatabase: () => databaseConfig.getConnection(),
  getDatabaseStats: () => databaseConfig.getStats(),
  backupDatabase: (path) => databaseConfig.backup(path),
  healthCheck: () => databaseConfig.healthCheck(),
  closeDatabase: () => databaseConfig.close(),
};