const session = require('express-session');
const { getDb, saveDb } = require('../db');

class SQLiteSessionStore extends session.Store {
  constructor(options) {
    super(options);
    this.ttl = (options && options.ttl) || 86400;
  }

  get(sid, callback) {
    try {
      const db = getDb();
      const stmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > datetime(\'now\')');
      stmt.bind([sid]);
      if (stmt.step()) {
        const row = stmt.get();
        stmt.free();
        const sess = JSON.parse(row[0]);
        callback(null, sess);
      } else {
        stmt.free();
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const db = getDb();
      const maxAge = (sess.cookie && sess.cookie.maxAge) || this.ttl * 1000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      const sessStr = JSON.stringify(sess);

      db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      db.run('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)', [sid, sessStr, expired]);
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      const db = getDb();
      db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }

  clear(callback) {
    try {
      const db = getDb();
      db.run('DELETE FROM sessions');
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SQLiteSessionStore;
