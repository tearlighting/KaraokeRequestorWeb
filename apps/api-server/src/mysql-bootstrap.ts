import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { projectSettings } from './settings.js';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const database = process.env.MYSQL_DATABASE || 'yukari';
const rootPassword = required('MYSQL_ROOT_PASSWORD');

const root = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: 'root',
  password: rootPassword,
  database,
});

const initialSchema: Record<string, string[]> = {
  app_user: ['userid', 'displayname', 'icon_path', 'created_at'],
  reservation: ['id', 'songfile', 'singer', 'comment', 'kind', 'reqorder', 'fullpath', 'nowplaying', 'status', 'clientip', 'clientua', 'playtimes', 'secret', 'loop', 'keychange', 'track', 'pause', 'audiodelay', 'duration', 'volume', 'song_name', 'lister_artist', 'lister_work', 'lister_op_ed', 'lister_comment', 'created_at'],
  request_submission: ['key_hash', 'input_hash', 'owner_id', 'request_id', 'operation', 'committed_at', 'result_json'],
  request_history: ['id', 'userid', 'fullpath', 'songfile', 'kind', 'requested_at'],
  saved_song: ['userid', 'fullpath', 'fullpath_hash', 'songfile', 'kind', 'saved_kind', 'added_at'],
  favorite_keyword: ['id', 'userid', 'keyword', 'search_type', 'search_params', 'added_at'],
  pair_code: ['code', 'userid', 'expires_at'],
  external_identity: ['userid', 'provider', 'provider_sub', 'provider_email', 'token_ciphertext', 'token_expires_at', 'last_synced_at', 'linked_at', 'auto_sync'],
  app_setting: ['setting_key', 'value_json', 'updated_at', 'revision'],
  playback_task: ['task_id', 'request_id', 'state', 'active_request_id', 'active_slot', 'agent_id', 'lease_until', 'command', 'command_seq', 'playback_state', 'created_at', 'updated_at', 'started_at', 'finished_at', 'error_code', 'error_message'],
  playback_event: ['event_id', 'task_id', 'event_key', 'event_type', 'agent_id', 'occurred_at', 'details_json'],
};

async function marker(version: string, checksum: string) {
  await root.execute('INSERT IGNORE INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)', [version, checksum, Math.floor(Date.now() / 1000)]);
}

async function markerExists(version: string) {
  const [rows] = await root.execute<(RowDataPacket & { version: string })[]>('SELECT version FROM schema_migration WHERE version=?', [version]);
  return rows.length > 0;
}

async function testAccount(username: string, password: string) {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'mysql',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: username,
    password,
  });
  await connection.end();
}

async function provisionAccount(username: string, password: string, grants: string) {
  const version = `account-${username}-v1`;
  if (await markerExists(version)) return;

  const [existing] = await root.execute<(RowDataPacket & { count: number })[]>(
    'SELECT COUNT(*) AS count FROM mysql.user WHERE user=? AND host=?', [username, '%'],
  );
  if (Number(existing[0]?.count)) {
    // Validate an existing account before granting anything. Never reset its password.
    await testAccount(username, password);
  } else {
    await root.query(`CREATE USER IF NOT EXISTS '${username}'@'%' IDENTIFIED BY ?`, [password]);
    await testAccount(username, password);
  }

  const escapedDatabase = database.replace(/`/g, '``');
  await root.query(`GRANT ${grants} ON \`${escapedDatabase}\`.* TO '${username}'@'%'`);
  if (username === 'yukari_migrator') {
    await root.query(`GRANT SELECT, INSERT ON \`${escapedDatabase}\`.schema_migration TO '${username}'@'%'`);
    await root.query(`GRANT SELECT ON \`${escapedDatabase}\`.playback_task TO '${username}'@'%'`);
    await root.query(`GRANT SELECT ON \`${escapedDatabase}\`.reservation TO '${username}'@'%'`);
  }
  await marker(version, createHash('sha256').update(`${username}:${grants}`).digest('hex'));
}

