import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { queueDatabasePath } from './queue-database.js';
import { BoundaryError } from './errors.js';

export type PlaybackTaskState = 'claimed'|'playing'|'completed'|'failed'|'uncertain';
export type PlaybackCommand = 'pause'|'resume'|'stop'|'skip';
export interface FormalTask { id:string; kind:'queue'; requestId:number; state:'claimed'|'playing'; mediaPath:string; agentId:string }
const CLAIM='\u518d\u751f\u958b\u59cb\u5f85\u3061', PLAYING='\u518d\u751f\u4e2d', DONE='\u518d\u751f\u6e08', STOPPED='\u505c\u6b62\u4e2d', WAITING='\u672a\u518d\u751f';
const now=()=>Date.now();

/** SQLite is the sole durable owner for formal queue playback. Paths are returned only to the authenticated Agent. */
export class PlaybackTaskRepository {
  constructor(private root:string, private clock=now){}
  private open(name:string){const db=new DatabaseSync(queueDatabasePath(this.root,name),{timeout:1500,allowExtension:false});db.exec('PRAGMA foreign_keys=ON');return db;}
  hasSchema(name:string){
    // Public player status must stay available in installations that have not
    // opted into formal autoplay yet. Never create an empty DB as a side effect.
    if(isAbsolute(name)||name.includes('\\'))throw new BoundaryError(503,'PLAYBACK_DATABASE_INVALID','Invalid playback database path');
    const base=resolve(this.root),candidate=resolve(base,name),lexical=relative(base,candidate);
    if(!lexical||lexical==='..'||lexical.startsWith('..'+sep)||isAbsolute(lexical))throw new BoundaryError(503,'PLAYBACK_DATABASE_INVALID','Invalid playback database path');
    if(!existsSync(candidate))return false;
    const path=queueDatabasePath(this.root,name);
    const db=this.open(name);
    try{return Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='playback_task'").get()&&db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='playback_event'").get());}finally{db.close();}
  }
  requireSchema(name:string){if(!this.hasSchema(name))throw new BoundaryError(503,'PLAYBACK_SCHEMA_REQUIRED','Formal playback schema is not installed; run the approved explicit migration first');}
  hasLegacyActivePlayback(name:string){
    this.requireSchema(name);const db=this.open(name);
    try{return Boolean(db.prepare('SELECT 1 FROM requesttable WHERE nowplaying IN (?,?,?) LIMIT 1').get(CLAIM,PLAYING,'変更中'));}
    finally{db.close();}
  }
  private event(db:DatabaseSync,taskId:string,key:string,type:string,agentId:string|null,details:Record<string,unknown>={}){
    // event_key is globally unique; scope deterministic lifecycle keys to the
    // task so later reservations can record the same event types.
    db.prepare('INSERT OR IGNORE INTO playback_event(task_id,event_key,event_type,agent_id,occurred_at,details_json) VALUES(?,?,?,?,?,?)').run(taskId,`${taskId}:${key}`,type,agentId,this.clock(),JSON.stringify(details));
  }
  recoverOnStartup(name:string){
    if(!this.hasSchema(name))return 0;
    const db=this.open(name);let changed=0;
    try{db.exec('BEGIN IMMEDIATE');const rows=db.prepare("SELECT task_id,agent_id FROM playback_task WHERE state IN ('claimed','playing')").all() as Array<{task_id:string;agent_id:string|null}>;
      for(const row of rows){const r=db.prepare("UPDATE playback_task SET state='uncertain',updated_at=?,lease_until=NULL,error_code='NODE_RESTART',error_message='Outcome unknown after server restart' WHERE task_id=? AND state IN ('claimed','playing')").run(this.clock(),row.task_id);if(Number(r.changes)){changed++;this.event(db,row.task_id,'recovery-uncertain','uncertain',row.agent_id,{reason:'node_restart'});}}
      const legacy=db.prepare("SELECT id FROM requesttable WHERE nowplaying IN (?,?,?) AND id NOT IN (SELECT request_id FROM playback_task)").all(CLAIM,PLAYING,'変更中') as Array<{id:number}>;
      if(legacy.length){
        const active=db.prepare("SELECT COUNT(*) AS n FROM playback_task WHERE state IN ('claimed','playing','uncertain')").get() as {n:number};
        if(legacy.length!==1||active.n!==0)throw new BoundaryError(503,'PLAYBACK_RECOVERY_CONFLICT','Multiple or overlapping legacy playback markers require manual recovery');
        const taskId=randomUUID(),ts=this.clock();
        db.prepare("INSERT INTO playback_task(task_id,request_id,state,agent_id,lease_until,playback_state,created_at,updated_at,error_code,error_message) VALUES(?,?,'uncertain',NULL,NULL,'unavailable',?,?, 'LEGACY_HANDOFF_UNKNOWN','Legacy playback outcome is unknown; confirm player stop before continuing')").run(taskId,legacy[0].id,ts,ts);
        this.event(db,taskId,'legacy-handoff-uncertain','uncertain',null,{reason:'legacy_handoff'});changed++;
      }
      db.exec('COMMIT');return changed;
    }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();}
  }
  claimNext(name:string,playmode:number,agentId:string):{task:FormalTask|null;command:PlaybackCommand|null;commandTaskId?:string;uncertain:boolean}{
    this.requireSchema(name);if(playmode!==1)throw new BoundaryError(409,'AUTOPLAY_MODE_UNSUPPORTED','Automatic queue playback requires playmode=1');
    const db=this.open(name);try{db.exec('BEGIN IMMEDIATE');const active=db.prepare("SELECT task_id,request_id,state,agent_id,command,lease_until FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1").get() as {task_id:string;request_id:number;state:PlaybackTaskState;agent_id:string|null;command:PlaybackCommand|null;lease_until:number|null}|undefined;
      if(active){if(active.state!=='uncertain'&&active.lease_until!==null&&active.lease_until<=this.clock()){
          db.prepare("UPDATE playback_task SET state='uncertain',lease_until=NULL,updated_at=?,error_code='LEASE_EXPIRED',error_message='Agent lease expired; outcome requires recovery' WHERE task_id=? AND state IN ('claimed','playing')").run(this.clock(),active.task_id);
          this.event(db,active.task_id,'lease-expired','uncertain',active.agent_id,{reason:'lease_expired'});db.exec('COMMIT');return {task:null,command:'stop',commandTaskId:active.task_id,uncertain:true};
        }
        if(active.state==='uncertain'){db.exec('COMMIT');return {task:null,command:'stop',commandTaskId:active.task_id,uncertain:true};}
        if(active.agent_id!==agentId)throw new BoundaryError(409,'PLAYBACK_TASK_OWNED','An active task is assigned to another Agent');
        db.prepare("UPDATE playback_task SET lease_until=?,updated_at=? WHERE task_id=? AND state IN ('claimed','playing')").run(this.clock()+15000,this.clock(),active.task_id);
        const row=db.prepare('SELECT fullpath FROM requesttable WHERE id=?').get(active.request_id) as {fullpath:string}|undefined;
        if(!row)throw new BoundaryError(409,'PLAYBACK_REQUEST_MISSING','The queued request no longer exists');
        db.exec('COMMIT');return {task:{id:active.task_id,kind:'queue',requestId:active.request_id,state:active.state==='playing'?'playing':'claimed',mediaPath:row.fullpath,agentId},command:active.command,uncertain:false};
      }
      const legacyActive=db.prepare('SELECT id FROM requesttable WHERE nowplaying IN (?,?,?) ORDER BY reqorder ASC,id ASC LIMIT 1').get(CLAIM,PLAYING,'変更中');
      if(legacyActive)throw new BoundaryError(409,'AUTOPLAY_RECOVERY_REQUIRED','A Legacy playback marker exists without a matching formal SQLite task');
      const row=db.prepare("SELECT id,songfile,fullpath,kind,reqorder,nowplaying,playtimes,loop,pause,track,keychange,audiodelay,volume FROM requesttable WHERE nowplaying=? ORDER BY reqorder ASC,id ASC LIMIT 1").get(WAITING) as (Record<string,unknown>&{id:number;fullpath:string;songfile:string;kind:string;reqorder:number;nowplaying:string;playtimes:number})|undefined;
      if(!row){db.exec('COMMIT');return {task:null,command:null,uncertain:false};}
      this.assertSupported(row);
      const taskId=randomUUID(),ts=this.clock();
      db.prepare("INSERT INTO playback_task(task_id,request_id,state,agent_id,lease_until,playback_state,created_at,updated_at) VALUES(?,?,'claimed',?,?, 'starting',?,?)").run(taskId,row.id,agentId,ts+15000,ts,ts);
      const changed=db.prepare('UPDATE requesttable SET nowplaying=? WHERE id=? AND nowplaying=?').run(CLAIM,row.id,WAITING);if(Number(changed.changes)!==1)throw new BoundaryError(409,'AUTOPLAY_CLAIM_RACE','Queue row changed while being claimed');
      this.event(db,taskId,'claimed','claimed',agentId,{requestId:row.id});db.exec('COMMIT');
      return {task:{id:taskId,kind:'queue',requestId:row.id,state:'claimed',mediaPath:row.fullpath,agentId},command:null,uncertain:false};
    }catch(e){if(db.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'PLAYBACK_WRITE_UNCERTAIN','Playback transaction outcome is unknown');}throw e instanceof BoundaryError?e:new BoundaryError(503,'PLAYBACK_STORE_UNAVAILABLE','Playback database unavailable');}finally{db.close();}
  }
  private assertSupported(row:Record<string,unknown>){
    if(row.kind!=='\u52d5\u753b')throw new BoundaryError(409,'AUTOPLAY_ITEM_UNSUPPORTED','Only local video queue entries are supported');
    const path=String(row.fullpath||'');if(!path||/^https?:\/\//i.test(path)||! /\.(mp4|avi|mkv|mpg|flv|webm|wmv|ogm|mov)$/i.test(path))throw new BoundaryError(409,'AUTOPLAY_PATH_UNAVAILABLE','Queue item has no supported local video path');
    for(const key of ['loop','pause','track','keychange','audiodelay','volume'])if(Number(row[key])!==0)throw new BoundaryError(409,'AUTOPLAY_OPTIONS_UNSUPPORTED',`Queue item option ${key} is not supported`);
  }
  report(name:string,taskId:string,agentId:string,input:{state?:'claimed'|'playing'|'completed'|'failed';playback:'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable';endReason?:'eof';outcome?:'skipped';error?:string}){
    this.requireSchema(name);const db=this.open(name);let changed=false;let eventType:string|undefined;
    try{db.exec('BEGIN IMMEDIATE');const task=db.prepare('SELECT request_id,state,agent_id,playback_state,command FROM playback_task WHERE task_id=?').get(taskId) as {request_id:number;state:PlaybackTaskState;agent_id:string|null;playback_state:string;command:PlaybackCommand|null}|undefined;
      const uncertainStop=task?.state==='uncertain'&&input.state==='failed'&&input.playback==='stopped';
      if(!task||(task.agent_id!==agentId&&!uncertainStop))throw new BoundaryError(409,'STALE_PLAYER_TASK','Task is not owned by this Agent');
      const ts=this.clock();
      if(task.state==='uncertain'){
        if(input.state==='failed'&&input.playback==='stopped'){
          db.prepare("UPDATE playback_task SET state='failed',playback_state='stopped',updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code='RECOVERED_STOP',error_message='Stopped after uncertain restart recovery' WHERE task_id=? AND state='uncertain'").run(ts,ts,taskId);
          db.prepare("UPDATE requesttable SET nowplaying=? WHERE id=? AND nowplaying IN (?,?)").run(STOPPED,task.request_id,CLAIM,PLAYING);
          this.event(db,taskId,'uncertain-stopped','stopped',agentId,{reason:'agent_confirmed_stop'});db.exec('COMMIT');return {changed:true,eventType:'stopped',state:this.readTask(name,taskId)};
        }
        throw new BoundaryError(409,'PLAYBACK_OUTCOME_UNCERTAIN','Task requires confirmed stop; it will not be replayed or completed');
      }
      if(input.state==='playing'&&!['claimed','playing'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a claimed task can become playing');
      if(input.state==='completed'&&!['playing','completed'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a playing task can complete');
      if(input.state==='playing'&&task.state==='claimed'){
        db.prepare("UPDATE playback_task SET state='playing',playback_state=?,started_at=?,updated_at=?,lease_until=? WHERE task_id=? AND state='claimed'").run(input.playback,ts,ts,ts+15000,taskId);
        const r=db.prepare("UPDATE requesttable SET nowplaying=?,playtimes=COALESCE(playtimes,0)+1 WHERE id=? AND nowplaying=?").run(PLAYING,task.request_id,CLAIM);if(Number(r.changes)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not in the claimed state');
        this.event(db,taskId,'playing','playing',agentId);changed=true;eventType='playing';
      }else if(input.state==='completed'){
        if(input.endReason!=='eof')throw new BoundaryError(400,'PLAYER_EOF_REQUIRED','Only a real mpv end-file reason=eof can complete a task');
        if(task.state==='playing'){
          db.prepare("UPDATE playback_task SET state='completed',playback_state='idle',updated_at=?,finished_at=?,lease_until=NULL,command=NULL WHERE task_id=? AND state='playing'").run(ts,ts,taskId);
          const r=db.prepare("UPDATE requesttable SET nowplaying=? WHERE id=? AND nowplaying=?").run(DONE,task.request_id,PLAYING);if(Number(r.changes)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not playing');
          this.event(db,taskId,'eof','eof',agentId,{reason:'eof'});changed=true;eventType='eof';
        }else if(task.state!=='completed')throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','EOF reported before confirmed playback');
      }else if(input.state==='failed'&&['claimed','playing'].includes(task.state)){
        db.prepare("UPDATE playback_task SET state='failed',playback_state=?,updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code=?,error_message=? WHERE task_id=?").run(input.playback,ts,ts,input.outcome==='skipped'?'SKIPPED':'PLAYER_FAILED',input.outcome==='skipped'?'Playback skipped by administrator':'Playback failed; see Agent health',taskId);
        const r=db.prepare("UPDATE requesttable SET nowplaying=? WHERE id=? AND nowplaying IN (?,?)").run(STOPPED,task.request_id,CLAIM,PLAYING);if(Number(r.changes)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not active');
        eventType=input.outcome==='skipped'?'skipped':'failed';this.event(db,taskId,eventType,eventType,agentId,{code:input.outcome==='skipped'?'SKIPPED':'PLAYER_FAILED'});changed=true;
      }
      if(['playing','paused','stopped','unavailable'].includes(input.playback)&&task.playback_state!==input.playback&&task.state!=='completed'&&task.state!=='failed'){
        db.prepare('UPDATE playback_task SET playback_state=?,updated_at=? WHERE task_id=?').run(input.playback,ts,taskId);
        if(input.playback==='paused'||(input.playback==='playing'&&task.playback_state==='paused')){const type=input.playback==='paused'?'paused':'resumed';this.event(db,taskId,`${type}:${randomUUID()}`,type,agentId);eventType=eventType||type;changed=true;}
      }
      if((task.command==='pause'&&input.playback==='paused')||(task.command==='resume'&&input.playback==='playing'))db.prepare('UPDATE playback_task SET command=NULL,updated_at=? WHERE task_id=?').run(ts,taskId);
      db.exec('COMMIT');return {changed,eventType,state:this.readTask(name,taskId)};
    }catch(e){if(db.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'PLAYBACK_WRITE_UNCERTAIN','Playback transaction outcome is unknown');}throw e;}finally{db.close();}
  }
  control(name:string,action:PlaybackCommand){this.requireSchema(name);const db=this.open(name);try{db.exec('BEGIN IMMEDIATE');const row=db.prepare("SELECT task_id,state,agent_id,command,command_seq FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1").get() as {task_id:string;state:string;agent_id:string|null;command:PlaybackCommand|null;command_seq:number}|undefined;if(!row)throw new BoundaryError(409,'NO_ACTIVE_QUEUE_TASK','No active formal playback task');const seq=row.command_seq+1;db.prepare('UPDATE playback_task SET command=?,command_seq=?,updated_at=? WHERE task_id=?').run(action,seq,this.clock(),row.task_id);this.event(db,row.task_id,`command:${seq}`,'command',row.agent_id,{action});db.exec('COMMIT');return {taskId:row.task_id,action,queued:true as const};}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();}}
  stopPending(name:string){this.requireSchema(name);const db=this.open(name);try{db.exec('BEGIN IMMEDIATE');const row=db.prepare("SELECT task_id,request_id,agent_id FROM playback_task WHERE state='claimed' AND started_at IS NULL").get() as {task_id:string;request_id:number;agent_id:string|null}|undefined;if(!row){db.exec('COMMIT');return null;}db.prepare("UPDATE playback_task SET state='failed',finished_at=?,updated_at=?,error_code='STOPPED_BEFORE_PLAY',error_message='Stopped before playback confirmation' WHERE task_id=? AND state='claimed'").run(this.clock(),this.clock(),row.task_id);db.prepare('UPDATE requesttable SET nowplaying=? WHERE id=? AND nowplaying=?').run(WAITING,row.request_id,CLAIM);this.event(db,row.task_id,'stopped-before-play','stopped',row.agent_id);db.exec('COMMIT');return row.task_id;}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();}}
  readTask(name:string,id:string){const db=this.open(name);try{return db.prepare("SELECT task_id AS id,request_id AS requestId,'queue' AS kind,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt,updated_at AS updatedAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode,error_message AS error,error_message AS errorMessage FROM playback_task WHERE task_id=?").get(id) as Record<string,unknown>|undefined;}finally{db.close();}}
  current(name:string){const db=this.open(name);try{return db.prepare("SELECT task_id AS id,request_id AS requestId,'queue' AS kind,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt,error_message AS error FROM playback_task WHERE state IN ('claimed','playing','uncertain') ORDER BY created_at DESC LIMIT 1").get() as Record<string,unknown>|undefined;}finally{db.close();}}
  history(name:string,limit:number,offset:number){this.requireSchema(name);const db=this.open(name);try{return {tasks:db.prepare('SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,created_at AS createdAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode FROM playback_task ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit,offset),events:db.prepare('SELECT event_id AS id,task_id AS taskId,event_type AS type,agent_id AS agentId,occurred_at AS occurredAt,details_json AS details FROM playback_event ORDER BY occurred_at DESC,event_id DESC LIMIT ? OFFSET ?').all(limit,offset)};}finally{db.close();}}
}
