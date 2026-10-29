import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { MysqlStore } from './mysql.js';
import { BoundaryError } from './errors.js';
import { integer, phpEmpty, queueSchema, legacyQueueSchema, adminQueueSchema, isActiveQueueStatus } from './queue.js';
import { automaticOrder, type OrderRow } from './request-order.js';
import { digest, normalizeRequest, type RequestContext, type RequestInput, type RequestResult } from './requests.js';

const STATUS_UNPLAYED='\u672a\u518d\u751f';
const STATUS_CLAIMED='\u518d\u751f\u958b\u59cb\u5f85\u3061';
const STATUS_PLAYING='\u518d\u751f\u4e2d';
const STATUS_COMPLETED='\u518d\u751f\u6e08';
const STATUS_STOPPED='\u505c\u6b62\u4e2d';
const KIND_VIDEO='\u52d5\u753b';
// Older MySQL rows were written with the Legacy application's mojibake
// literals. New writes use the canonical Japanese contract above, while reads
// continue recognizing both representations until old rows age out.
const LEGACY_STATUS_UNPLAYED='\u8b5b\uff6a\u8700\u54b2\u51fd';
const LEGACY_STATUS_CLAIMED='\u8700\u54b2\u51fd\u9ae2\u53e5\uff67\u53e5\uff7e\u30fb\u25a0';
const LEGACY_STATUS_PLAYING='\u8700\u54b2\u51fd\u8373\uff6d';
const LEGACY_STATUS_UPDATING='\u8b56\uff74\u8b41\uff70\u8373\uff6d';
const LEGACY_STATUS_STOPPED='\u86db\u61c8\uff6d\uff62\u8373\uff6d';
const LEGACY_KIND_VIDEO='\u870d\u6155\u5224';
function canonicalStatus(value:unknown):unknown{
  if(value===LEGACY_STATUS_UNPLAYED)return STATUS_UNPLAYED;
  if(value===LEGACY_STATUS_CLAIMED)return STATUS_CLAIMED;
  if(value===LEGACY_STATUS_PLAYING)return STATUS_PLAYING;
  if(value===LEGACY_STATUS_STOPPED)return STATUS_STOPPED;
  return value;
}
export function reservationViewState(nowplaying:string,taskState:string|null):'queued'|'playing'|'completed'|'stopped'|'failed'|'uncertain'|'unknown'{
  if(taskState==='failed'||taskState==='uncertain')return taskState;
  if(taskState==='completed'||nowplaying===STATUS_COMPLETED)return 'completed';
  if(nowplaying===STATUS_UNPLAYED||nowplaying===LEGACY_STATUS_UNPLAYED)return 'queued';
  if(nowplaying===STATUS_PLAYING||nowplaying===STATUS_CLAIMED||nowplaying===LEGACY_STATUS_PLAYING||nowplaying===LEGACY_STATUS_CLAIMED)return 'playing';
  if(nowplaying===STATUS_STOPPED||nowplaying===LEGACY_STATUS_STOPPED)return 'stopped';
  return 'unknown';
}
const parseResult = (value: unknown): RequestResult => typeof value === 'string' ? JSON.parse(value) as RequestResult : value as RequestResult;
function decodeSetting(value:unknown):unknown { if(typeof value!=='string')return value;try{return JSON.parse(value) as unknown;}catch{return value;} }
export class MysqlRequestRepository {
  constructor(private store: MysqlStore) {}
  async lookup(key: string, ownerId: string) {
    const rows = await this.store.rows<RowDataPacket & {owner_id:string;result_json:unknown}>('SELECT owner_id,result_json FROM request_submission WHERE key_hash=?',[key]);
    const row=rows[0]; if(row&&row.owner_id!==ownerId)throw new BoundaryError(404,'SUBMISSION_NOT_FOUND','Submission not found'); return row?parseResult(row.result_json):null;
  }
  async acknowledge(key: string,result: RequestResult) { try { await this.store.execute('UPDATE request_submission SET result_json=? WHERE key_hash=?',[JSON.stringify(result),key]); return true; } catch { return false; } }
  async listOwned(ownerId:string,limit:number,offset:number){
    // mysql2 prepared LIMIT/OFFSET parameters are rejected by the deployed
    // MySQL protocol combination (ER_WRONG_ARGUMENTS). These values originate
    // from validated integer query parameters; clamp them before embedding.
    const safeLimit=Math.max(1,Math.min(51,Math.trunc(Number.isFinite(limit)?limit:21)));
    const safeOffset=Math.max(0,Math.min(100000,Math.trunc(Number.isFinite(offset)?offset:0)));
    return this.store.rows<RowDataPacket & {id:number;songfile:string;singer:string;kind:string;nowplaying:string;reqorder:number;created_at:number;task_state:string|null;started_at:number|null;finished_at:number|null;error_code:string|null}>(
      `SELECT r.id,r.songfile,r.singer,r.kind,r.nowplaying,r.reqorder,r.created_at,
        t.state AS task_state,t.started_at,t.finished_at,t.error_code
       FROM request_submission s JOIN reservation r ON r.id=s.request_id
       LEFT JOIN playback_task t ON t.task_id=(SELECT latest.task_id FROM playback_task latest WHERE latest.request_id=s.request_id ORDER BY latest.created_at DESC,latest.task_id DESC LIMIT 1)
       WHERE s.owner_id=? AND s.operation='create' ORDER BY s.committed_at DESC,s.request_id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,[ownerId]);
  }
  async commit(context:RequestContext,input:RequestInput,key:string) {
    const hash=digest(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)))));
    return this.store.transaction(async connection=>{
      await connection.execute('SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
      const [priorRows]=await connection.execute<(RowDataPacket & {input_hash:string;owner_id:string;result_json:unknown})[]>('SELECT input_hash,owner_id,result_json FROM request_submission WHERE key_hash=? FOR UPDATE',[key]);
      const prior=priorRows[0];
      if(prior){if(prior.owner_id!==context.userid)throw new BoundaryError(404,'SUBMISSION_NOT_FOUND','Submission not found');if(prior.input_hash!==hash)throw new BoundaryError(409,'SUBMISSION_CONFLICT','Submission receipt was reused with different input');return {result:parseResult(prior.result_json),replayed:true};}
      const value=normalizeRequest(input),{selectid,...fields}=value;let requestId:number;
      if(selectid!==null){
        const [oldRows]=await connection.execute<(RowDataPacket & {nowplaying:string|null})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[selectid]);
        if(!oldRows[0])throw new BoundaryError(404,'NOT_FOUND','Replacement target was not found');
        const playing=oldRows[0].nowplaying==='蜀咲函荳ｭ'||oldRows[0].nowplaying==='蜀咲函髢句ｧ句ｾ・■'?'譖ｴ譁ｰ荳ｭ':oldRows[0].nowplaying;
        const sets=Object.keys(fields).map(k=>`\`${k}\`=?`).join(',');
        await connection.execute(`UPDATE reservation SET ${sets},nowplaying=? WHERE id=?`,[...Object.values(fields),playing,selectid]);requestId=selectid;
      } else {
      const participantId=input.participantId||context.userid;
      const createdAt=Math.floor(Date.now()/1000);
      await connection.execute("INSERT INTO app_user(userid,displayname,created_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE displayname=IF(displayname='',VALUES(displayname),displayname)",[context.userid,[...context.displayname].slice(0,64).join(''),createdAt]);
      if(participantId!==context.userid){const[participant]=await connection.execute<(RowDataPacket & {userid:string})[]>('SELECT userid FROM app_user WHERE userid=? FOR SHARE',[participantId]);if(!participant[0])throw new BoundaryError(404,'PARTICIPANT_NOT_FOUND','Selected participant is no longer available');}
      const entries:Record<string,unknown>={...fields,participant_userid:participantId,song_name:'',lister_artist:'',lister_work:'',lister_op_ed:'',lister_comment:'',nowplaying:STATUS_UNPLAYED,status:'new',clientip:context.ip,clientua:context.ua,playtimes:0,created_at:createdAt};
        const entryKeys=Object.keys(entries);
        const [insert]=await connection.execute('INSERT INTO reservation('+entryKeys.map(k=>`\`${k}\``).join(',')+') VALUES('+entryKeys.map(()=>'?').join(',')+')',Object.values(entries));
        requestId=Number((insert as {insertId:bigint|number}).insertId);
        const [maxRows]=await connection.execute<(RowDataPacket & {n:number})[]>('SELECT COALESCE(MAX(reqorder),0) n FROM reservation WHERE id<>?',[requestId]);
        await connection.execute("UPDATE reservation SET reqorder=?,status='OK' WHERE id=?",[integer(maxRows[0]?.n)+1,requestId]);
        if(context.automove){const [rows]=await connection.execute<(RowDataPacket & OrderRow)[]>('SELECT id,reqorder,singer,kind,nowplaying FROM reservation ORDER BY reqorder,id');for(const row of automaticOrder(rows,requestId,context.reset,context.midjoin))await connection.execute('UPDATE reservation SET reqorder=? WHERE id=?',[row.reqorder,row.id]);}
      }
      const metadata=context.metadata??(selectid!==null?{song_name:'',lister_artist:'',lister_work:'',lister_op_ed:'',lister_comment:''}:null);
      if(metadata){const keys=['song_name','lister_artist','lister_work','lister_op_ed','lister_comment'];await connection.execute(`UPDATE reservation SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`,[...keys.map(k=>metadata[k]??''),requestId]);}
      const now=Math.floor(Date.now()/1000);
      if(selectid===null&&context.history){await connection.execute('INSERT INTO request_history(userid,fullpath,songfile,kind,requested_at) VALUES(?,?,?,?,?)',[context.userid,value.fullpath,value.songfile,value.kind,now]);}
      const result:RequestResult={id:requestId,committed:true,operation:selectid===null?'create':'replace',warnings:context.metadata_warning?[context.metadata_warning]:[],notification:'unconfirmed'};
      await connection.execute('INSERT INTO request_submission(key_hash,input_hash,owner_id,request_id,operation,committed_at,result_json) VALUES(?,?,?,?,?,?,?)',[key,hash,context.userid,requestId,result.operation,now,JSON.stringify(result)]);
      return {result,replayed:false};
    });
  }
}
export class MysqlRequestService {
  constructor(private repository:MysqlRequestRepository,private secretReceipts:{verify(value:string):string}){}
  async submit(context:RequestContext,input:RequestInput,receipt:string,notify?:()=>Promise<unknown>){
    const key=this.secretReceipts.verify(receipt);const value=await this.repository.commit(context,input,key);
    if(!value.replayed&&notify)try{await notify();const acknowledged={...value.result,notification:'acknowledged' as const};if(await this.repository.acknowledge(key,acknowledged))value.result=acknowledged;}catch{/* The committed receipt remains queryable and no retry is performed. */}
    else if(!value.replayed){const disabled={...value.result,warnings:[...value.result.warnings,'Legacy SQLite live-refresh notification is disabled in MySQL mode.']};if(await this.repository.acknowledge(key,disabled))value.result=disabled;}
    if(value.result.notification==='unconfirmed')value.result.warnings.push('Reservation was committed; notification status is unconfirmed. Check the submission result before retrying.');return value;
  }
}

