import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('mediconnect.db');
    // Initialize required SQLite tables
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS offline_emergencies (
        local_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address_text TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING_SYNC',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS location_breadcrumbs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed REAL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cached_emergency_contacts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
  }
  return dbInstance;
}

export const sqliteStorage = {
  // 1. Save an emergency request to local SQLite database (for offline survivability)
  async saveOfflineEmergency(params: {
    localId: string;
    userId: string;
    latitude: number;
    longitude: number;
    addressText?: string;
  }): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO offline_emergencies (local_id, user_id, latitude, longitude, address_text, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING_SYNC', ?);`,
        [
          params.localId,
          params.userId,
          params.latitude,
          params.longitude,
          params.addressText || 'Saved offline location',
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.warn('[sqliteStorage] saveOfflineEmergency error:', err);
    }
  },

  // 2. Fetch all pending offline emergencies
  async getPendingEmergencies(): Promise<any[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync(
        `SELECT * FROM offline_emergencies WHERE status = 'PENDING_SYNC' ORDER BY created_at ASC;`
      );
      return rows;
    } catch (err) {
      console.warn('[sqliteStorage] getPendingEmergencies error:', err);
      return [];
    }
  },

  // 3. Remove or mark synced
  async markEmergencySynced(localId: string): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(`DELETE FROM offline_emergencies WHERE local_id = ?;`, [localId]);
    } catch (err) {
      console.warn('[sqliteStorage] markEmergencySynced error:', err);
    }
  },

  // 4. Log continuous GPS breadcrumbs locally
  async logBreadcrumb(params: {
    incidentId: string;
    latitude: number;
    longitude: number;
    speed?: number;
  }): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO location_breadcrumbs (incident_id, latitude, longitude, speed, timestamp)
         VALUES (?, ?, ?, ?, ?);`,
        [
          params.incidentId,
          params.latitude,
          params.longitude,
          params.speed ?? 0,
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.warn('[sqliteStorage] logBreadcrumb error:', err);
    }
  },

  // 5. Retrieve all breadcrumbs for an incident
  async getBreadcrumbs(incidentId: string): Promise<any[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync(
        `SELECT * FROM location_breadcrumbs WHERE incident_id = ? ORDER BY id ASC;`,
        [incidentId]
      );
      return rows;
    } catch {
      return [];
    }
  }
};
