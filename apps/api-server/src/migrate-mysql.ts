import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import mysql, { type RowDataPacket } from 'mysql2/promise';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const database = process.env.MYSQL_DATABASE || 'yukari';
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: required('MYSQL_USER'),
  password: required('MYSQL_PASSWORD'),
  database,
});

async function validateSchema() {
  const [columns] = await connection.execute<(RowDataPacket & { column_type: string; is_nullable: string })[]>(
    'SELECT COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?',
    [database, 'reservation', 'participant_userid'],
  );
  if (columns.length !== 1 || columns[0].column_type.toLowerCase() !== 'char(36)' || columns[0].is_nullable !== 'YES') {
    throw new Error('reservation.participant_userid must be nullable CHAR(36)');
  }

  const [indexes] = await connection.execute<(RowDataPacket & { column_name: string; non_unique: number })[]>(
    'SELECT COLUMN_NAME AS column_name,NON_UNIQUE AS non_unique FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=? ORDER BY SEQ_IN_INDEX',
    [database, 'reservation', 'reservation_participant'],
  );
  if (indexes.length !== 3 || indexes.map(row => row.column_name).join(',') !== 'participant_userid,reqorder,id' || indexes.some(row => Number(row.non_unique) !== 1)) {
    throw new Error('reservation_participant index does not match the migration');
  }

  const [foreignKeys] = await connection.execute<(RowDataPacket & { column_name: string; referenced_table_name: string; referenced_column_name: string; delete_rule: string })[]>(
    `SELECT k.COLUMN_NAME AS column_name,k.REFERENCED_TABLE_NAME AS referenced_table_name,k.REFERENCED_COLUMN_NAME AS referenced_column_name,r.DELETE_RULE AS delete_rule
     FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r
       ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
     WHERE k.CONSTRAINT_SCHEMA=? AND k.TABLE_NAME=? AND k.CONSTRAINT_NAME=?`,
    [database, 'reservation', 'reservation_participant_fk'],
  );
  if (foreignKeys.length !== 1 || foreignKeys[0].column_name !== 'participant_userid' || foreignKeys[0].referenced_table_name !== 'app_user' || foreignKeys[0].referenced_column_name !== 'userid' || foreignKeys[0].delete_rule !== 'SET NULL') {
    throw new Error('reservation_participant_fk does not match the migration');
  }
}

