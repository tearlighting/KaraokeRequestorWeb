import { DatabaseSync } from 'node:sqlite';
import { queueDatabasePath } from './queue-database.js';
// Deliberate CLI, not imported by app/main. Only existing database files are accepted.
const path = queueDatabasePath(process.env.LEGACY_DATABASE_ROOT || '/run/legacy-db', process.argv[2] || 'request.db');
const db = new DatabaseSync(path, { timeout: 5000 });
try {
  db.exec('BEGIN IMMEDIATE');
  if (!db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='requesttable'").get()) throw Error('Existing queue schema required');
  if (!db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='request_submission'").get()) {
    db.exec(`CREATE TABLE request_submission (
      key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64), input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
      owner_id TEXT NOT NULL, request_id INTEGER NOT NULL, operation TEXT NOT NULL CHECK(operation IN ('create','replace')),
      committed_at INTEGER NOT NULL, result_json TEXT NOT NULL)`);
  }
  const columns = db.prepare('PRAGMA table_info(request_submission)').all().map(row => row.name);
  if (columns.join(',') !== 'key_hash,input_hash,owner_id,request_id,operation,committed_at,result_json') throw Error('Unexpected ledger schema');
  db.exec('COMMIT'); console.log('Phase 8 additive submission migration verified. Existing rows unchanged.');
} catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
