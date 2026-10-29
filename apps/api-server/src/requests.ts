import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { BoundaryError } from './errors.js';
import { integer, phpEmpty } from './queue.js';
import { queueDatabasePath } from './queue-database.js';
import { automaticOrder, type OrderRow } from './request-order.js';

const scalar=z.union([z.string().max(8192),z.number().finite()]);
const text=(max:number)=>z.string().refine(s=>[...s].length<=max, 'Too long');
export const requestInputSchema=z.object({filename:text(2048), singer:text(256), freesinger:text(256).optional(), comment:text(512),
  kind:z.enum(['動画','小休止','カラオケ配信','URL指定','動画_別プ']),fullpath:z.string().max(4096).default(''),secret:scalar.optional(),loop:scalar.optional(),
  participantId:z.string().uuid().optional(),otherplayer:scalar.optional(),urlreq:scalar.optional(),keychange:scalar.optional(),track:scalar.optional(),pause:scalar.optional(),
  audiodelay:scalar.optional(),volume:scalar.optional(),duration:scalar.optional(),selectid:scalar.optional()}).strict();
export type RequestInput=z.infer<typeof requestInputSchema>;
export const requestContextSchema=z.object({database:z.string(),ip:z.string(),ua:z.string(),userid:z.string(),
  automove:z.boolean(),reset:z.boolean(),midjoin:z.boolean(),history:z.boolean(),
  metadata:z.record(z.string(),z.string()).nullable(),metadata_warning:z.string().optional(),nonameusername:z.string().default('名無しさん'),displayname:z.string().max(256).default('')});
