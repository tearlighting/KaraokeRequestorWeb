import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { MysqlStore } from './mysql.js';
import { BoundaryError } from './errors.js';
import { integer, phpEmpty, queueSchema, legacyQueueSchema } from './queue.js';
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
const parseResult = (value: unknown): RequestResult => typeof value === 'string' ? JSON.parse(value) as RequestResult : value as RequestResult;
function decodeSetting(value:unknown):unknown { if(typeof value!=='string')return value;try{return JSON.parse(value) as unknown;}catch{return value;} }
export class MysqlRequestRepository {
  constructor(private store: MysqlStore) {}
  async lookup(key: string, ownerId: string) {
    const rows = await this.store.rows<RowDataPacket & {owner_id:string;result_json:unknown}>('SELECT owner_id,result_json FROM request_submission WHERE key_hash=?',[key]);
    const row=rows[0]; if(row&&row.owner_id!==ownerId)throw new BoundaryError(404,'SUBMISSION_NOT_FOUND','Submission not found'); return row?parseResult(row.result_json):null;
  }
  async acknowledge(key: string,result: RequestResult) { try { await this.store.execute('UPDATE request_submission SET result_json=? WHERE key_hash=?',[JSON.stringify(result),key]); return true; } catch { return false; } }
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
      const entries:Record<string,unknown>={...fields,song_name:'',lister_artist:'',lister_work:'',lister_op_ed:'',lister_comment:'',nowplaying:STATUS_UNPLAYED,status:'new',clientip:context.ip,clientua:context.ua,playtimes:0,created_at:Math.floor(Date.now()/1000)};
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
      if(selectid===null&&context.history){await connection.execute("INSERT INTO app_user(userid,displayname,created_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE displayname=IF(displayname='',VALUES(displayname),displayname)",[context.userid,[...context.displayname].slice(0,64).join(''),now]);await connection.execute('INSERT INTO request_history(userid,fullpath,songfile,kind,requested_at) VALUES(?,?,?,?,?)',[context.userid,value.fullpath,value.songfile,value.kind,now]);}
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

const queueColumns='id,songfile,fullpath,singer,comment,kind,reqorder,nowplaying,secret,`loop`,pause,track,keychange,audiodelay,duration,volume,song_name,lister_artist,lister_work,lister_op_ed,lister_comment,clientip,clientua';
export interface MysqlQueueContext {secret_text:string;ip:string;ua:string;role:'user'|'admin'}
export class MysqlQueueRepository {
  constructor(private store:MysqlStore){}
  async read(context:MysqlQueueContext,limit=0,offset=0,legacy=false){
    const [rows]=await this.store.pool.query<(RowDataPacket & Record<string,unknown>)[]>(`SELECT ${queueColumns} FROM reservation ORDER BY reqorder DESC,id DESC`);
    const total=rows.length;let myname:unknown='';for(let i=rows.length-1;i>=0;i--)if(rows[i].clientip===context.ip&&rows[i].clientua===context.ua){myname=rows[i].singer;break;}
    const selected=limit>0?rows.slice(offset,offset+limit):rows;
    const items=selected.map((row,index)=>{const playing=phpEmpty(row.nowplaying)?'1':canonicalStatus(row.nowplaying);const secret=!phpEmpty(row.secret)&&Number(row.secret)===1&&(playing===STATUS_UNPLAYED||playing==='1');const display=secret?context.secret_text:String(row.songfile||'');const owner=((row.clientip??'')!==''&&row.clientip===context.ip&&row.clientua===context.ua)||((row.singer??'')!==''&&row.singer===myname);const masked=secret&&!owner&&context.role!=='admin';const item:Record<string,unknown>={id:integer(row.id),reqorder:integer(row.reqorder),songfile:masked?display:row.songfile,display_name:display,singer:row.singer??'',comment:row.comment??'',kind:row.kind??'',nowplaying:playing,masked:masked?1:0,fullpath:masked?'':row.fullpath??'',volume:row.volume!==null&&row.volume!==''?integer(row.volume):-1,position:total-offset-index};for(const key of ['song_name','lister_artist','lister_work','lister_op_ed','lister_comment'])item[key]=masked?'':row[key]??'';for(const key of ['secret','loop','pause','track','keychange','audiodelay','duration'])item[key]=integer(row[key]);return item;});
    const remaining=rows.filter(r=>[STATUS_UNPLAYED,LEGACY_STATUS_UNPLAYED,'1'].includes(String(r.nowplaying??'')));
    const data={items,total,remaining_count:remaining.length,remaining_seconds:remaining.reduce((sum,r)=>sum+(integer(r.duration)>0?integer(r.duration):0),0),has_more:limit>0&&offset+items.length<total};
    return legacy?legacyQueueSchema.parse(data):queueSchema.parse(data);
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
  async reorder(ids:number[]){return this.store.transaction(async c=>{const [rows]=await c.query<(RowDataPacket & {id:number;nowplaying:string;reqorder:number})[]>('SELECT id,nowplaying,reqorder FROM reservation FOR UPDATE');const isUnplayed=(value:string)=>value===STATUS_UNPLAYED||value===LEGACY_STATUS_UNPLAYED;const map=new Map(rows.map(r=>[Number(r.id),r]));const playedMax=Math.max(0,...rows.filter(r=>!isUnplayed(r.nowplaying)).map(r=>integer(r.reqorder)));const chosen=ids.filter(id=>isUnplayed(map.get(id)?.nowplaying||''));for(let i=0;i<chosen.length;i++)await c.execute('UPDATE reservation SET reqorder=? WHERE id=?',[playedMax+chosen.length-i,chosen[i]]);const [ordered]=await c.query<(RowDataPacket & {id:number})[]>('SELECT id FROM reservation ORDER BY reqorder ASC,id ASC FOR UPDATE');for(let i=0;i<ordered.length;i++)await c.execute('UPDATE reservation SET reqorder=? WHERE id=?',[i+1,ordered[i].id]);return chosen.length;});}
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
  async recoverOnStartup(){return this.store.transaction(async c=>{const ts=this.now();const[rows]=await c.query<(RowDataPacket & {task_id:string;agent_id:string|null})[]>('SELECT task_id,agent_id FROM playback_task WHERE state IN (\'claimed\',\'playing\') FOR UPDATE');for(const row of rows){await c.execute("UPDATE playback_task SET state='uncertain',lease_until=NULL,command='stop',updated_at=?,error_code='NODE_RESTART',error_message='Server restarted; playback outcome requires confirmed stop' WHERE task_id=? AND state IN ('claimed','playing')",[ts,row.task_id]);await c.execute('UPDATE reservation SET nowplaying=? WHERE id=(SELECT request_id FROM playback_task WHERE task_id=?) AND nowplaying IN (?,?)',['蜀咲函髢句ｧ句ｾ・■',row.task_id,'蜀咲函髢句ｧ句ｾ・■','蜀咲函荳ｭ']);await this.event(c,row.task_id,'node-restart-uncertain','uncertain',row.agent_id,{reason:'node_restart'});}return rows.length;});}
  async current(){const rows=await this.store.rows<RowDataPacket & Record<string,unknown>>("SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt,updated_at AS updatedAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode,error_message AS error FROM playback_task WHERE state IN ('pending','claimed','playing','uncertain') ORDER BY created_at DESC LIMIT 1");return rows[0]||undefined;}
  async hasLegacyActivePlayback(){const rows=await this.store.rows<RowDataPacket & {id:number}>('SELECT id FROM reservation WHERE nowplaying IN (?,?,?,?,?) LIMIT 1',[STATUS_CLAIMED,STATUS_PLAYING,LEGACY_STATUS_CLAIMED,LEGACY_STATUS_PLAYING,LEGACY_STATUS_UPDATING]);return Boolean(rows[0]);}
  async claimNext(agentId:string,allowNew=true){
    return this.store.transaction(async c=>{
      const scheduleKeys=['playmode','scheduler_enabled','manual_start_requested'];
      const [scheduleRows]=await c.execute<(RowDataPacket & {setting_key:string;value_json:unknown;revision:number})[]>(`SELECT setting_key,value_json,revision FROM app_setting WHERE setting_key IN (${scheduleKeys.map(()=>'?').join(',')}) FOR UPDATE`,scheduleKeys);
      const schedule=Object.fromEntries(scheduleRows.map(row=>[row.setting_key,decodeSetting(row.value_json)]));
      const playmode=Number(schedule.playmode),enabled=(schedule.scheduler_enabled===true||schedule.scheduler_enabled===1);
      const manualPending=(schedule.manual_start_requested===true||schedule.manual_start_requested===1);
      const ts=this.now();
      const [activeRows]=await c.execute<(RowDataPacket & {task_id:string;request_id:number;state:string;agent_id:string|null;lease_until:number|null;command:string|null})[]>("SELECT task_id,request_id,state,agent_id,lease_until,command FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1 FOR UPDATE");
      const active=activeRows[0];
      if(active){
        if(active.state!=='uncertain'&&active.lease_until!==null&&Number(active.lease_until)<=ts){
          await c.execute("UPDATE playback_task SET state='uncertain',lease_until=NULL,command='stop',updated_at=?,error_code='LEASE_EXPIRED',error_message='Agent lease expired; outcome requires recovery' WHERE task_id=? AND state IN ('claimed','playing')",[ts,active.task_id]);
          await this.event(c,active.task_id,'lease-expired','uncertain',active.agent_id,{reason:'lease_expired'});
          return {task:null,command:'stop' as const,commandTaskId:active.task_id,uncertain:true};
        }
        if(active.state==='uncertain')return {task:null,command:'stop' as const,commandTaskId:active.task_id,uncertain:true};
        if(active.agent_id!==agentId)throw new BoundaryError(409,'PLAYBACK_TASK_OWNED','An active task is assigned to another Agent');
        await c.execute('UPDATE playback_task SET lease_until=?,updated_at=? WHERE task_id=? AND state IN (?,?)',[ts+15,ts,active.task_id,'claimed','playing']);
        const [media]=await c.execute<(RowDataPacket & {fullpath:string;keychange:number|string|null})[]>('SELECT fullpath,keychange FROM reservation WHERE id=?',[active.request_id]);
        if(!media[0])throw new BoundaryError(409,'PLAYBACK_REQUEST_MISSING','The queued request no longer exists');
        const initialVolume=active.state==='claimed'?await this.readStartVolume(c):undefined;
        const keychange=Number(media[0].keychange??0);
        if(active.state==='claimed'&&(!Number.isInteger(keychange)||keychange < -6||keychange > 6))throw new BoundaryError(409,'AUTOPLAY_KEY_CHANGE_UNSUPPORTED','Queue item key change must be a whole number from -6 to +6 semitones');
        return {task:{id:active.task_id,kind:'queue' as const,requestId:Number(active.request_id),state:active.state==='playing'?'playing' as const:'claimed' as const,mediaPath:media[0].fullpath,agentId,...(initialVolume!==undefined?{initialVolume}:{}),...(active.state==='claimed'?{initialKeySemitones:keychange}:{})},command:active.command as 'pause'|'resume'|'stop'|'skip'|null,uncertain:false};
      }
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
  async report(taskId:string,agentId:string,input:{state?:'claimed'|'playing'|'completed'|'failed';playback:'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable';endReason?:'eof';outcome?:'skipped';error?:string}){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {request_id:number;state:string;agent_id:string|null;playback_state:string;command:string|null})[]>('SELECT request_id,state,agent_id,playback_state,command FROM playback_task WHERE task_id=? FOR UPDATE',[taskId]);const task=rows[0];const uncertainStop=task?.state==='uncertain'&&input.state==='failed'&&input.playback==='stopped';if(!task||(task.agent_id!==agentId&&!uncertainStop))throw new BoundaryError(409,'STALE_PLAYER_TASK','Task is not owned by this Agent');const ts=this.now();let changed=false;let eventType:string|undefined;if(task.state==='uncertain'){if(input.state==='failed'&&input.playback==='stopped'){await c.execute("UPDATE playback_task SET state='failed',playback_state='stopped',updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code='RECOVERED_STOP',error_message='Stopped after uncertain restart recovery' WHERE task_id=? AND state='uncertain'",[ts,ts,taskId]);await c.execute("UPDATE reservation SET nowplaying='蛛懈ｭ｢荳ｭ' WHERE id=? AND nowplaying IN ('蜀咲函髢句ｧ句ｾ・■','蜀咲函荳ｭ')",[task.request_id]);await this.event(c,taskId,'uncertain-stopped','stopped',agentId,{reason:'agent_confirmed_stop'});return {changed:true,eventType:'stopped',state:await this.taskOn(c,taskId)};}throw new BoundaryError(409,'PLAYBACK_OUTCOME_UNCERTAIN','Task requires confirmed stop; it will not be replayed or completed');}
    if(input.state==='playing'&&!['claimed','playing'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a claimed task can become playing');if(input.state==='completed'&&!['playing','completed'].includes(task.state))throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','Only a playing task can complete');
    if(input.state==='playing'&&task.state==='claimed'){await c.execute("UPDATE playback_task SET state='playing',playback_state=?,started_at=?,updated_at=?,lease_until=? WHERE task_id=? AND state='claimed'",[input.playback,ts,ts,ts+15,taskId]);const[projection]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(projection[0]?.nowplaying!==STATUS_CLAIMED)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not claimed');await c.execute('UPDATE reservation SET nowplaying=?,playtimes=COALESCE(playtimes,0)+1 WHERE id=?',[STATUS_PLAYING,task.request_id]);await this.event(c,taskId,'playing','playing',agentId);changed=true;eventType='playing';}
    else if(input.state==='completed'){if(input.endReason!=='eof')throw new BoundaryError(400,'PLAYER_EOF_REQUIRED','Only real mpv end-file reason=eof can complete a task');if(task.state==='playing'){await c.execute("UPDATE playback_task SET state='completed',playback_state='idle',updated_at=?,finished_at=?,lease_until=NULL,command=NULL WHERE task_id=? AND state='playing'",[ts,ts,taskId]);const[projection]=await c.execute<(RowDataPacket & {nowplaying:string})[]>('SELECT nowplaying FROM reservation WHERE id=? FOR UPDATE',[task.request_id]);if(projection[0]?.nowplaying!==STATUS_PLAYING)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not playing');const[r]=await c.execute('UPDATE reservation SET nowplaying=? WHERE id=?',[STATUS_COMPLETED,task.request_id]);if(Number((r as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not playing');await this.event(c,taskId,'eof','eof',agentId,{reason:'eof'});changed=true;eventType='eof';}else if(task.state!=='completed')throw new BoundaryError(409,'INVALID_PLAYER_TRANSITION','EOF reported before confirmed playback');}
    else if(input.state==='failed'&&['claimed','playing'].includes(task.state)){await c.execute("UPDATE playback_task SET state='failed',playback_state=?,updated_at=?,finished_at=?,lease_until=NULL,command=NULL,error_code=?,error_message=? WHERE task_id=?",[input.playback,ts,ts,input.outcome==='skipped'?'SKIPPED':'PLAYER_FAILED',input.outcome==='skipped'?'Playback skipped by administrator':'Playback failed; inspect Agent health',taskId]);const[r]=await c.execute("UPDATE reservation SET nowplaying='蛛懈ｭ｢荳ｭ' WHERE id=? AND nowplaying IN ('蜀咲函髢句ｧ句ｾ・■','蜀咲函荳ｭ')",[task.request_id]);if(Number((r as {affectedRows:number}).affectedRows)!==1)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','Legacy queue projection is not active');eventType=input.outcome==='skipped'?'skipped':'failed';await this.event(c,taskId,eventType,eventType,agentId,{code:eventType});changed=true;}
    if(['playing','paused','stopped','unavailable'].includes(input.playback)&&task.playback_state!==input.playback&&task.state!=='completed'&&task.state!=='failed'){await c.execute('UPDATE playback_task SET playback_state=?,updated_at=? WHERE task_id=?',[input.playback,ts,taskId]);if(input.playback==='paused'||(input.playback==='playing'&&task.playback_state==='paused')){const type=input.playback==='paused'?'paused':'resumed';await this.event(c,taskId,`${type}:${randomUUID()}`,type,agentId);eventType=eventType||type;changed=true;}}
    if((task.command==='pause'&&input.playback==='paused')||(task.command==='resume'&&input.playback==='playing'))await c.execute('UPDATE playback_task SET command=NULL,updated_at=? WHERE task_id=?',[ts,taskId]);return {changed,eventType,state:await this.taskOn(c,taskId)};});}
  private async taskOn(c:import('mysql2/promise').PoolConnection,id:string){const[rows]=await c.execute<(RowDataPacket & Record<string,unknown>)[]>('SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,playback_state AS playback,command,created_at AS createdAt FROM playback_task WHERE task_id=?',[id]);return rows[0];}
  async control(action:'pause'|'resume'|'stop'|'skip'){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {task_id:string;agent_id:string|null;command_seq:number;state:string})[]>("SELECT task_id,agent_id,command_seq,state FROM playback_task WHERE state IN ('claimed','playing','uncertain') LIMIT 1 FOR UPDATE");const row=rows[0];if(!row)throw new BoundaryError(409,'NO_ACTIVE_QUEUE_TASK','No active formal playback task');const seq=Number(row.command_seq)+1;await c.execute('UPDATE playback_task SET command=?,command_seq=?,updated_at=? WHERE task_id=?',[action,seq,this.now(),row.task_id]);await this.event(c,row.task_id,`command:${seq}`,'command',row.agent_id,{action});return {taskId:row.task_id,action,queued:true as const};});}
  async stopPending(){return this.store.transaction(async c=>{const[rows]=await c.execute<(RowDataPacket & {task_id:string;request_id:number;agent_id:string|null})[]>("SELECT task_id,request_id,agent_id FROM playback_task WHERE state='claimed' AND started_at IS NULL LIMIT 1 FOR UPDATE");const row=rows[0];if(!row)return null;const ts=this.now();await c.execute("UPDATE playback_task SET state='failed',finished_at=?,updated_at=?,error_code='STOPPED_BEFORE_PLAY',error_message='Stopped before playback confirmation' WHERE task_id=? AND state='claimed'",[ts,ts,row.task_id]);await c.execute("UPDATE reservation SET nowplaying='譛ｪ蜀咲函' WHERE id=? AND nowplaying='蜀咲函髢句ｧ句ｾ・■'",[row.request_id]);await this.event(c,row.task_id,'stopped-before-play','stopped',row.agent_id);return row.task_id;});}
  async history(limit:number,offset:number){const safeLimit=Math.max(1,Math.min(200,Math.trunc(limit))),safeOffset=Math.max(0,Math.trunc(offset));const tasks=await this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT task_id AS id,request_id AS requestId,state,agent_id AS agentId,created_at AS createdAt,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode FROM playback_task ORDER BY created_at DESC,task_id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`);const events=await this.store.rows<RowDataPacket & Record<string,unknown>>(`SELECT event_id AS id,task_id AS taskId,event_type AS type,agent_id AS agentId,occurred_at AS occurredAt,details_json AS details FROM playback_event ORDER BY occurred_at DESC,event_id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`);return {tasks,events:events.map(event=>({...event,details:typeof event.details==='string'?JSON.parse(event.details):event.details}))};}
}
