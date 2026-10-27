import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { projectSettings } from './settings.js';

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const rootPassword = required('MYSQL_ROOT_PASSWORD');
const appPassword = required('MYSQL_APP_PASSWORD');
const viewerPassword = required('MYSQL_VIEWER_PASSWORD');
const database = process.env.MYSQL_DATABASE || 'yukari';
async function verifyAppliedInitialSchema(connection: mysql.Connection) {
  const expected: Record<string,string[]> = {
    app_user:['userid','displayname','icon_path','created_at'], reservation:['id','songfile','singer','comment','kind','reqorder','fullpath','nowplaying','status','clientip','clientua','playtimes','secret','loop','keychange','track','pause','audiodelay','duration','volume','song_name','lister_artist','lister_work','lister_op_ed','lister_comment','created_at'],
    request_submission:['key_hash','input_hash','owner_id','request_id','operation','committed_at','result_json'], request_history:['id','userid','fullpath','songfile','kind','requested_at'], saved_song:['userid','fullpath','fullpath_hash','songfile','kind','saved_kind','added_at'], favorite_keyword:['id','userid','keyword','search_type','search_params','added_at'], pair_code:['code','userid','expires_at'], external_identity:['userid','provider','provider_sub','provider_email','token_ciphertext','token_expires_at','last_synced_at','linked_at','auto_sync'], app_setting:['setting_key','value_json','updated_at','revision'], playback_task:['task_id','request_id','state','active_request_id','active_slot','agent_id','lease_until','command','command_seq','playback_state','created_at','updated_at','started_at','finished_at','error_code','error_message'], playback_event:['event_id','task_id','event_key','event_type','agent_id','occurred_at','details_json'],
  };
  for(const [table,columns] of Object.entries(expected)){
    const [rows]=await connection.execute<(RowDataPacket & {column_name:string})[]>('SELECT COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema=? AND table_name=?',[database,table]);
    const actual=new Set(rows.map(row=>row.column_name));if(columns.some(column=>!actual.has(column)))throw new Error(`Existing schema is incomplete at ${table}`);
  }
}
const root = await mysql.createConnection({ host: process.env.MYSQL_HOST || 'mysql', port: Number(process.env.MYSQL_PORT || 3306), user: 'root', password: rootPassword, database, multipleStatements: true });
try {
  await root.query(`CREATE TABLE IF NOT EXISTS schema_migration (version VARCHAR(64) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at BIGINT NOT NULL) ENGINE=InnoDB`);
  for (const version of ['001-initial.sql','002-queue-mutex.sql']) {
    const sql = readFileSync(new URL(`../migrations/mysql/${version}`, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const [rows] = await root.execute('SELECT checksum FROM schema_migration WHERE version=?', [version]) as [Array<{checksum:string}>, unknown];
    if (rows[0]) {
      if (rows[0].checksum !== checksum) {
        if(version!=='001-initial.sql')throw new Error(`Migration checksum mismatch: ${version}`);
        await verifyAppliedInitialSchema(root);
        await root.execute('UPDATE schema_migration SET checksum=? WHERE version=?',[checksum,version]);
      }
      continue;
    }
    // MySQL DDL implicitly commits. All statements are CREATE TABLE IF NOT EXISTS;
    // rerunning safely completes an interrupted first bootstrap before recording the checksum.
    for (const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await root.query(statement);
    await root.execute('INSERT INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)',[version,checksum,Math.floor(Date.now()/1000)]);
  }
  await root.query(`CREATE USER IF NOT EXISTS 'yukari_app'@'%' IDENTIFIED BY ?`, [appPassword]);
  await root.query(`ALTER USER 'yukari_app'@'%' IDENTIFIED BY ?`, [appPassword]);
  await root.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database.replace(/`/g,'``')}\`.* TO 'yukari_app'@'%'`);
  await root.query(`CREATE USER IF NOT EXISTS 'yukari_viewer'@'%' IDENTIFIED BY ?`, [viewerPassword]);
  await root.query(`ALTER USER 'yukari_viewer'@'%' IDENTIFIED BY ?`, [viewerPassword]);
  await root.query(`GRANT SELECT, SHOW VIEW ON \`${database.replace(/`/g,'``')}\`.* TO 'yukari_viewer'@'%'`);
  await root.query('FLUSH PRIVILEGES');
  await root.execute('INSERT IGNORE INTO queue_mutex(lock_id) VALUES(1)');
  const [settingsMarker]=await root.execute('SELECT version FROM schema_migration WHERE version=?',['settings-bootstrap-v1']) as [Array<{version:string}>,unknown];
  if(!settingsMarker[0]){
    const settingsPath=process.env.MYSQL_LEGACY_SETTINGS_FILE;
    const settings=settingsPath?projectSettings(readFileSync(settingsPath)): {playmode:3,startvolume:50,requestlistactivereload:1,request_automove:1,request_automove_reset:1,request_automove_midjoin_first:0,revision:'0'.repeat(64)};
    await root.beginTransaction();
    try {
      for (const [key,value] of [['playmode',settings.playmode],['startvolume',settings.startvolume],['requestlistactivereload',settings.requestlistactivereload],['request_automove',settings.request_automove],['request_automove_reset',settings.request_automove_reset],['request_automove_midjoin_first',settings.request_automove_midjoin_first]] as const)
        await root.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=1',[key,JSON.stringify(value),Math.floor(Date.now()/1000)]);
      const projection=JSON.stringify(settings);
      await root.execute('INSERT INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)',['settings-bootstrap-v1',createHash('sha256').update(projection).digest('hex'),Math.floor(Date.now()/1000)]);
      await root.commit();
    } catch(error) { await root.rollback(); throw error; }
  }
  const [queueSettingsMarker]=await root.execute('SELECT version FROM schema_migration WHERE version=?',['queue-settings-bootstrap-v1']) as [Array<{version:string}>,unknown];
  if(!queueSettingsMarker[0]){
    const settingsPath=process.env.MYSQL_LEGACY_SETTINGS_FILE;
    const settings=settingsPath?projectSettings(readFileSync(settingsPath)): {playmode:3,startvolume:50,requestlistactivereload:1,request_automove:1,request_automove_reset:1,request_automove_midjoin_first:0,revision:''};
    await root.beginTransaction();
    try {
      const values={request_automove:settings.request_automove,request_automove_reset:settings.request_automove_reset,request_automove_midjoin_first:settings.request_automove_midjoin_first};
      for(const[key,value]of Object.entries(values))await root.execute('INSERT IGNORE INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1)',[key,JSON.stringify(value),Math.floor(Date.now()/1000)]);
      await root.execute('INSERT INTO schema_migration(version,checksum,applied_at) VALUES(?,?,?)',['queue-settings-bootstrap-v1',createHash('sha256').update(JSON.stringify(values)).digest('hex'),Math.floor(Date.now()/1000)]);
      await root.commit();
    } catch(error) { await root.rollback(); throw error; }
  }
  for(const[key,value]of [['scheduler_enabled',false],['manual_start_requested',false]] as const)await root.execute('INSERT IGNORE INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1)',[key,JSON.stringify(value),Math.floor(Date.now()/1000)]);
  const [coreSettingsRows]=await root.execute("SELECT setting_key FROM app_setting WHERE setting_key IN ('playmode','startvolume','requestlistactivereload','request_automove','request_automove_reset','request_automove_midjoin_first')") as [Array<{setting_key:string}>,unknown];
  if(coreSettingsRows.length!==6)throw new Error('Core MySQL settings are incomplete; inspect the explicit settings bootstrap before starting the application');
  const [tables] = await root.query(`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?`, [database]);
  console.log(`MySQL schema verified (${(tables as Array<{n:number}>)[0].n} tables). Runtime and read-only Navicat accounts provisioned.`);
} finally { await root.end(); }