async function applyParticipantMigration(migration: string, checksum: string) {
  const [alreadyApplied] = await connection.execute<(RowDataPacket & { checksum: string })[]>(
    'SELECT checksum FROM schema_migration WHERE version=?', [migration],
  );
  if (alreadyApplied.length) {
    if (alreadyApplied[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${migration}`);
    if (migration === '003-reservation-participant.sql') await validateSchema();
    return false;
  }

  const [columns] = await connection.execute<(RowDataPacket & { column_type: string; is_nullable: string })[]>(
    'SELECT COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?',
    [database, 'reservation', 'participant_userid'],
  );
  if (columns.length) {
    if (columns[0].column_type.toLowerCase() !== 'char(36)' || columns[0].is_nullable !== 'YES') throw new Error('Conflicting participant_userid column; refusing migration');
  } else {
    await connection.query('ALTER TABLE reservation ADD COLUMN participant_userid CHAR(36) NULL AFTER id');
  }

  const [indexes] = await connection.execute<(RowDataPacket & { column_name: string; non_unique: number })[]>(
    'SELECT COLUMN_NAME AS column_name,NON_UNIQUE AS non_unique FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=? ORDER BY SEQ_IN_INDEX',
    [database, 'reservation', 'reservation_participant'],
  );
  if (!indexes.length) await connection.query('ALTER TABLE reservation ADD KEY reservation_participant (participant_userid, reqorder, id)');
  else if (indexes.length !== 3 || indexes.map(row => row.column_name).join(',') !== 'participant_userid,reqorder,id' || indexes.some(row => Number(row.non_unique) !== 1)) throw new Error('Conflicting reservation_participant index; refusing migration');

  const [foreignKeys] = await connection.execute<(RowDataPacket & { column_name: string; referenced_table_name: string; referenced_column_name: string; delete_rule: string })[]>(
    `SELECT k.COLUMN_NAME AS column_name,k.REFERENCED_TABLE_NAME AS referenced_table_name,k.REFERENCED_COLUMN_NAME AS referenced_column_name,r.DELETE_RULE AS delete_rule
     FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r
       ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
     WHERE k.CONSTRAINT_SCHEMA=? AND k.TABLE_NAME=? AND k.CONSTRAINT_NAME=?`,
    [database, 'reservation', 'reservation_participant_fk'],
  );
  if (!foreignKeys.length) await connection.query('ALTER TABLE reservation ADD CONSTRAINT reservation_participant_fk FOREIGN KEY (participant_userid) REFERENCES app_user(userid) ON DELETE SET NULL');
  else if (foreignKeys.length !== 1 || foreignKeys[0].column_name !== 'participant_userid' || foreignKeys[0].referenced_table_name !== 'app_user' || foreignKeys[0].referenced_column_name !== 'userid' || foreignKeys[0].delete_rule !== 'SET NULL') throw new Error('Conflicting reservation_participant_fk; refusing migration');

  await validateSchema();
  await connection.execute('INSERT INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)', [migration, checksum, Math.floor(Date.now() / 1000)]);
  return true;
}

let lockAcquired = false;
try {
  const [lockRows] = await connection.query<(RowDataPacket & { acquired: number | null })[]>("SELECT GET_LOCK('yukari_schema_deploy',30) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Could not acquire database migration lock');
  lockAcquired = true;

  const [schemaRows] = await connection.execute<(RowDataPacket & { count: number })[]>(
    'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=? AND table_name=?', [database, 'schema_migration'],
  );
  if (Number(schemaRows[0]?.count) !== 1) throw new Error('schema_migration is missing; refusing to initialize the database from the migration service');

  const directory = new URL('../migrations/mysql/', import.meta.url);
  const files = readdirSync(directory).filter(file => /^\d{3}-.*\.sql$/.test(file)).sort();
  if (!files.length) throw new Error('No ordered MySQL migration files were found');
  const applied = new Set<string>();
  for (const migration of files) {
    const content = readFileSync(new URL(migration, directory), 'utf8');
    const migrationChecksum = createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
    const [prior] = await connection.execute<(RowDataPacket & { checksum: string })[]>(
      'SELECT checksum FROM schema_migration WHERE version=?', [migration],
    );
    if (prior.length) {
      if (prior[0].checksum !== migrationChecksum) throw new Error(`Migration checksum mismatch: ${migration}`);
      if (migration === '003-reservation-participant.sql') await validateSchema();
      applied.add(migration);
      continue;
    }
    if (migration === '001-initial.sql' || migration === '002-queue-mutex.sql') throw new Error(`Base schema ${migration} was not initialized; refusing to bootstrap from the migrator`);
    if (files.slice(0, files.indexOf(migration)).some(previous => !applied.has(previous))) throw new Error(`Migration order is incomplete before ${migration}`);

    // Skip the active-task guard when every migration is already applied. This
    // allows routine deployments to reach Fastify recovery; actual DDL still
    // waits until no playback task is active.
    const [activeTasks] = await connection.execute<(RowDataPacket & { task_id: string; state: string })[]>(
      "SELECT task_id,state FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') LIMIT 1",
    );
    if (activeTasks.length) throw new Error('Active playback task (' + activeTasks[0].state + ') prevents a schema migration; resolve it safely and retry');
    const [before] = await connection.execute<(RowDataPacket & { count: number })[]>('SELECT COUNT(*) AS count FROM reservation');
    if (migration === '003-reservation-participant.sql') {
      await applyParticipantMigration(migration, migrationChecksum);
    } else {
      for (const statement of content.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)', [migration, migrationChecksum, Math.floor(Date.now() / 1000)]);
    }
    const [after] = await connection.execute<(RowDataPacket & { count: number; unlinked: number })[]>(
      'SELECT COUNT(*) AS count,COALESCE(SUM(participant_userid IS NULL),0) AS unlinked FROM reservation',
    );
    if (migration === '003-reservation-participant.sql' && Number(before[0]?.count) !== Number(after[0]?.count)) throw new Error('Reservation count changed unexpectedly during participant migration');
    console.log(`Applied ${migration}; reservation count ${Number(after[0]?.count)}; unlinked rows ${Number(after[0]?.unlinked)}.`);
    applied.add(migration);
  }
  await validateSchema();
  const [total] = await connection.execute<(RowDataPacket & { count: number; unlinked: number })[]>(
    'SELECT COUNT(*) AS count,COALESCE(SUM(participant_userid IS NULL),0) AS unlinked FROM reservation',
  );
  console.log(`MySQL migrations verified through ${files.at(-1)}; ${Number(total[0]?.count)} reservations, ${Number(total[0]?.unlinked)} unlinked.`);
} finally {
  if (lockAcquired) await connection.query("SELECT RELEASE_LOCK('yukari_schema_deploy')");
  await connection.end();
}