export type RequestContext=z.infer<typeof requestContextSchema>;
export interface RequestResult { id:number; committed:true; operation:'create'|'replace'; warnings:string[]; notification:'unconfirmed'|'acknowledged' }
const resultSchema=z.object({id:z.number().int().positive(),committed:z.literal(true),operation:z.enum(['create','replace']),warnings:z.array(z.string()),notification:z.enum(['unconfirmed','acknowledged'])});
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Purpose-separated durable receipt capability, independent of in-memory login sessions. */
export class SubmissionReceipts {
  constructor(private secret:string) {}
  issue() { const nonce=randomBytes(32).toString('base64url'); return nonce+'.'+createHmac('sha256',this.secret).update('submission-v1\0'+nonce).digest('hex'); }
  verify(receipt:string) {
    const [nonce,mac,...rest]=receipt.split('.');
    if(rest.length || !/^[A-Za-z0-9_-]{43}$/.test(nonce||'') || !/^[a-f0-9]{64}$/.test(mac||'')) throw new BoundaryError(400,'INVALID_RECEIPT','需要服务端签发的提交凭据');
    if(!timingSafeEqual(Buffer.from(mac,'hex'),createHmac('sha256',this.secret).update('submission-v1\0'+nonce).digest())) throw new BoundaryError(403,'INVALID_RECEIPT','提交凭据无效');
    return digest(receipt);
  }
}
export function verifyLegacySubmission(envelope:string,secret:string) {
  try {
    const [payload,mac,...rest]=envelope.split('.');
    if(rest.length || envelope.length>60000 || !/^[A-Za-z0-9_-]+$/.test(payload||'') || !/^[a-f0-9]{64}$/.test(mac||''))throw Error();
    if(!timingSafeEqual(Buffer.from(mac,'hex'),createHmac('sha256',secret).update('legacy-request-v1\0'+payload).digest()))throw Error();
    const value=z.object({v:z.literal(1),aud:z.literal('legacy-request'),iat:z.number().int(),exp:z.number().int(),
      userid:z.string().uuid(),proof:z.string().regex(/^[a-f0-9]{64}$/),ip:z.string().max(256),ua:z.string().max(1024),
      receipt:z.string().max(256),username:z.string().max(256).optional(),input:z.record(z.string(),z.unknown()),mode:z.enum(['submit','result'])}).strict().parse(JSON.parse(Buffer.from(payload,'base64url').toString()));
    const now=Math.floor(Date.now()/1000);
    if(value.exp<=now || value.iat>now+5 || value.iat<now-45 || value.exp-value.iat>45)throw Error();
    return value;
  }catch{throw new BoundaryError(403,'LEGACY_SUBMISSION_DENIED','Legacy submission service authentication failed');}
}
export function normalizeRequest(input:RequestInput) {
  let kind=input.kind;
  if(Number(input.loop??0)!==0)kind='\u30ab\u30e9\u30aa\u30b1\u914d\u4fe1';
  if(input.otherplayer!==undefined && kind==='\u52d5\u753b')kind='\u52d5\u753b_\u5225\u30d7';
  const numeric=(v:unknown)=> typeof v==='number' || (typeof v==='string' && v.trim()!=='' && Number.isFinite(Number(v)));
  const number=(v:unknown)=>numeric(v)?Number(v):0;
  const limited=(v:unknown,min:number,max:number)=>{const n=integer(v);return n<min||n>max?0:n;};
  // Legacy sets urlreq from the original kind before applying loop's kind override,
  // then lets an explicit urlreq field replace that default.
  const url=(input.urlreq===undefined ? (input.kind.includes('URL\u6307\u5b9a')?1:0) : Number(input.urlreq))===1;
  const songfile=url?input.filename:input.filename.replace(/\(ニコカラ.*?\)|（ニコカラ.*?）|【ニコカラ.*?】|\[ニコカラ.*?\]/g,'').replace(/(.+)(\.[^.]+$)/,'$1');
  return {songfile,singer:!phpEmpty(input.freesinger)?input.freesinger!:input.singer,comment:input.comment,kind,fullpath:input.fullpath,
    secret:input.secret??0,loop:input.loop??0,keychange:number(input.keychange),track:number(input.track),pause:number(input.pause),
    audiodelay:limited(input.audiodelay,-9900,9900),volume:limited(input.volume,-100,100),duration:Math.max(0,integer(input.duration)),
    selectid:numeric(input.selectid)?integer(input.selectid):null};
}
export class RequestRepository {
  constructor(private root:string) {}
  acknowledge(database:string,key:string,result:RequestResult) {
    let db:DatabaseSync|undefined;
    try {
      db=new DatabaseSync(queueDatabasePath(this.root,database),{timeout:1000});
      db.prepare('UPDATE request_submission SET result_json=? WHERE key_hash=?').run(JSON.stringify(result),key);
      return true;
    }catch{return false;}finally{db?.close();}
  }
  lookup(database:string,key:string,ownerId:string) {
    let db:DatabaseSync|undefined;
    try {
      db=new DatabaseSync(queueDatabasePath(this.root,database),{timeout:1000,readOnly:true});
      const row=db.prepare('SELECT owner_id,result_json FROM request_submission WHERE key_hash=?').get(key);
      if(row && row.owner_id!==ownerId) throw new BoundaryError(404,'SUBMISSION_NOT_FOUND','提交记录不存在');
      return row?resultSchema.parse(JSON.parse(String(row.result_json))):null;
    } catch(error) {if(error instanceof BoundaryError)throw error;throw new BoundaryError(503,'SUBMISSION_UNAVAILABLE','提交记录不可读取；请勿换凭据重复提交');}
    finally{db?.close();}
  }
  commit(context:RequestContext,input:RequestInput,key:string) {
    let db:DatabaseSync|undefined;
    try {
      db=new DatabaseSync(queueDatabasePath(this.root,context.database),{timeout:1000}); db.exec('BEGIN IMMEDIATE');
      const hash=digest(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)))));
      const prior=db.prepare('SELECT input_hash,owner_id,result_json FROM request_submission WHERE key_hash=?').get(key);
      if(prior) {
        if(prior.owner_id!==context.userid) throw new BoundaryError(404,'SUBMISSION_NOT_FOUND','提交记录不存在');
        if(prior.input_hash!==hash)throw new BoundaryError(409,'SUBMISSION_CONFLICT','同一提交凭据不能用于不同预约');
        const result=resultSchema.parse(JSON.parse(String(prior.result_json)));db.exec('COMMIT');return {result,replayed:true};
      }
      const value=normalizeRequest(input),{selectid,...fields}=value;
      let id:number;
      if(selectid!==null) {
        const old=db.prepare('SELECT nowplaying FROM requesttable WHERE id=?').get(selectid);
        if(!old)throw new BoundaryError(404,'NOT_FOUND','替换目标不存在');
        // Legacy replacement preserves original IP/UA, status, playtimes and reqorder.
        const playing=old.nowplaying==='再生中'||old.nowplaying==='再生開始待ち'?'変更中':old.nowplaying;
        db.prepare(`UPDATE requesttable SET ${Object.keys(fields).map(k=>k+'=?').join(',')},nowplaying=? WHERE id=?`)
          .run(...Object.values(fields),playing as string|null,selectid);id=selectid;
      } else {
        const entries={...fields,nowplaying:'未再生',status:'new',clientip:context.ip,clientua:context.ua,playtimes:0};
        id=Number(db.prepare(`INSERT INTO requesttable(${Object.keys(entries).join(',')}) VALUES(${Object.keys(entries).map(()=>'?').join(',')})`).run(...Object.values(entries)).lastInsertRowid);
        const max=integer(db.prepare('SELECT COALESCE(MAX(reqorder),0) n FROM requesttable WHERE id!=?').get(id)!.n);
        db.prepare("UPDATE requesttable SET reqorder=?,status='OK' WHERE id=?").run(max+1,id);
        if(context.automove) {
          const rows=db.prepare('SELECT id,reqorder,singer,kind,nowplaying FROM requesttable ORDER BY reqorder ASC').all() as unknown as OrderRow[];
          for(const row of automaticOrder(rows,id,context.reset,context.midjoin)) db.prepare('UPDATE requesttable SET reqorder=? WHERE id=?').run(row.reqorder,row.id);
        }
      }
      const metadata=context.metadata??(selectid!==null?{song_name:'',lister_artist:'',lister_work:'',lister_op_ed:'',lister_comment:''}:null);
      if(metadata) {
        const keys=['song_name','lister_artist','lister_work','lister_op_ed','lister_comment'];
        db.prepare(`UPDATE requesttable SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`).run(...keys.map(k=>metadata[k]??''),id);
      }
      const now=Math.floor(Date.now()/1000);
      if(selectid===null && context.history) {
        db.prepare("INSERT OR IGNORE INTO mypage_user(userid,displayname,created_at) VALUES(?,?,?)").run(context.userid,[...context.displayname].slice(0,64).join(''),now);
        if(context.displayname) db.prepare("UPDATE mypage_user SET displayname=? WHERE userid=? AND (displayname='' OR displayname IS NULL)").run([...context.displayname].slice(0,64).join(''),context.userid);
        db.prepare('INSERT INTO mypage_history(userid,fullpath,songfile,kind,requested_at) VALUES(?,?,?,?,?)').run(context.userid,value.fullpath,value.songfile,value.kind,now);
      }
      const result:RequestResult={id,committed:true,operation:selectid===null?'create':'replace',warnings:context.metadata_warning?[context.metadata_warning]:[],notification:'unconfirmed'};
      db.prepare('INSERT INTO request_submission VALUES(?,?,?,?,?,?,?)').run(key,hash,context.userid,id,result.operation,now,JSON.stringify(result));
      db.exec('COMMIT');return {result,replayed:false};
    } catch(error) {
      if(db?.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'SUBMISSION_UNKNOWN','回滚未确认；保留提交凭据，查询结果，不要新建提交');}
      if(error instanceof BoundaryError)throw error;
      throw new BoundaryError(503,'SUBMISSION_UNAVAILABLE','预约事务未完成；请使用原提交凭据查询或重试，不要换凭据');
    } finally{db?.close();}
  }
}
export class RequestService {
  constructor(private repository:RequestRepository,private receipts:SubmissionReceipts) {}
  async submit(context:RequestContext,input:RequestInput,receipt:string,notify:()=>Promise<unknown>) {
    const value=this.repository.commit(context,input,this.receipts.verify(receipt));
    if(!value.replayed)try{
      await notify();
      const acknowledged={...value.result,notification:'acknowledged' as const};
      if(this.repository.acknowledge(context.database,this.receipts.verify(receipt),acknowledged))value.result=acknowledged;
    }catch{ /* The ledger already durably records an unconfirmed notification. */ }
    if(value.result.notification==='unconfirmed')value.result.warnings.push('预约已提交，更新通知未确认；不要创建新提交');
    // A replay is always the same committed transaction, never another notification/history insert.
    return value;
  }
  lookup(database:string,receipt:string,ownerId:string){return this.repository.lookup(database,this.receipts.verify(receipt),ownerId);}
}
