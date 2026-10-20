import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { queueDatabasePath } from './queue-database.js';
import { BoundaryError } from './errors.js';
import { integer } from './queue.js';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Shared owner fence: the legacy Windows manager and status writers must stop while Node owns playback. */
export class QueueAutoplayOwner {
  readonly path: string;
  constructor(queueRoot: string) { this.path = join(queueRoot, 'node-autoplay.owner'); }
  acquire() {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${randomUUID()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ owner: 'fastify', acquiredAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    try { renameSync(tmp, this.path); } catch (error) { try { unlinkSync(tmp); } catch { /* best effort */ } throw error; }
  }
  release() { try { unlinkSync(this.path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
  active() { return existsSync(this.path); }
}

export interface QueueSong {
  id: number;
  songfile: string;
  fullpath: string;
  kind: string;
  reqorder: number;
  nowplaying: string;
  playtimes: number;
}
const audio = new Set(['mp3','m4a','wav','ogg','flac','wma','aac']);
const video = new Set(['mp4','avi','mkv','mpg','flv','webm','wmv','ogm','mov']);
const ext = (value: string) => value.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] || '';

/** Queue markers in requesttable are the durable single-row claim; no parallel queue/schema is created. */
export class QueueAutoplayRepository {
  constructor(private root: string) {}
  private open(database: string) { return new DatabaseSync(queueDatabasePath(this.root, database), { timeout: 1000, allowExtension: false }); }

  claimNext(database: string, playmode: number): QueueSong | null {
    if (playmode !== 1) throw new BoundaryError(409, 'AUTOPLAY_MODE_UNSUPPORTED', '自动切歌目前只支持原版顺序自动模式（playmode=1）；当前播放模式未改变');
    const db = this.open(database);
    try {
      db.exec('BEGIN IMMEDIATE');
      const active = db.prepare("SELECT id,nowplaying FROM requesttable WHERE nowplaying IN ('再生開始待ち','再生中','変更中') ORDER BY reqorder ASC,id ASC").all() as Array<{id:number;nowplaying:string}>;
      if (active.length) {
        if (active.length === 1 && active[0].nowplaying === '再生開始待ち') {
          const row = db.prepare('SELECT id,songfile,fullpath,kind,reqorder,nowplaying,playtimes,loop,pause,track,keychange,audiodelay,volume FROM requesttable WHERE id=?').get(active[0].id) as (QueueSong & Record<string, unknown>) | undefined;
          if (row) { this.assertSupported(row); db.exec('COMMIT'); return this.song(row); }
        }
        throw new BoundaryError(409, 'AUTOPLAY_RECOVERY_REQUIRED', '检测到已有播放中或不可恢复的队列项目；为避免重复播放，自动播放已暂停，请管理员检查状态');
      }
      const row = db.prepare("SELECT id,songfile,fullpath,kind,reqorder,nowplaying,playtimes,loop,pause,track,keychange,audiodelay,volume FROM requesttable WHERE nowplaying='未再生' ORDER BY reqorder ASC,id ASC LIMIT 1").get() as (QueueSong & Record<string, unknown>) | undefined;
      if (!row) { db.exec('COMMIT'); return null; }
      this.assertSupported(row);
      const changed = db.prepare("UPDATE requesttable SET nowplaying='再生開始待ち' WHERE id=? AND nowplaying='未再生'").run(row.id);
      if (Number(changed.changes) !== 1) throw new BoundaryError(409, 'AUTOPLAY_CLAIM_RACE', '预约队列已被并发修改；未启动播放器');
      db.exec('COMMIT'); return { ...this.song(row), nowplaying: '再生開始待ち' };
    } catch (error) {
      if (db.isTransaction) try { db.exec('ROLLBACK'); } catch { throw new BoundaryError(503, 'AUTOPLAY_WRITE_UNCERTAIN', '队列认领结果未知；已暂停自动播放，请回读队列'); }
      if (error instanceof BoundaryError) throw error;
      throw new BoundaryError(503, 'AUTOPLAY_QUEUE_UNAVAILABLE', '无法安全读取或认领队列；没有启动下一首');
    } finally { db.close(); }
  }

  private assertSupported(row: QueueSong & Record<string, unknown>) {
    if (row.kind !== '動画') throw new BoundaryError(409, 'AUTOPLAY_ITEM_UNSUPPORTED', `队列第 ${row.id} 项属于“${row.kind}”，不属于已验证的本地视频/音频切片；未跳过该项`);
    if (typeof row.fullpath !== 'string' || row.fullpath.trim() === '' || /^https?:\/\//i.test(row.fullpath)) throw new BoundaryError(409, 'AUTOPLAY_PATH_UNAVAILABLE', `队列第 ${row.id} 项没有可验证的本地媒体路径`);
    if (!audio.has(ext(row.fullpath)) && !video.has(ext(row.fullpath))) throw new BoundaryError(409, 'AUTOPLAY_FORMAT_UNSUPPORTED', `队列第 ${row.id} 项格式尚未验证`);
    for (const key of ['loop','pause','track','keychange','audiodelay','volume']) {
      const n = Number(row[key]);
      if (!Number.isFinite(n) || n !== 0) throw new BoundaryError(409, 'AUTOPLAY_OPTIONS_UNSUPPORTED', `队列第 ${row.id} 项配置了尚未迁移的 ${key} 播放选项；未跳过该项`);
    }
  }
  private song(row: QueueSong) { return { id: integer(row.id), songfile: String(row.songfile || ''), fullpath: String(row.fullpath || ''), kind: String(row.kind || ''), reqorder: integer(row.reqorder), nowplaying: String(row.nowplaying || ''), playtimes: integer(row.playtimes) }; }

  markPlaying(database: string, id: number) { return this.transition(database, id, '再生開始待ち', '再生中', true); }
  markCompleted(database: string, id: number) { return this.transition(database, id, '再生中', '再生済', false); }
  markStopped(database: string, id: number) {
    let db: DatabaseSync | undefined;
    try {
      db=this.open(database); db.exec('BEGIN IMMEDIATE');
      const row=db.prepare('SELECT nowplaying FROM requesttable WHERE id=?').get(id) as {nowplaying:string}|undefined;
      if(!row) throw new BoundaryError(404,'AUTOPLAY_ITEM_MISSING','当前预约已不存在');
      if(row.nowplaying==='停止中') { db.exec('COMMIT'); return false; }
      if(row.nowplaying!=='再生開始待ち'&&row.nowplaying!=='再生中') throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','预约状态已变化；未将其标记为完成');
      db.prepare("UPDATE requesttable SET nowplaying='停止中' WHERE id=?").run(id); db.exec('COMMIT'); return true;
    } catch(error) {
      if(db?.isTransaction) try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'AUTOPLAY_WRITE_UNCERTAIN','停止状态提交结果未知');}
      if(error instanceof BoundaryError)throw error;
      throw new BoundaryError(503,'AUTOPLAY_QUEUE_UNAVAILABLE','停止状态写入失败');
    } finally { db?.close(); }
  }
  releaseUnstarted(database: string, id: number) {
    const db=this.open(database);
    try {
      db.exec('BEGIN IMMEDIATE');
      const result=db.prepare("UPDATE requesttable SET nowplaying='未再生' WHERE id=? AND nowplaying='再生開始待ち'").run(id);
      db.exec('COMMIT');
      if(Number(result.changes)!==1) throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT','预约已开始或状态已改变；没有取消播放');
    } catch(error) {
      if(db.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'AUTOPLAY_WRITE_UNCERTAIN','取消认领结果未知');}
      if(error instanceof BoundaryError)throw error;
      throw new BoundaryError(503,'AUTOPLAY_QUEUE_UNAVAILABLE','无法安全取消尚未开始的预约');
    } finally { db.close(); }
  }
  read(database: string, id: number) {
    const db=this.open(database); try { return db.prepare('SELECT id,songfile,fullpath,kind,reqorder,nowplaying,playtimes FROM requesttable WHERE id=?').get(id) as QueueSong|undefined; } finally { db.close(); }
  }
  private transition(database:string,id:number,from:string,to:string,increment:boolean) {
    let db:DatabaseSync|undefined;
    try {
      db=this.open(database); db.exec('BEGIN IMMEDIATE');
      const row=db.prepare('SELECT nowplaying FROM requesttable WHERE id=?').get(id) as {nowplaying:string}|undefined;
      if(!row)throw new BoundaryError(404,'AUTOPLAY_ITEM_MISSING','当前预约已不存在');
      if(row.nowplaying===to){db.exec('COMMIT');return false;}
      if(row.nowplaying!==from)throw new BoundaryError(409,'AUTOPLAY_STATE_CONFLICT',`预约状态不再是 ${from}；不会伪造 ${to}`);
      db.prepare(`UPDATE requesttable SET nowplaying=?,playtimes=COALESCE(playtimes,0)+? WHERE id=? AND nowplaying=?`).run(to,increment?1:0,id,from);
      db.exec('COMMIT'); return true;
    }catch(error){
      if(db?.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'AUTOPLAY_WRITE_UNCERTAIN','播放状态提交结果未知；不要重放当前预约');}
      if(error instanceof BoundaryError)throw error;
      throw new BoundaryError(503,'AUTOPLAY_QUEUE_UNAVAILABLE','播放状态提交失败');
    }finally{db?.close();}
  }
}

export class QueueAutoplayService {
  constructor(private repository:QueueAutoplayRepository){}
  claim(database:string,playmode:number){return this.repository.claimNext(database,playmode);}
  playing(database:string,id:number){return this.repository.markPlaying(database,id);}
  completed(database:string,id:number){return this.repository.markCompleted(database,id);}
  stopped(database:string,id:number){return this.repository.markStopped(database,id);}
  releaseUnstarted(database:string,id:number){return this.repository.releaseUnstarted(database,id);}
  read(database:string,id:number){return this.repository.read(database,id);}
}
