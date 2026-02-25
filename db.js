const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// DB_PATH can be overridden via env var to point to a Railway persistent volume
// (e.g. DB_PATH=/app/data/lulz.db set in Railway dashboard alongside a volume
// mounted at /app/data — this survives redeployments).
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