export class MysqlParticipantRepository {
  constructor(private store:MysqlStore){}
  async profile(userid:string){const rows=await this.store.rows<RowDataPacket & {userid:string;displayname:string}>('SELECT userid,displayname FROM app_user WHERE userid=?',[userid]);return rows[0]?{id:rows[0].userid,displayName:rows[0].displayname}:{id:userid,displayName:''};}
  async choices(){return this.store.rows<RowDataPacket & {id:string;displayName:string}>('SELECT userid AS id,displayname AS displayName FROM app_user WHERE TRIM(displayname)<>\'\' ORDER BY displayname,userid LIMIT 250');}
  async saveProfile(userid:string,displayName:string){const name=[...displayName.trim()].slice(0,64).join('');if(!name)throw new BoundaryError(400,'PARTICIPANT_NAME_REQUIRED','Enter a participant nickname');await this.store.execute('INSERT INTO app_user(userid,displayname,created_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE displayname=VALUES(displayname)',[userid,name,Math.floor(Date.now()/1000)]);return {id:userid,displayName:name};}
  async adminList(){return this.store.rows<RowDataPacket & {id:string;displayName:string;createdAt:number;reservationCount:number;submittedCount:number}>('SELECT u.userid AS id,u.displayname AS displayName,u.created_at AS createdAt,(SELECT COUNT(*) FROM reservation r WHERE r.participant_userid=u.userid) AS reservationCount,(SELECT COUNT(*) FROM request_history h WHERE h.userid=u.userid) AS submittedCount FROM app_user u ORDER BY u.created_at DESC,u.userid LIMIT 500');}
  async rename(userid:string,displayName:string){const name=[...displayName.trim()].slice(0,64).join('');if(!name)throw new BoundaryError(400,'PARTICIPANT_NAME_REQUIRED','Enter a participant nickname');const result=await this.store.execute('UPDATE app_user SET displayname=? WHERE userid=?',[name,userid]);if(Number((result as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(404,'PARTICIPANT_NOT_FOUND','Participant was not found');return {id:userid,displayName:name};}
}

const queueColumns='id,songfile,fullpath,singer,comment,kind,reqorder,nowplaying,secret,`loop`,pause,track,keychange,audiodelay,duration,volume,song_name,lister_artist,lister_work,lister_op_ed,lister_comment,clientip,clientua';
export interface MysqlQueueContext {secret_text:string;ip:string;ua:string;role:'user'|'admin'}
export class MysqlQueueRepository {
  constructor(private store:MysqlStore){}
  async read(context:MysqlQueueContext,limit=0,offset=0,legacy=false,includeAdminComment=false,activeOnly=false){
    const [rows]=await this.store.pool.query<(RowDataPacket & Record<string,unknown>)[]>(`SELECT ${queueColumns} FROM reservation ORDER BY reqorder DESC,id DESC`);
    let myname:unknown='';for(let i=rows.length-1;i>=0;i--)if(rows[i].clientip===context.ip&&rows[i].clientua===context.ua){myname=rows[i].singer;break;}
    const viewRows=activeOnly?rows.filter(row=>isActiveQueueStatus(row.nowplaying)):rows;
    const total=activeOnly?viewRows.length:rows.length;
    const selected=limit>0?viewRows.slice(offset,offset+limit):viewRows;
    const items=selected.map((row,index)=>{const playing=phpEmpty(row.nowplaying)?'1':canonicalStatus(row.nowplaying);const secret=!phpEmpty(row.secret)&&Number(row.secret)===1&&(playing===STATUS_UNPLAYED||playing==='1');const display=secret?context.secret_text:String(row.songfile||'');const owner=((row.clientip??'')!==''&&row.clientip===context.ip&&row.clientua===context.ua)||((row.singer??'')!==''&&row.singer===myname);const masked=secret&&!owner&&context.role!=='admin';const item:Record<string,unknown>={id:integer(row.id),reqorder:integer(row.reqorder),songfile:masked?display:row.songfile,display_name:display,singer:row.singer??'',comment:row.comment??'',kind:row.kind??'',nowplaying:playing,masked:masked?1:0,fullpath:masked?'':row.fullpath??'',volume:row.volume!==null&&row.volume!==''?integer(row.volume):-1,position:total-offset-index};for(const key of ['song_name','lister_artist','lister_work','lister_op_ed','lister_comment'])item[key]=masked?'':row[key]??'';for(const key of ['secret','loop','pause','track','keychange','audiodelay','duration'])item[key]=integer(row[key]);return item;});
    const remaining=viewRows.filter(r=>[STATUS_UNPLAYED,LEGACY_STATUS_UNPLAYED,'1'].includes(String(r.nowplaying??'')));
    const data={items,total,remaining_count:remaining.length,remaining_seconds:remaining.reduce((sum,r)=>sum+(integer(r.duration)>0?integer(r.duration):0),0),has_more:limit>0&&offset+items.length<total};
    return legacy?legacyQueueSchema.parse(data):includeAdminComment?adminQueueSchema.parse(data):queueSchema.parse(data);
  }
  async row(id:number){const rows=await this.store.rows<RowDataPacket & Record<string,unknown>>('SELECT * FROM reservation WHERE id=?',[id]);return rows[0]||null;}
  async playback(){const active=[STATUS_PLAYING,STATUS_CLAIMED,LEGACY_STATUS_PLAYING,LEGACY_STATUS_CLAIMED];const rows=await this.store.rows<RowDataPacket & {songfile:string;singer:string;nowplaying:string;kind:string}>('SELECT songfile,singer,nowplaying,kind FROM reservation WHERE nowplaying IN (?,?,?,?) ORDER BY reqorder ASC,id ASC LIMIT 1',active);const row=rows[0];return row?{playing:row.nowplaying===STATUS_PLAYING||row.nowplaying===LEGACY_STATUS_PLAYING,status:canonicalStatus(row.nowplaying),playingtitle:row.songfile,playingsinger:row.singer,kind:row.kind}:{playing:false};}
}

export class MysqlQueueMutationRepository {
  constructor(private store:MysqlStore){}
  async mutate(id:number,action:'delete'|'up'|'down'|'warikomi'){
    return this.store.transaction(async connection=>{
      await connection.execute('SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
      const [selected]=await connection.execute<(RowDataPacket & {reqorder:number})[]>('SELECT reqorder FROM reservation WHERE id=? FOR UPDATE',[id]);if(!selected[0])throw new BoundaryError(404,'NOT_FOUND','not found');
      const target=()=>selected[0].reqorder;
      const swap=async(direction:'up'|'down')=>{const [near]=await connection.execute<(RowDataPacket & {id:number;reqorder:number})[]>(`SELECT id,reqorder FROM reservation WHERE reqorder ${direction==='up'?'>':'<'} ? ORDER BY reqorder ${direction==='up'?'ASC':'DESC'},id ${direction==='up'?'ASC':'DESC'} LIMIT 1 FOR UPDATE`,[target()]);if(!near[0])return;await connection.execute('UPDATE reservation SET reqorder=999999999 WHERE id=?',[near[0].id]);await connection.execute('UPDATE reservation SET reqorder=? WHERE id=?',[near[0].reqorder,id]);await connection.execute('UPDATE reservation SET reqorder=? WHERE reqorder=999999999',[target()]);selected[0].reqorder=near[0].reqorder;};
      let message='';if(action==='delete')await connection.execute('DELETE FROM reservation WHERE id=?',[id]);else if(action==='warikomi'){for(let guard=0;guard<10000;guard++){const [rows]=await connection.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE reqorder<? ORDER BY reqorder DESC',[target()]);const next=rows.find(row=>row.nowplaying===STATUS_PLAYING||row.nowplaying===LEGACY_STATUS_PLAYING||row.nowplaying===STATUS_UNPLAYED||row.nowplaying===LEGACY_STATUS_UNPLAYED);if(!next||next.nowplaying===STATUS_PLAYING||next.nowplaying===LEGACY_STATUS_PLAYING)break;await swap('down');if(guard===9999)throw new BoundaryError(409,'QUEUE_ORDER_CYCLE','Queue order could not converge');}}else await swap(action);
      const [rows]=await connection.execute<(RowDataPacket & {id:number})[]>('SELECT id FROM reservation ORDER BY reqorder ASC,id ASC FOR UPDATE');for(let i=0;i<rows.length;i++)await connection.execute('UPDATE reservation SET reqorder=? WHERE id=?',[i+1,rows[i].id]);return message;
    });
  }
  async updateComment(id:number,comment:string){
    return this.store.transaction(async connection=>{
      await connection.execute('SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
      const [rows]=await connection.execute<(RowDataPacket & {id:number})[]>('SELECT id FROM reservation WHERE id=? FOR UPDATE',[id]);
      if(!rows[0])throw new BoundaryError(404,'NOT_FOUND','Reservation was not found');
      await connection.execute('UPDATE reservation SET comment=? WHERE id=?',[comment,id]);
      return {id,comment,updated:true as const};
    });
  }
  async reorder(ids:number[],expectedIds?:number[]){
    if(new Set(ids).size!==ids.length)throw new BoundaryError(400,'INVALID_QUEUE_ORDER','Queue order contains duplicate reservations');
    return this.store.transaction(async c=>{
      // Share the same serialization point as reservation creation and other queue mutations.
      await c.execute('SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
      const [rows]=await c.query<(RowDataPacket & {id:number;nowplaying:string;reqorder:number})[]>('SELECT id,nowplaying,reqorder FROM reservation ORDER BY reqorder ASC,id ASC FOR UPDATE');
      const isUnplayed=(value:string)=>value===STATUS_UNPLAYED||value===LEGACY_STATUS_UNPLAYED;
      const unplayed=rows.filter(row=>isUnplayed(row.nowplaying)).map(row=>Number(row.id));
      if(expectedIds&&(expectedIds.length!==unplayed.length||expectedIds.some((id,index)=>id!==unplayed[index])))
        throw new BoundaryError(409,'QUEUE_CHANGED','Queue order changed while you were reordering. Refresh and try again.');
      const submitted=new Set(ids);
      if(ids.length!==unplayed.length||unplayed.some(id=>!submitted.has(id)))
        throw new BoundaryError(409,'QUEUE_CHANGED','Queue changed while you were reordering. Refresh and try again.');
      const byId=new Map(rows.map(row=>[Number(row.id),row]));
      const finalOrder=[...rows.filter(row=>!isUnplayed(row.nowplaying)).map(row=>Number(row.id)),...ids];
      for(let index=0;index<finalOrder.length;index++)await c.execute('UPDATE reservation SET reqorder=? WHERE id=?',[index+1,finalOrder[index]]);
      return ids.length;
    });
  }
}

export class MysqlSettingsRepository {
  constructor(private store:MysqlStore){}
  private readonly keys=['playmode','startvolume','requestlistactivereload','request_automove','request_automove_reset','request_automove_midjoin_first'] as const;
  async read():Promise<{playmode:number;startvolume:number;requestlistactivereload:number;request_automove:number;request_automove_reset:number;request_automove_midjoin_first:number;revision:string}>{
    const marks=this.keys.map(()=>'?').join(',');
    const rows=await this.store.rows<RowDataPacket & {setting_key:string;value_json:unknown;revision:number}>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${marks})`,[...this.keys]);
    const values=Object.fromEntries(rows.map(r=>[r.setting_key,typeof r.value_json==='string'?JSON.parse(r.value_json):r.value_json]));
    const revision=rows.reduce((max,r)=>Math.max(max,Number(r.revision)),0);
    if(this.keys.some(key=>values[key]===undefined))throw new BoundaryError(503,'SETTINGS_NOT_MIGRATED','Core MySQL settings are missing; run the explicit MySQL settings bootstrap before using Admin settings');
    // Legacy init.php radio controls persisted 2 for "disabled". Treat that
    // representation as an effective false value without rewriting stored data.
    const binary=(key:string)=>effectiveLegacyBoolean(key,values[key]);
    return {playmode:Number(values.playmode),startvolume:Number(values.startvolume),requestlistactivereload:binary('requestlistactivereload'),request_automove:binary('request_automove'),request_automove_reset:binary('request_automove_reset'),request_automove_midjoin_first:binary('request_automove_midjoin_first'),revision:String(revision).padStart(64,'0')};
  }
  async applyRequestOrdering(context:RequestContext):Promise<RequestContext>{const settings=await this.read();return {...context,automove:settings.request_automove===1,reset:settings.request_automove_reset===1,midjoin:settings.request_automove_midjoin_first===1};}
  async scheduling(){
    const rows=await this.store.rows<RowDataPacket & {setting_key:string;value_json:unknown}>("SELECT setting_key,value_json FROM app_setting WHERE setting_key IN ('scheduler_enabled','manual_start_requested','playmode')");
    const values=Object.fromEntries(rows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
    return {enabled:values.scheduler_enabled===true||values.scheduler_enabled===1,manualStartRequested:values.manual_start_requested===true||values.manual_start_requested===1,playmode:Number(values.playmode)};
  }
  async setSchedulerEnabled(enabled:boolean){
    return this.store.transaction(async c=>{
      const keys=['playmode','scheduler_enabled','manual_start_requested'];
      const [rows]=await c.query<(RowDataPacket & {setting_key:string;value_json:unknown;revision:number})[]>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${keys.map(()=>'?').join(',')}) FOR UPDATE`,keys);
      const values=Object.fromEntries(rows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
      const mode=Number(values.playmode);
      if(enabled&&mode!==1&&mode!==2)throw new BoundaryError(409,'PLAYMODE_UNSUPPORTED','Select FIFO automatic mode or manual mode before enabling the Node scheduler');
      const revision=Math.max(0,...rows.map(row=>Number(row.revision)))+1,now=Math.floor(Date.now()/1000);
      for(const[key,value]of [['scheduler_enabled',enabled],['manual_start_requested',false]] as const)
        await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',[key,JSON.stringify(value),now,revision]);
      return {enabled,manualStartRequested:false,playmode:mode};
    });
  }
  async requestManualStart(){
    return this.store.transaction(async c=>{
      const keys=['playmode','scheduler_enabled','manual_start_requested'];
      const [rows]=await c.query<(RowDataPacket & {setting_key:string;value_json:unknown;revision:number})[]>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${keys.map(()=>'?').join(',')}) FOR UPDATE`,keys);
      const values=Object.fromEntries(rows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
      if(Number(values.playmode)!==2)throw new BoundaryError(409,'MANUAL_MODE_REQUIRED','Select manual playback mode before requesting one song');
      if(values.scheduler_enabled!==true&&values.scheduler_enabled!==1)throw new BoundaryError(409,'SCHEDULER_NOT_STARTED','Enable manual queue ownership before starting a song');
      if(values.manual_start_requested===true||values.manual_start_requested===1)throw new BoundaryError(409,'MANUAL_START_PENDING','A manual start request is already pending');
      const row=rows.find(item=>item.setting_key==='manual_start_requested');
      await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',['manual_start_requested','true',Math.floor(Date.now()/1000),Number(row?.revision||0)+1]);
      return {manualStartRequested:true};
    });
  }
  async update(input:{playmode:number;startvolume:number;requestlistactivereload:number;request_automove:number;request_automove_reset:number;request_automove_midjoin_first:number;revision:string}){
    return this.store.transaction(async c=>{
      const marks=this.keys.map(()=>'?').join(',');
      const [rows]=await c.query<(RowDataPacket & {setting_key:string;revision:number})[]>(`SELECT setting_key,revision FROM app_setting WHERE setting_key IN (${marks}) FOR UPDATE`,[...this.keys]);
      const current=rows.reduce((m,r)=>Math.max(m,Number(r.revision)),0);
      if(input.revision!==String(current).padStart(64,'0'))throw new BoundaryError(409,'SETTINGS_CONFLICT','Settings changed since they were loaded',409,'\u8bbe\u7f6e\u5df2\u53d8\u5316');
      const requested={playmode:input.playmode,startvolume:input.startvolume,requestlistactivereload:input.requestlistactivereload,request_automove:input.request_automove,request_automove_reset:input.request_automove_reset,request_automove_midjoin_first:input.request_automove_midjoin_first};
      const [stored]=await c.query<(RowDataPacket & {setting_key:string;value_json:unknown})[]>(`SELECT setting_key,value_json FROM app_setting WHERE setting_key IN (${marks}) FOR UPDATE`,[...this.keys]);
      const previous=Object.fromEntries(stored.map(item=>[item.setting_key,decodeSetting(item.value_json)])) as Record<string,unknown>;
      for(const key of ['requestlistactivereload','request_automove','request_automove_reset','request_automove_midjoin_first'])previous[key]=effectiveLegacyBoolean(key,previous[key]);
      const unchanged=Object.entries(requested).every(([key,value])=>previous[key]===value);
      if(unchanged)return {...requested,revision:String(current).padStart(64,'0'),changed:false};
      if(requested.playmode!==previous.playmode&&![1,2].includes(requested.playmode))throw new BoundaryError(409,'PLAYMODE_UNSUPPORTED','Choose Node FIFO mode 1 or Node manual mode 2; unsupported Legacy modes remain unchanged',409,'Node 蟇ｾ蠢懊・ FIFO 1 縺ｾ縺溘・謇句虚 2 繧帝∈謚槭＠縺ｦ縺上□縺輔＞');
      if(requested.requestlistactivereload!==previous.requestlistactivereload)throw new BoundaryError(409,'SETTING_NOT_EFFECTIVE','requestlistactivereload is Legacy-only and remains read-only',409,'Legacy 蟆ら畑險ｭ螳壹・縺溘ａ螟画峩縺ｧ縺阪∪縺帙ｓ');
      if(requested.playmode!==previous.playmode){
        const scheduleKeys=['scheduler_enabled','manual_start_requested'];
        const [scheduleRows]=await c.query<(RowDataPacket & {setting_key:string;value_json:unknown})[]>(`SELECT setting_key,value_json FROM app_setting WHERE setting_key IN (?,?) FOR UPDATE`,scheduleKeys);
        const schedule=Object.fromEntries(scheduleRows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
        const [active]=await c.query<(RowDataPacket & {task_id:string})[]>("SELECT task_id FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') LIMIT 1 FOR UPDATE");
        if(schedule.scheduler_enabled===true||schedule.scheduler_enabled===1||schedule.manual_start_requested===true||schedule.manual_start_requested===1||active.length)
          throw new BoundaryError(409,'PLAYMODE_CHANGE_BLOCKED','Stop the Node scheduler and resolve the active task before changing playback mode');
      }
      const next=current+1;
      for(const [key,value] of Object.entries(requested))await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',[key,JSON.stringify(value),Math.floor(Date.now()/1000),next]);
      return {...input,revision:String(next).padStart(64,'0'),changed:true};
    });
  }
}

export type ConnectionEntryConfig = { roomName: string; publicUrl: string; preferredMode: 'lan' | 'public' };
export class MysqlConnectionEntryRepository {
  constructor(private store:MysqlStore){}
  async read():Promise<ConnectionEntryConfig>{
    const rows=await this.store.rows<RowDataPacket & {setting_key:string;value_json:unknown}>("SELECT setting_key,value_json FROM app_setting WHERE setting_key IN ('connection_room_name','connection_public_url','connection_preferred_mode')");
    const values=Object.fromEntries(rows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
    return {roomName:typeof values.connection_room_name==='string'?values.connection_room_name:'',publicUrl:typeof values.connection_public_url==='string'?values.connection_public_url:'',preferredMode:values.connection_preferred_mode==='public'?'public':'lan'};
  }
  async save(input:ConnectionEntryConfig){
    return this.store.transaction(async c=>{
      const keys=['connection_room_name','connection_public_url','connection_preferred_mode'];
      const [rows]=await c.query<(RowDataPacket & {setting_key:string;revision:number})[]>(`SELECT setting_key,revision FROM app_setting WHERE setting_key IN (${keys.map(()=>'?').join(',')}) FOR UPDATE`,keys);
      const revision=Math.max(0,...rows.map(row=>Number(row.revision)))+1,now=Math.floor(Date.now()/1000);
      const values:Record<string,string>={connection_room_name:input.roomName,connection_public_url:input.publicUrl,connection_preferred_mode:input.preferredMode};
      for(const key of keys)await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',[key,JSON.stringify(values[key]),now,revision]);
      return {...input,revision};
    });
  }
  async allowsPublicOrigin(origin:string,forwardedHost:string|undefined,proxyMarker:string|undefined){
    if(proxyMarker!=='1'||!forwardedHost)return false;
    const config=await this.read();if(!config.publicUrl)return false;
    try{const target=new URL(config.publicUrl),requestOrigin=new URL(origin);return target.protocol==='https:'&&requestOrigin.origin===target.origin&&requestOrigin.host.toLowerCase()===forwardedHost.toLowerCase();}catch{return false;}
  }
}

function effectiveLegacyBoolean(key:string,stored:unknown):0|1{
  const value=typeof stored==='number'?stored:typeof stored==='string'&&/^[012]$/.test(stored)?Number(stored):NaN;
  if(!Number.isInteger(value)||![0,1,2].includes(value))throw new BoundaryError(503,'SETTINGS_VALUE_INVALID',`Stored setting ${key} has an unsupported value`);
  return value===1?1:0;
}

export class MysqlPlaybackRepository {
  constructor(private store:MysqlStore){}
  private now(){return Math.floor(Date.now()/1000);}
  private async event(connection:import('mysql2/promise').PoolConnection,taskId:string,key:string,type:string,agentId:string|null,details:Record<string,unknown>={}){await connection.execute('INSERT IGNORE INTO playback_event(task_id,event_key,event_type,agent_id,occurred_at,details_json) VALUES(?,?,?,?,?,?)',[taskId,key,type,agentId,this.now(),JSON.stringify(details)]);}
  async requireSchema(){const rows=await this.store.rows<RowDataPacket & {n:number}>("SELECT COUNT(DISTINCT table_name) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('playback_task','playback_event')");if(Number(rows[0]?.n)!==2)throw new Error('MySQL playback task schema is missing');}
  async recoverOnStartup(){
    return this.store.transaction(async c=>{
      const ts=this.now();
      const [rows]=await c.query<(RowDataPacket & {task_id:string;agent_id:string|null;state:string})[]>("SELECT task_id,agent_id,state FROM playback_task WHERE state IN ('claimed','playing','uncertain') FOR UPDATE");
      if(rows.length){
        const settingKeys=['scheduler_enabled','manual_start_requested'];
        const [settings]=await c.query<(RowDataPacket & {setting_key:string;revision:number})[]>('SELECT setting_key,revision FROM app_setting WHERE setting_key IN (?,?) FOR UPDATE',settingKeys);
        const revision=Math.max(0,...settings.map(row=>Number(row.revision)))+1;
        for(const key of settingKeys)await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',[key,'false',ts,revision]);
      }
      for(const row of rows){
        if(row.state==='uncertain')continue;
        await c.execute("UPDATE playback_task SET state='uncertain',lease_until=NULL,command='stop',updated_at=?,error_code='NODE_RESTART',error_message='Server restarted; playback outcome requires Agent confirmation' WHERE task_id=? AND state IN ('claimed','playing')",[ts,row.task_id]);
        await c.execute('UPDATE reservation SET nowplaying=? WHERE id=(SELECT request_id FROM playback_task WHERE task_id=?) AND nowplaying IN (?,?,?,?)',[STATUS_CLAIMED,row.task_id,STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING]);
        await this.event(c,row.task_id,'node-restart-uncertain:'+row.task_id,'uncertain',row.agent_id,{reason:'node_restart'});
      }
      return rows.length;
    });
  }
  async current():Promise<(RowDataPacket & Record<string,unknown> & {kind:'queue'})|undefined>{const rows=await this.store.rows<RowDataPacket & Record<string,unknown>>("SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt,updated_at AS updatedAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode,error_message AS error FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') ORDER BY created_at DESC LIMIT 1");return rows[0]?Object.assign({},rows[0],{kind:'queue' as const}):undefined;}
  async hasLegacyActivePlayback(){const rows=await this.store.rows<RowDataPacket & {id:number}>('SELECT id FROM reservation WHERE nowplaying IN (?,?,?,?,?) LIMIT 1',[STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING,LEGACY_STATUS_UPDATING]);return Boolean(rows[0]);}
  async claimNext(agentId:string,allowNew=true){
    return this.store.transaction(async c=>{
      const ts=this.now();
      const [activeRows]=await c.execute<(RowDataPacket & {task_id:string;request_id:number;state:string;agent_id:string|null;lease_until:number|null;command:string|null})[]>("SELECT task_id,request_id,state,agent_id,lease_until,command FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1 FOR UPDATE");
      const active=activeRows[0];
      if(active){
        if(active.state!=='uncertain'&&active.lease_until!==null&&Number(active.lease_until)<=ts){
          await c.execute("UPDATE playback_task SET state='uncertain',lease_until=NULL,command='stop',updated_at=?,error_code='LEASE_EXPIRED',error_message='Agent lease expired; outcome requires recovery' WHERE task_id=? AND state IN ('claimed','playing')",[ts,active.task_id]);
          await this.event(c,active.task_id,'lease-expired','uncertain',active.agent_id,{reason:'lease_expired'});
          return {task:null,command:'stop' as const,commandTaskId:active.task_id,uncertain:true};
        }
        if(active.state==='uncertain'){
          if(active.agent_id!==agentId)return {task:null,command:null,uncertain:true};
          const [media]=await c.execute<(RowDataPacket & {fullpath:string})[]>('SELECT fullpath FROM reservation WHERE id=?',[active.request_id]);
          if(!media[0])return {task:null,command:null,uncertain:true};
          return {task:{id:active.task_id,kind:'queue' as const,requestId:Number(active.request_id),state:'uncertain' as const,mediaPath:media[0].fullpath,agentId,initialVolume:undefined as number|undefined,initialKeySemitones:undefined as number|undefined},command:'stop' as const,commandTaskId:active.task_id,uncertain:true};
        }
        if(active.agent_id!==agentId)throw new BoundaryError(409,'PLAYBACK_TASK_OWNED','An active task is assigned to another Agent');
        // Renew a 15 second lease only when five seconds or less remain. The
        // Agent can now poll its command path responsively without turning
        // each poll into a durable MySQL write.
        if(active.lease_until===null||Number(active.lease_until)<=ts+5)await c.execute('UPDATE playback_task SET lease_until=?,updated_at=? WHERE task_id=? AND state IN (?,?)',[ts+15,ts,active.task_id,'claimed','playing']);
        const [media]=await c.execute<(RowDataPacket & {fullpath:string;keychange:number|string|null})[]>('SELECT fullpath,keychange FROM reservation WHERE id=?',[active.request_id]);
        if(!media[0])throw new BoundaryError(409,'PLAYBACK_REQUEST_MISSING','The queued request no longer exists');
        const initialVolume=active.state==='claimed'?await this.readStartVolume(c):undefined;
        const keychange=Number(media[0].keychange??0);
        if(active.state==='claimed'&&(!Number.isInteger(keychange)||keychange < -6||keychange > 6))throw new BoundaryError(409,'AUTOPLAY_KEY_CHANGE_UNSUPPORTED','Queue item key change must be a whole number from -6 to +6 semitones');
        return {task:{id:active.task_id,kind:'queue' as const,requestId:Number(active.request_id),state:active.state==='playing'?'playing' as const:'claimed' as const,mediaPath:media[0].fullpath,agentId,...(initialVolume!==undefined?{initialVolume}:{}),...(active.state==='claimed'?{initialKeySemitones:keychange}:{})},command:active.command as 'pause'|'resume'|'stop'|'skip'|null,uncertain:false};
      }
      const scheduleKeys=['playmode','scheduler_enabled','manual_start_requested'];
      const [scheduleRows]=await c.execute<(RowDataPacket & {setting_key:string;value_json:unknown;revision:number})[]>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${scheduleKeys.map(()=>'?').join(',')}) FOR UPDATE`,scheduleKeys);
      const schedule=Object.fromEntries(scheduleRows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
      const playmode=Number(schedule.playmode),enabled=(schedule.scheduler_enabled===true||schedule.scheduler_enabled===1);
      const manualPending=(schedule.manual_start_requested===true||schedule.manual_start_requested===1);
      if(!allowNew||!enabled||(playmode!==1&&playmode!==2)||(playmode===2&&!manualPending))return {task:null,command:null,uncertain:false};
      if(playmode===2){
        const revision=Math.max(0,...scheduleRows.map(row=>Number(row.revision)))+1;
        await c.execute('UPDATE app_setting SET value_json=?,updated_at=?,revision=? WHERE setting_key=?',[JSON.stringify(false),ts,revision,'manual_start_requested']);
      }
      const legacyStates=[STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING,LEGACY_STATUS_UPDATING]; const [legacy]=await c.execute<(RowDataPacket & {id:number})[]>("SELECT id FROM reservation WHERE nowplaying IN (?,?,?,?,?) ORDER BY reqorder,id LIMIT 1 FOR UPDATE",legacyStates);
      if(legacy[0])throw new BoundaryError(409,'AUTOPLAY_RECOVERY_REQUIRED','A Legacy playback marker exists without a matching MySQL task');
      const [rows]=await c.execute<(RowDataPacket & Record<string,unknown> & {id:number;songfile:string;fullpath:string;kind:string;nowplaying:string})[]>("SELECT id,songfile,fullpath,kind,nowplaying,`loop`,pause,track,keychange,audiodelay,volume FROM reservation WHERE nowplaying IN (?,?,?) ORDER BY reqorder ASC,id ASC LIMIT 1 FOR UPDATE",[STATUS_UNPLAYED,LEGACY_STATUS_UNPLAYED,'1']);
      const row=rows[0];
      if(!row)return {task:null,command:null,uncertain:false};
      if((row.kind!==KIND_VIDEO&&row.kind!==LEGACY_KIND_VIDEO)||typeof row.fullpath!=='string'||!row.fullpath.trim()||/^https?:\/\//i.test(row.fullpath)||! /\.(mp4|avi|mkv|mpg|flv|webm|wmv|ogm|mov)$/i.test(row.fullpath))throw new BoundaryError(409,'AUTOPLAY_ITEM_UNSUPPORTED','Queue item is not a supported local video');
      for(const option of ['loop','pause','track','audiodelay','volume'])if(Number(row[option])!==0)throw new BoundaryError(409,'AUTOPLAY_OPTIONS_UNSUPPORTED',`Queue item option ${option} is not supported`);
      const keychange=Number(row.keychange??0);
      if(!Number.isInteger(keychange)||keychange < -6||keychange > 6)throw new BoundaryError(409,'AUTOPLAY_KEY_CHANGE_UNSUPPORTED','Queue item key change must be a whole number from -6 to +6 semitones');
      const initialVolume=await this.readStartVolume(c),taskId=randomUUID();
      await c.execute("INSERT INTO playback_task(task_id,request_id,state,agent_id,lease_until,playback_state,created_at,updated_at) VALUES(?,?,'claimed',?,?,'starting',?,?)",[taskId,row.id,agentId,ts+15,ts,ts]);
      const [changed]=await c.execute('UPDATE reservation SET nowplaying=? WHERE id=? AND nowplaying=?',[STATUS_CLAIMED,row.id,row.nowplaying]);
      if(Number((changed as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'AUTOPLAY_CLAIM_RACE','Queue row changed while being claimed');
      await this.event(c,taskId,'claimed','claimed',agentId,{requestId:Number(row.id)});
      return {task:{id:taskId,kind:'queue' as const,requestId:Number(row.id),state:'claimed' as const,mediaPath:row.fullpath,agentId,initialVolume,initialKeySemitones:keychange},command:null,uncertain:false};
    });
  }
  private async readStartVolume(c:import('mysql2/promise').PoolConnection){const[rows]=await c.execute<(RowDataPacket & {value_json:unknown})[]>("SELECT value_json FROM app_setting WHERE setting_key='startvolume'");const value=decodeSetting(rows[0]?.value_json??50);const number=Number(value);if(!Number.isInteger(number)||number<0||number>100)throw new BoundaryError(503,'START_VOLUME_INVALID','Stored mpv default volume is outside 0窶・00');return number;}  async readTask(id:string){const rows=await this.store.rows<RowDataPacket & Record<string,unknown>>("SELECT task_id AS id,request_id AS requestId,'queue' AS kind,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt,updated_at AS updatedAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode,error_message AS error,error_message AS errorMessage FROM playback_task WHERE task_id=?",[id]);return rows[0]||undefined;}
  async reservationCommentForTask(taskId:string){const rows=await this.store.rows<RowDataPacket & {singer:string|null;comment:string|null}>('SELECT r.singer,r.comment FROM playback_task t JOIN reservation r ON r.id=t.request_id WHERE t.task_id=?',[taskId]);const row=rows[0];return row?{singer:row.singer||'',comment:row.comment||''}:undefined;}
  async report(taskId:string,agentId:string,input:{state?:'claimed'|'playing'|'completed'|'failed';playback:'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable';endReason?:'eof';outcome?:'skipped';recovery?:'verified_active'|'confirmed_inactive';error?:string}){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {request_id:number;state:string;agent_id:string|null;playback_state:string;command:string|null;started_at:number|null})[]>('SELECT request_id,state,agent_id,playback_state,command,started_at FROM playback_task WHERE task_id=? FOR UPDATE',[taskId]);const task=rows[0];if(!task||task.agent_id!==agentId)throw new BoundaryError(409,'STALE_PLAYER_TASK','Task is not owned by this Agent');const ts=this.now();let changed=false;let eventType:string|undefined;if(task.state==='uncertain'){
      if(input.state==='completed'&&input.endReason==='eof'&&task.started_at!==null){
        await c.execute("UPDATE playback_task SET state='completed',playback_state='idle',updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code=NULL,error_message=NULL WHERE task_id=? AND state='uncertain'",[ts,ts,taskId]);
        const [reservation]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);
        if(!reservation[0]||![STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING].includes(reservation[0].nowplaying))throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Reservation is not in a recoverable playback state');
        await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_COMPLETED,task.request_id]);
        await this.event(c,taskId,'eof','eof',agentId,{reason:'eof',recovered:true});
        return {changed:true,eventType:'eof',state:await this.taskOn(c,taskId)};
      }
      if(input.state==='playing'&&input.recovery==='verified_active'&&['playing','paused'].includes(input.playback)&&task.started_at!==null){
        await c.execute("UPDATE playback_task SET state='playing',playback_state=?,updated_at=?,lease_until=?,command=NULL,error_code=NULL,error_message=NULL WHERE task_id=? AND state='uncertain'",[input.playback,ts,ts+15,taskId]);
        const [reservation]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);
        if(!reservation[0]||![STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING].includes(reservation[0].nowplaying))throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Reservation is not in a recoverable playback state');
        await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_PLAYING,task.request_id]);
        await this.event(c,taskId,'recovered-playing','playing',agentId,{reason:'agent_verified_same_media'});
        return {changed:true,eventType:'playing',state:await this.taskOn(c,taskId)};
      }
      if(input.state==='failed'&&input.recovery==='confirmed_inactive'){
        await c.execute("UPDATE playback_task SET state='failed',playback_state='stopped',updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code='RECOVERED_INACTIVE',error_message='Agent confirmed the previous task is no longer the active media' WHERE task_id=? AND state='uncertain'",[ts,ts,taskId]);
        await c.execute("UPDATE reservation SET nowplaying=? WHERE id=? AND nowplaying IN (?,?,?,?)",[STATUS_STOPPED,task.request_id,STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING]);
        await this.event(c,taskId,'recovery-inactive','failed',agentId,{reason:'agent_confirmed_previous_media_inactive'});
        return {changed:true,eventType:'failed',state:await this.taskOn(c,taskId)};
      }
      throw new BoundaryError(409,'PLAYBACK_OUTCOME_UNCERTAIN','Agent has not confirmed the previous task state; no queue change was made');
    }
    if(input.state==='playing'&&!['claimed','playing'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a claimed task can become playing');if(input.state==='completed'&&!['playing','completed'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a playing task can complete');
    if(input.state==='playing'&&task.state==='claimed'){await c.execute("UPDATE playback_task SET state='playing',playback_state=?,started_at=?,updated_at=?,lease_until=? WHERE task_id=? AND state='claimed'",[input.playback,ts,ts,ts+15,taskId]);const[projection]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(projection[0]?.nowplaying!==STATUS_CLAIMED)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not claimed');await c.execute('UPDATE reservation SET nowplaying=?,playtimes=COALESCE(playtimes,0)+1 WHERE id=?',[STATUS_PLAYING,task.request_id]);await this.event(c,taskId,'playing','playing',agentId);changed=true;eventType='playing';}
    else if(input.state==='completed'){if(input.endReason!=='eof')throw new BoundaryError(400,'PLAYER_EOF_REQUIRED','Only real mpv end-file reason=eof can complete a task');if(task.state==='playing'){await c.execute("UPDATE playback_task SET state='completed',playback_state='idle',updated_at=?,finished_at=?,lease_until=NULL,command=NULL WHERE task_id=? AND state='playing'",[ts,ts,taskId]);const[projection]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(projection[0]?.nowplaying!==STATUS_PLAYING)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not playing');const[r]=await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_COMPLETED,task.request_id]);if(Number((r as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not playing');await this.event(c,taskId,'eof','eof',agentId,{reason:'eof'});changed=true;eventType='eof';}else if(task.state!=='completed')throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','EOF reported before confirmed playback');}
    else if(input.state==='failed'&&['claimed','playing'].includes(task.state)){await c.execute("UPDATE playback_task SET state='failed',playback_state=?,updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code=?,error_message=? WHERE task_id=?",[input.playback,ts,ts,input.outcome==='skipped'?'SKIPPED':'PLAYER_FAILED',input.outcome==='skipped'?'Playback skipped by administrator':'Playback failed; inspect Agent health',taskId]);const[r]=await c.execute('UPDATE reservation SET nowplaying=? WHERE id=? AND nowplaying IN (?,?,?,?)',[STATUS_STOPPED,task.request_id,STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING]);if(Number((r as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Queue projection is not active');eventType=input.outcome==='skipped'?'skipped':'failed';await this.event(c,taskId,eventType,eventType,agentId,{code:eventType});changed=true;}
    if(['playing','paused','stopped','unavailable'].includes(input.playback)&&task.playback_state!==input.playback&&task.state!=='completed'&&task.state!=='failed'){await c.execute('UPDATE playback_task SET playback_state=?,updated_at=? WHERE task_id=?',[input.playback,ts,taskId]);if(input.playback==='paused'||(input.playback==='playing'&&task.playback_state==='paused')){const type=input.playback==='paused'?'paused':'resumed';await this.event(c,taskId,`${type}:${randomUUID()}`,type,agentId);eventType=eventType||type;changed=true;}}
    if((task.command==='pause'&&input.playback==='paused')||(task.command==='resume'&&input.playback==='playing'))await c.execute('UPDATE playback_task SET command=NULL,updated_at=? WHERE task_id=?',[ts,taskId]);return {changed,eventType,state:await this.taskOn(c,taskId)};});}
  private async taskOn(c:import('mysql2/promise').PoolConnection,id:string){const[rows]=await c.execute<(RowDataPacket & Record<string,unknown>)[]>('SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt FROM playback_task WHERE task_id=?',[id]);return rows[0];}
  async recoverable(){return this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT t.task_id AS id,t.request_id AS requestId,t.state,t.agent_id AS agentId,t.playback_state AS playback,t.updated_at AS updatedAt,t.started_at AS startedAt,t.error_code AS errorCode,t.error_message AS error,r.id IS NOT NULL AS reservationExists,r.nowplaying,r.playtimes,r.songfile,r.singer FROM playback_task t LEFT JOIN reservation r ON r.id=t.request_id WHERE t.state IN ('failed','uncertain') AND NOT EXISTS (SELECT 1 FROM playback_task newer WHERE newer.request_id=t.request_id AND (newer.created_at>t.created_at OR (newer.created_at=t.created_at AND newer.task_id>t.task_id))) AND NOT EXISTS (SELECT 1 FROM playback_event e WHERE e.task_id=t.task_id AND e.event_key IN (CONCAT('retry-requested:',t.task_id),CONCAT('manual-handled:',t.task_id))) ORDER BY t.updated_at DESC,t.task_id DESC LIMIT 100`);}
  async hasAdminInactiveConfirmation(taskId:string){const rows=await this.store.rows<RowDataPacket & {event_id:number}>('SELECT event_id FROM playback_event WHERE task_id=? AND event_key=? LIMIT 1',[taskId,`admin-confirmed-inactive:${taskId}`]);return Boolean(rows[0]);}
  async confirmInactiveByAdmin(taskId:string,reason:string){
    const safeReason=reason.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
    if(safeReason.length<3)throw new BoundaryError(400,'PLAYBACK_REASON_REQUIRED','Enter a short reason for confirming the player is inactive');
    return this.store.transaction(async c=>{
      const[rows]=await c.execute<(RowDataPacket & {request_id:number;state:string})[]>('SELECT request_id,state FROM playback_task WHERE task_id=? FOR UPDATE',[taskId]);
      const task=rows[0];if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');
      const[existing]=await c.execute<(RowDataPacket & {event_id:number})[]>('SELECT event_id FROM playback_event WHERE task_id=? AND event_key=? LIMIT 1',[taskId,`admin-confirmed-inactive:${taskId}`]);
      if(existing[0])return {taskId,requestId:Number(task.request_id),state:task.state==='failed'?'already_confirmed':'already_recorded' as const};
      if(task.state!=='uncertain'&&task.state!=='failed')throw new BoundaryError(409,'PLAYBACK_NOT_UNCERTAIN','Only an uncertain or failed playback task can be manually confirmed inactive');
      const[active]=await c.execute<(RowDataPacket & {task_id:string})[]>("SELECT task_id FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') AND task_id<>? LIMIT 1 FOR UPDATE",[taskId]);
      if(active[0])throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Another playback task is active; resolve it first');
      const[reservation]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);
      if(reservation[0]&&![STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING,STATUS_STOPPED,LEGACY_STATUS_STOPPED].includes(reservation[0].nowplaying))throw new BoundaryError(409,'PLAYBACK_STATE_CONFLICT','Reservation is no longer in a recoverable playback state');
      const ts=this.now();
      if(task.state==='uncertain'){
        const[updated]=await c.execute("UPDATE playback_task SET state='failed',playback_state='stopped',updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code='ADMIN_CONFIRMED_INACTIVE',error_message='Administrator confirmed that no playback is active; this is not an EOF' WHERE task_id=? AND state='uncertain'",[ts,ts,taskId]);
        if(Number((updated as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'PLAYBACK_RECOVERY_RACE','Playback task changed while confirming it inactive');
        if(reservation[0])await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_STOPPED,task.request_id]);
      }
      // A task already reported failed remains failed with its original error.
      // This event only records the operator's separate inactive-player check.
      await this.event(c,taskId,`admin-confirmed-inactive:${taskId}`,'command',null,{action:task.state==='failed'?'admin_confirmed_inactive_after_failure':'admin_confirmed_inactive',reason:safeReason,confirmation:'operator_attested_no_active_playback',reservationExists:Boolean(reservation[0]),eof:false});
      if(!reservation[0])await this.event(c,taskId,`manual-handled:${taskId}`,'command',null,{action:'orphan_task_closed',reason:'Reservation had already been deleted'});
      return {taskId,requestId:Number(task.request_id),state:reservation[0]?'failed' as const:'orphan_closed' as const,playback:'stopped' as const,reservationExists:Boolean(reservation[0]),playtimesChanged:false,updatedAt:ts};
    });
  }
  async recoveryTask(taskId:string){const rows=await this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT t.task_id AS id,t.request_id AS requestId,t.state,t.agent_id AS agentId,t.playback_state AS playback,t.updated_at AS updatedAt,t.started_at AS startedAt,t.error_code AS errorCode,t.error_message AS error,r.nowplaying,r.playtimes,r.songfile,r.singer FROM playback_task t JOIN reservation r ON r.id=t.request_id WHERE t.task_id=?`,[taskId]);return rows[0]||null;}
  private async resumeFifoScheduler(c:import('mysql2/promise').PoolConnection){
    const keys=['playmode','scheduler_enabled','manual_start_requested'];
    const[rows]=await c.execute<(RowDataPacket & {setting_key:string;value_json:unknown;revision:number})[]>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${keys.map(()=>'?').join(',')}) FOR UPDATE`,keys);
    const settings=Object.fromEntries(rows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
    if(Number(settings.playmode)!==1)return false;
    const revision=Math.max(0,...rows.map(row=>Number(row.revision)))+1,now=this.now();
    for(const[key,value]of [['scheduler_enabled',true],['manual_start_requested',false]] as const)await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=VALUES(revision)',[key,JSON.stringify(value),now,revision]);
    return true;
  }
  async retry(taskId:string,resumeAutomatic=false,reason='Admin requested retry'){const safeReason=reason.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);if(safeReason.length<3)throw new BoundaryError(400,'PLAYBACK_REASON_REQUIRED','Enter a short reason for retrying this reservation');return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {request_id:number;state:string;agent_id:string|null})[]>('SELECT request_id,state,agent_id FROM playback_task WHERE task_id=? FOR UPDATE',[taskId]);const task=rows[0];if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');if(task.state!=='failed')throw new BoundaryError(409,'PLAYBACK_RECOVERY_REQUIRED','Wait for the previous playback task to be confirmed failed before retrying');const[prior]=await c.execute<(RowDataPacket & {event_id:number})[]>('SELECT event_id FROM playback_event WHERE task_id=? AND event_key IN (?,?) LIMIT 1',[taskId,`manual-handled:${taskId}`,`retry-requested:${taskId}`]);if(prior[0])throw new BoundaryError(409,'PLAYBACK_RECOVERY_ALREADY_APPLIED','This failed attempt has already been handled or returned to the queue');const[reservation]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(!reservation[0])throw new BoundaryError(404,'REQUEST_NOT_FOUND','Reservation was not found');if(reservation[0].nowplaying!==STATUS_STOPPED&&reservation[0].nowplaying!==LEGACY_STATUS_STOPPED)throw new BoundaryError(409,'PLAYBACK_RETRY_NOT_AVAILABLE','Reservation is no longer in the failed queue state');const[active]=await c.execute<(RowDataPacket & {task_id:string})[]>("SELECT task_id FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') LIMIT 1 FOR UPDATE");if(active[0])throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Resolve the active playback task before retrying');const now=this.now();const[updated]=await c.execute('UPDATE reservation SET nowplaying=? WHERE id=? AND nowplaying=?',[STATUS_UNPLAYED,task.request_id,reservation[0].nowplaying]);if(Number((updated as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'PLAYBACK_RETRY_RACE','Reservation changed while retrying');await this.event(c,taskId,`retry-requested:${taskId}`,'command',null,{action:'retry_requested',previousTaskId:taskId,reason:safeReason});const schedulerResumed=resumeAutomatic?await this.resumeFifoScheduler(c):false;return {requestId:Number(task.request_id),previousTaskId:taskId,state:'queued' as const,schedulerResumed,updatedAt:now};});}
  async markHandled(taskId:string,reason='Admin skipped this failed playback attempt',resumeAutomatic=false){const safeReason=reason.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);if(safeReason.length<3)throw new BoundaryError(400,'PLAYBACK_REASON_REQUIRED','Enter a short reason for handling this reservation');return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {request_id:number;state:string})[]>('SELECT request_id,state FROM playback_task WHERE task_id=? FOR UPDATE',[taskId]);const task=rows[0];if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');if(task.state!=='failed')throw new BoundaryError(409,'PLAYBACK_RECOVERY_REQUIRED','Confirm the Agent has safely ended the task before marking it handled');const[reservation]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(reservation[0]&&reservation[0].nowplaying!==STATUS_STOPPED&&reservation[0].nowplaying!==LEGACY_STATUS_STOPPED)throw new BoundaryError(409,'PLAYBACK_HANDLE_NOT_AVAILABLE','Reservation is not in a failed playback state');const[existing]=await c.execute<(RowDataPacket & {event_id:number})[]>('SELECT event_id FROM playback_event WHERE task_id=? AND event_key=? LIMIT 1',[taskId,`manual-handled:${taskId}`]);if(existing[0])return {requestId:Number(task.request_id),taskId,state:'already_handled' as const,schedulerResumed:false};if(reservation[0])await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_STOPPED,task.request_id]);await this.event(c,taskId,`manual-handled:${taskId}`,'command',null,{action:reservation[0]?'skipped_after_failure':'orphan_task_closed',reason:safeReason,reservationExists:Boolean(reservation[0]),eof:false});const schedulerResumed=reservation[0]&&resumeAutomatic?await this.resumeFifoScheduler(c):false;return {requestId:Number(task.request_id),taskId,state:reservation[0]?'handled' as const:'orphan_handled' as const,schedulerResumed};});}
  async control(action:'pause'|'resume'|'stop'|'skip'){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {task_id:string;agent_id:string|null;command_seq:number;state:string})[]>("SELECT task_id,agent_id,command_seq,state FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1 FOR UPDATE");const row=rows[0];if(!row)throw new BoundaryError(409,'NO_ACTIVE_QUEUE_TASK','No active formal playback task');const seq=Number(row.command_seq)+1;await c.execute('UPDATE playback_task SET command=?,command_seq=?,updated_at=? WHERE task_id=?',[action,seq,this.now(),row.task_id]);await this.event(c,row.task_id,`command:${seq}`,'command',row.agent_id,{action});return {taskId:row.task_id,action,queued:true as const};});}
  async stopPending(){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {task_id:string;request_id:number;agent_id:string|null})[]>("SELECT task_id,request_id,agent_id FROM playback_task WHERE state='claimed' AND started_at IS NULL LIMIT 1 FOR UPDATE");const row=rows[0];if(!row)return null;const ts=this.now();await c.execute("UPDATE playback_task SET state='failed',playback_state='stopped',finished_at=?,updated_at=?,lease_until=NULL,command=NULL,error_code='STOPPED_BEFORE_PLAY',error_message='Stopped before playback confirmation' WHERE task_id=? AND state='claimed'",[ts,ts,row.task_id]);await c.execute('UPDATE reservation SET nowplaying=? WHERE id=? AND nowplaying=?',[STATUS_UNPLAYED,row.request_id,STATUS_CLAIMED]);await this.event(c,row.task_id,'stopped-before-play','stopped',row.agent_id);return row.task_id;});}
  async history(limit:number,offset:number){const safeLimit=Math.max(1,Math.min(200,Math.trunc(limit))),safeOffset=Math.max(0,Math.trunc(offset));const tasks=await this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT task_id AS id,request_id AS requestId,ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY created_at,task_id) AS attempt,state,agent_id AS agentId,created_at AS createdAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode FROM playback_task ORDER BY created_at DESC,task_id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`);const events=await this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT event_id AS id,task_id AS taskId,event_type AS type,agent_id AS agentId,occurred_at AS occurredAt,details_json AS details FROM playback_event ORDER BY occurred_at DESC,event_id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`);return {tasks,events:events.map(event=>({...event,details:typeof event.details==='string'?JSON.parse(event.details):event.details}))};}
}
