const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;
let useSQLite = false;

// Initialize database connection
async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD;
  const pgHost = process.env.PGHOST || 'localhost';
  const pgPort = process.env.PGPORT || 5433;
  const pgDatabase = process.env.PGDATABASE || 'camfix_db';

  if (connectionString || (pgUser && pgPassword)) {
    try {
      const config = connectionString 
        ? { connectionString }
        : {
            user: pgUser,
            password: pgPassword,
            host: pgHost,
            port: parseInt(pgPort, 10),
            database: pgDatabase,
            connectionTimeoutMillis: 3000
          };
      
      pgPool = new Pool(config);
      const res = await pgPool.query('SELECT NOW()');
      console.log(' Successfully connected to PostgreSQL Database at', res.rows[0].now);
      return;
    } catch (err) {
      console.warn('⚠️ Could not connect to PostgreSQL:', err.message);
      console.warn('👉 Switching to embedded SQLite database fallback...');
    }
  }

  // Fallback to SQLite
  useSQLite = true;
  const dbPath = path.join(__dirname, '..', 'database', 'camfix.sqlite');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys in SQLite
  await sqliteDb.run('PRAGMA foreign_keys = ON;');
  console.log(' Successfully initialized SQLite database fallback at', dbPath);
}

/**
 * Execute parameterized query. Supports both $1, $2 (Postgres style) and ? (SQLite style).
 * Returns { rows: [...], rowCount: number }
 */
async function query(sql, params = []) {
  if (!useSQLite && pgPool) {
    // Convert ? to $1, $2 if needed, though Postgres uses $1, $2 natively
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Replace NOW() or datetime functions if needed
    const result = await pgPool.query(pgSql, params);
    return { rows: result.rows, rowCount: result.rowCount };
  } else if (sqliteDb) {
    // Convert $1, $2 to ? for SQLite only if params exist
    let sqliteSql = sql;
    if (params && params.length > 0) {
      sqliteSql = sqliteSql.replace(/\$(\d+)/g, (match, p1) => {
        const idx = parseInt(p1, 10);
        return (idx >= 1 && idx <= params.length) ? '?' : match;
      });
    }

    sqliteSql = sqliteSql
      .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
      .replace(/SERIAL PRIMARY KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
      .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, "TEXT DEFAULT CURRENT_TIMESTAMP")
      .replace(/BOOLEAN/gi, "INTEGER")
      .replace(/TRUE/gi, "1")
      .replace(/FALSE/gi, "0");

    // Check if query is SELECT vs INSERT/UPDATE/DELETE
    const trimmed = sqliteSql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH')) {
      const rows = await sqliteDb.all(sqliteSql, params);
      return { rows: rows || [], rowCount: (rows || []).length };
    } else {
      const result = await sqliteDb.run(sqliteSql, params);
      // For INSERTs, if lastID is set, fetch inserted row or return ID
      return { 
        rows: result.lastID ? [{ id: result.lastID }] : [], 
        rowCount: result.changes || 0,
        lastID: result.lastID 
      };
    }
  } else {
    throw new Error('Database not initialized');
  }
}

/**
 * Execute multiple DDL statements (schema creation)
 */
async function exec(sqlScript) {
  if (!useSQLite && pgPool) {
    await pgPool.query(sqlScript);
  } else if (sqliteDb) {
    let convertedScript = sqlScript
      .replace(/SERIAL PRIMARY KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
      .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, "TEXT DEFAULT CURRENT_TIMESTAMP")
      .replace(/BOOLEAN DEFAULT TRUE/gi, "INTEGER DEFAULT 1")
      .replace(/BOOLEAN DEFAULT FALSE/gi, "INTEGER DEFAULT 0")
      .replace(/BOOLEAN/gi, "INTEGER");

    await sqliteDb.exec(convertedScript);
  }
}

module.exports = {
  initDb,
  query,
  exec,
  isSQLite: () => useSQLite
};
