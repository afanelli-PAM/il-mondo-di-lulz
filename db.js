const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// DB_PATH is read from the environment variable so Railway can point it at a
// persistent volume. Example Railway config:
//   Volume mount path : /data
//   DB_PATH env var   : /data/lulz.db
//
// NOTE: sql.js is an in-memory SQLite engine — on startup it reads the file
// from DB_PATH into RAM, then saveDb() flushes it back to disk every 30 s and
// on graceful shutdown. The Railway volume at /data therefore survives redeploys.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'lulz.db');

let db;
let initPromise;

function getDbAsync() {
  if (!initPromise) {
    initPromise = (async () => {
      const SQL = await initSqlJs();
      // Ensure the directory exists (needed on Railway and fresh environments
      // where data/ is not present in the deployed repository).
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      let data;
      try {
        data = fs.readFileSync(DB_PATH);
      } catch {
        // DB doesn't exist yet — will be created fresh
      }
      db = data ? new SQL.Database(data) : new SQL.Database();
      initSchema();
      initSettings();
      runMigrations();
      // Auto-save every 30 seconds
      setInterval(saveDb, 30000);
      return db;
    })();
  }
  return initPromise;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call await getDbAsync() first.');
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      data_nascita TEXT NOT NULL,
      ora_nascita TEXT,
      luogo_nascita TEXT NOT NULL,
      segno_zodiacale TEXT,
      come_ti_vedono TEXT,
      come_sei TEXT,
      attivita_aspirazioni TEXT,
      tre_cose_piacciono TEXT,
      tre_cose_odi TEXT,
      felicita TEXT,
      tema_natale TEXT,
      tema_natale_generato_il TEXT,
      consenso_privacy INTEGER DEFAULT 0,
      consenso_cookie INTEGER DEFAULT 0,
      data_consenso TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS oracle_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      domanda TEXT NOT NULL,
      risposta TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cookie_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_id INTEGER,
      consent_type TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL,
      ip_address TEXT,
      session_id TEXT,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function initSettings() {
  const defaults = [
    { key: 'registration_verify_email', value: '1' },
    { key: 'admin_notifications', value: '0' }
  ];

  for (const { key, value } of defaults) {
    const existing = prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!existing) {
      prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  }
}

// Migrations: ADD COLUMN statements are idempotent via try/catch
// (SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN).
function runMigrations() {
  const migrations = [
    'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN verification_token TEXT',
    'ALTER TABLE users ADD COLUMN verification_token_expires TEXT',
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch { /* column already exists — skip */ }
  }
}

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    initPromise = null;
  }
}

// Helper functions to mimic better-sqlite3 API
function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      // Get last insert id
      const result = db.exec('SELECT last_insert_rowid() as id');
      const lastId = result.length > 0 ? result[0].values[0][0] : 0;
      saveDb();
      return { lastInsertRowid: lastId, changes: db.getRowsModified() };
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((col, i) => { row[col] = vals[i]; });
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      const cols = stmt.getColumnNames();
      while (stmt.step()) {
        const vals = stmt.get();
        const row = {};
        cols.forEach((col, i) => { row[col] = vals[i]; });
        rows.push(row);
      }
      stmt.free();
      return rows;
    },
  };
}

module.exports = { getDbAsync, getDb, closeDb, saveDb, prepare };