async function ensureInitialMigrations() {
  for (const version of ['001-initial.sql', '002-queue-mutex.sql']) {
    const sql = readFileSync(new URL(`../migrations/mysql/${version}`, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
    if (await markerExists(version)) continue;
    if (version === '001-initial.sql') {
      const [tables] = await root.execute<(RowDataPacket & { count: number })[]>(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE' AND table_name<>'schema_migration'", [database],
      );
      if (Number(tables[0]?.count) > 0 && !(await markerExists('bootstrap-origin-fresh-v1'))) throw new Error('Database contains tables but has no initial migration marker; refusing to initialize over it');
    } else if (!(await markerExists('001-initial.sql'))) {
      throw new Error('Cannot apply queue mutex migration before the initial schema');
    }
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await root.query(statement);
    await marker(version, checksum);
  }
}

async function verifyInitialSchema() {
  for (const [table, expected] of Object.entries(initialSchema)) {
    const [rows] = await root.execute<(RowDataPacket & { column_name: string })[]>(
      'SELECT COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema=? AND table_name=?', [database, table],
    );
    const actual = new Set(rows.map(row => row.column_name));
    if (expected.some(column => !actual.has(column))) throw new Error(`Existing initial schema is incomplete at ${table}`);
  }
  for (const version of ['001-initial.sql', '002-queue-mutex.sql']) if (!(await markerExists(version))) throw new Error(`Existing schema is missing migration marker ${version}`);
}

async function initializeSettingsOnce() {
  const settingsPath = process.env.MYSQL_LEGACY_SETTINGS_FILE;
  const settings = settingsPath ? projectSettings(readFileSync(settingsPath)) : {
    playmode: 3, startvolume: 50, requestlistactivereload: 1, request_automove: 1,
    request_automove_reset: 1, request_automove_midjoin_first: 0, revision: '0'.repeat(64),
  };
  await root.beginTransaction();
  try {
    for (const [key, value] of [
      ['playmode', settings.playmode], ['startvolume', settings.startvolume],
      ['requestlistactivereload', settings.requestlistactivereload], ['request_automove', settings.request_automove],
      ['request_automove_reset', settings.request_automove_reset], ['request_automove_midjoin_first', settings.request_automove_midjoin_first],
    ] as const) {
      await root.execute('INSERT IGNORE INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1)', [key, JSON.stringify(value), Math.floor(Date.now() / 1000)]);
    }
    for (const [key, value] of [['scheduler_enabled', false], ['manual_start_requested', false]] as const) {
      await root.execute('INSERT IGNORE INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1)', [key, JSON.stringify(value), Math.floor(Date.now() / 1000)]);
    }
    const projection = JSON.stringify(settings);
    await marker('settings-bootstrap-v1', createHash('sha256').update(projection).digest('hex'));
    const queueSettings = { request_automove: settings.request_automove, request_automove_reset: settings.request_automove_reset, request_automove_midjoin_first: settings.request_automove_midjoin_first };
    await marker('queue-settings-bootstrap-v1', createHash('sha256').update(JSON.stringify(queueSettings)).digest('hex'));
    await root.commit();
  } catch (error) {
    await root.rollback();
    throw error;
  }
}

async function provisionMigrationAccount() {
  await provisionAccount('yukari_migrator', required('MYSQL_MIGRATION_PASSWORD'), 'ALTER, CREATE, INDEX, REFERENCES');
}

let lockAcquired = false;
try {
  const [lockRows] = await root.query<(RowDataPacket & { acquired: number | null })[]>("SELECT GET_LOCK('yukari_schema_deploy',30) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Could not acquire database setup lock');
  lockAcquired = true;
  await root.query('CREATE TABLE IF NOT EXISTS schema_migration (version VARCHAR(64) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at BIGINT NOT NULL) ENGINE=InnoDB');

  let freshInitialization = await markerExists('bootstrap-origin-fresh-v1');
  if (!(await markerExists('001-initial.sql')) && !freshInitialization) {
    const [tables] = await root.execute<(RowDataPacket & { count: number })[]>(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE' AND table_name<>'schema_migration'", [database],
    );
    if (Number(tables[0]?.count) > 0) throw new Error('Database contains tables but has no initial migration marker; refusing to initialize over it');
    await marker('bootstrap-origin-fresh-v1', createHash('sha256').update('empty-database-first-initialization').digest('hex'));
    freshInitialization = true;
  }

  await ensureInitialMigrations();
  await verifyInitialSchema();

  // These account checks are marker-gated. Existing passwords are verified but
  // never reset; CREATE USER IF NOT EXISTS only runs for genuinely missing users.
  await provisionAccount('yukari_app', required('MYSQL_APP_PASSWORD'), 'SELECT, INSERT, UPDATE, DELETE');
  await provisionAccount('yukari_viewer', required('MYSQL_VIEWER_PASSWORD'), 'SELECT, SHOW VIEW');
  await provisionMigrationAccount();
  if (freshInitialization && !(await markerExists('settings-bootstrap-v1'))) await initializeSettingsOnce();
  if (!(await markerExists('queue-mutex-seed-v1'))) {
    await root.execute('INSERT IGNORE INTO queue_mutex(lock_id) VALUES(1)');
    await marker('queue-mutex-seed-v1', createHash('sha256').update('queue_mutex:lock_id=1').digest('hex'));
  }
  const [settings] = await root.execute<(RowDataPacket & { count: number })[]>(
    "SELECT COUNT(*) AS count FROM app_setting WHERE setting_key IN ('playmode','startvolume','requestlistactivereload','request_automove','request_automove_reset','request_automove_midjoin_first')",
  );
  if (Number(settings[0]?.count) !== 6) throw new Error('Core MySQL settings are incomplete; existing settings were not re-imported or overwritten');
  if (freshInitialization) await marker('bootstrap-complete-v1', createHash('sha256').update('base-schema-accounts-settings').digest('hex'));

  const [summary] = await root.execute<(RowDataPacket & { count: number })[]>('SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=?', [database]);
  console.log(`Database initialization verified (${Number(summary[0]?.count)} tables); existing account passwords and settings were preserved.`);
} finally {
  if (lockAcquired) await root.query("SELECT RELEASE_LOCK('yukari_schema_deploy')");
  await root.end();
}
