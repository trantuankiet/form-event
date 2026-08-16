const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'event.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    agency TEXT NOT NULL,
    photo_file TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

function insertEntry({ id, name, phone, agency, photoFile }) {
  const stmt = db.prepare(`
    INSERT INTO entries (id, name, phone, agency, photo_file)
    VALUES (@id, @name, @phone, @agency, @photoFile)
  `);
  stmt.run({ id, name, phone, agency, photoFile });
}

function getEntry(id) {
  return db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
}

function getAllEntries() {
  return db.prepare('SELECT * FROM entries ORDER BY created_at ASC').all();
}

function countEntries() {
  return db.prepare('SELECT COUNT(*) as c FROM entries').get().c;
}

module.exports = { insertEntry, getEntry, getAllEntries, countEntries };
