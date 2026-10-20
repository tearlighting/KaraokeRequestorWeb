import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { queueDatabasePath } from './queue-database.js';
// Deliberate CLI, not imported by app/main. Only existing database files are accepted.
const path = queueDatabasePath(process.env.LEGACY_DATABASE_ROOT || '/run/legacy-db', process.argv[2] || 'request.db');
const db = new DatabaseSync(path, { timeout: 5000 });
const normalizeSql = (sql: string) => sql.replace(/["`]/g, '').replace(/\s+/g, ' ').replace(/\s*;\s*$/, '').trim().toLowerCase();
try {
  db.exec('BEGIN IMMEDIATE');
  if (!db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='requesttable'").get()) throw Error('Existing queue schema required');
  const selected = process.argv[3] || 'request-submission';
  if (selected === 'request-submission') {
    if (!db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='request_submission'").get()) {
      db.exec(`CREATE TABLE request_submission (
        key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64), input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
        owner_id TEXT NOT NULL, request_id INTEGER NOT NULL, operation TEXT NOT NULL CHECK(operation IN ('create','replace')),
        committed_at INTEGER NOT NULL, result_json TEXT NOT NULL)`);
    }
    const columns = db.prepare('PRAGMA table_info(request_submission)').all().map(row => row.name);
    if (columns.join(',') !== 'key_hash,input_hash,owner_id,request_id,operation,committed_at,result_json') throw Error('Unexpected ledger schema');
  } else if (selected === 'playback-task') {
    const sql = readFileSync(new URL('../migrations/002-playback-task.sql', import.meta.url), 'utf8');
    if (!db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='playback_task'").get()) db.exec(sql);
    const taskColumns = db.prepare('PRAGMA table_info(playback_task)').all().map(row => row.name);
    const eventColumns = db.prepare('PRAGMA table_info(playback_event)').all().map(row => row.name);
    if (taskColumns.join(',') !== 'task_id,request_id,state,agent_id,lease_until,command,command_seq,playback_state,created_at,updated_at,started_at,finished_at,error_code,error_message') throw Error('Unexpected playback_task schema');
    if (eventColumns.join(',') !== 'event_id,task_id,event_key,event_type,agent_id,occurred_at,details_json') throw Error('Unexpected playback_event schema');
    const expectedIndexes = new Map([
      ['playback_task_request_once', "CREATE UNIQUE INDEX playback_task_request_once ON playback_task(request_id) WHERE state IN ('pending','claimed','playing','uncertain')"],
      ['playback_task_one_active', "CREATE UNIQUE INDEX playback_task_one_active ON playback_task((1)) WHERE state IN ('pending','claimed','playing','uncertain')"],
      ['playback_task_history', 'CREATE INDEX playback_task_history ON playback_task(created_at DESC, task_id)'],
      ['playback_task_agent_lease', "CREATE INDEX playback_task_agent_lease ON playback_task(agent_id, lease_until) WHERE state IN ('claimed','playing')"],
      ['playback_event_task_time', 'CREATE INDEX playback_event_task_time ON playback_event(task_id, occurred_at, event_id)'],
    ]);
    for (const [name, expected] of expectedIndexes) {
      const actual = db.prepare("SELECT sql FROM sqlite_schema WHERE type='index' AND name=?").get(name) as { sql: string } | undefined;
      if (!actual || normalizeSql(actual.sql) !== normalizeSql(expected)) throw Error(`Unexpected or missing ${name} index definition`);
    }
    const eventForeignKeys = db.prepare('PRAGMA foreign_key_list(playback_event)').all() as Array<{ table: string; from: string; to: string }>;
    if (!eventForeignKeys.some(key => key.table === 'playback_task' && key.from === 'task_id' && key.to === 'task_id')) throw Error('Missing playback_event task foreign key');
  } else throw Error('Choose request-submission or playback-task');
  db.exec('COMMIT'); console.log(`Explicit ${selected} migration verified. Existing queue rows unchanged.`);
} catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
