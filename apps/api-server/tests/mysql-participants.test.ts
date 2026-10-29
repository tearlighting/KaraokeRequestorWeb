import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlParticipantRepository } from '../src/mysql-domain.js';

test('participant profiles keep stable IDs while names remain editable labels',async()=>{
  const calls:Array<{sql:string;values:unknown[]}> = [];
  const store={
    rows:async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});if(sql.startsWith('SELECT userid,displayname'))return [{userid:'user-a',displayname:'Alice'}];if(sql.startsWith('SELECT userid AS id'))return [{id:'user-a',displayName:'Alice'},{id:'user-b',displayName:'Alice'}];if(sql.startsWith('SELECT u.userid'))return [{id:'user-a',displayName:'Alice',createdAt:1,reservationCount:2,submittedCount:1}];return [];},
    execute:async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});return {affectedRows:1};},
  } as unknown as MysqlStore;
  const repository=new MysqlParticipantRepository(store);
  assert.deepEqual(await repository.profile('user-a'),{id:'user-a',displayName:'Alice'});
  assert.deepEqual(await repository.choices(),[{id:'user-a',displayName:'Alice'},{id:'user-b',displayName:'Alice'}]);
  assert.deepEqual(await repository.saveProfile('user-a','Alice Updated'),{id:'user-a',displayName:'Alice Updated'});
  assert.deepEqual(await repository.rename('user-b','Alice Updated'),{id:'user-b',displayName:'Alice Updated'});
  await repository.adminList();
  assert.equal(calls.filter(call=>call.sql.startsWith('UPDATE app_user')).length,1);
  assert.equal(calls.filter(call=>call.sql.includes('ON DUPLICATE KEY UPDATE displayname=VALUES(displayname)')).length,1);
  assert.ok(calls.some(call=>call.sql.includes('reservation r WHERE r.participant_userid=u.userid')));
  assert.ok(calls.some(call=>call.sql.includes('request_history h WHERE h.userid=u.userid')));
});

test('blank participant nicknames are rejected instead of creating empty profiles',async()=>{
  const repository=new MysqlParticipantRepository({execute:async()=>{throw new Error('must not write');}} as unknown as MysqlStore);
  await assert.rejects(repository.saveProfile('user-a','   '),{code:'PARTICIPANT_NAME_REQUIRED'});
});
