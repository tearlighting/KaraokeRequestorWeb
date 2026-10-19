import { DatabaseSync } from 'node:sqlite';
import { realpathSync } from 'node:fs';
import { isAbsolute, resolve, relative, sep } from 'node:path';
import { BoundaryError } from './errors.js';
import { integer } from './queue.js';

export type QueueAction = 'delete' | 'up' | 'down' | 'warikomi';
/** Only existing files inside the dedicated queue mount. Never initializes a database. */
export class QueueMutationRepository {
  constructor(private root: string) {
    if (!isAbsolute(root)) throw new Error('Queue database root must be absolute');
  }
  mutate(database: string, id: number, action: QueueAction): string {
    let db: DatabaseSync | undefined;
    try {
      if (isAbsolute(database) || database.includes('\\')) throw new Error('Invalid database');
      const root = realpathSync(this.root), path = realpathSync(resolve(root, database));
      const rel = relative(root, path);
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Invalid database');
      db = new DatabaseSync(path, { timeout: 1000, allowExtension: false });
      // Serialize selection, swap/deletion and normalization across both PHP and Node.
      db.exec('BEGIN IMMEDIATE');
      if (!db.prepare('SELECT id FROM requesttable WHERE id=?').get(id)) throw new BoundaryError(404, 'NOT_FOUND', 'not found');
      const connection = db;
      const target = () => connection.prepare('SELECT reqorder FROM requesttable WHERE id=?').get(id)!;
      const swap = (direction: 'up' | 'down') => {
        const order = integer(target().reqorder);
        const neighbor = connection.prepare(`SELECT id,reqorder FROM requesttable WHERE reqorder ${direction === 'up' ? '>' : '<'} ? ORDER BY reqorder ${direction === 'up' ? 'ASC' : 'DESC'} LIMIT 1`).get(order);
        if (!neighbor) return direction === 'up' ? 'すでに一番上です。' : 'すでに一番下です。';
        // Preserve Legacy's temporary-9999 behavior, including existing collisions.
        connection.prepare('UPDATE requesttable SET reqorder=9999 WHERE id=?').run(integer(neighbor.id));
        connection.prepare('UPDATE requesttable SET reqorder=? WHERE id=?').run(integer(neighbor.reqorder), id);
        connection.prepare('UPDATE requesttable SET reqorder=? WHERE reqorder=9999').run(order);
        return '';
      };
      let message = '';
      if (action === 'delete') db.prepare('DELETE FROM requesttable WHERE id=?').run(id);
      else if (action === 'warikomi') {
        // PHP scans past completed rows, but swaps the immediate lower neighbor.
        // '1' is intentionally NOT treated as 未再生 by this operation.
        const seen = new Set<string>();
        for (;;) {
          const state = JSON.stringify(db.prepare('SELECT id,reqorder FROM requesttable ORDER BY id').all());
          if (seen.has(state)) throw new BoundaryError(409, 'QUEUE_ORDER_CYCLE', 'Legacy ordering cannot make progress; transaction rolled back');
          seen.add(state);
          const rows = db.prepare('SELECT nowplaying FROM requesttable WHERE reqorder < ? ORDER BY reqorder DESC').all(integer(target().reqorder));
          const next = rows.find(row => row.nowplaying === '再生中' || row.nowplaying === '未再生');
          if (!next || next.nowplaying === '再生中') break;
          message += swap('down');
        }
      } else message = swap(action);
      const rows = db.prepare('SELECT id,reqorder FROM requesttable ORDER BY reqorder ASC,id ASC').all();
      const update = db.prepare('UPDATE requesttable SET reqorder=? WHERE id=?');
      rows.forEach((row, index) => { if (integer(row.reqorder) !== index + 1) update.run(index + 1, integer(row.id)); });
      db.exec('COMMIT');
      return message;
    } catch (error) {
      if (db?.isTransaction) {
        try { db.exec('ROLLBACK'); }
        catch { throw new BoundaryError(503, 'QUEUE_WRITE_UNCERTAIN', '数据库回滚未确认；请回读检查，不要自动重试写操作'); }
      }
      if (error instanceof BoundaryError) throw error;
      throw new BoundaryError(503, 'QUEUE_WRITE_UNAVAILABLE', '队列事务失败并已回滚；数据库不可用或被锁定');
    } finally { db?.close(); }
  }

  reorder(database:string,ids:number[]) {
    let db:DatabaseSync|undefined;
    try {
      if(isAbsolute(database)||database.includes('\\'))throw new Error('Invalid database');
      const root=realpathSync(this.root),path=realpathSync(resolve(root,database)),rel=relative(root,path);
      if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('Invalid database');
      db=new DatabaseSync(path,{timeout:1000,allowExtension:false});db.exec('BEGIN IMMEDIATE');
      const rows=db.prepare('SELECT id,nowplaying,reqorder FROM requesttable').all() as Array<{id:number;nowplaying:string;reqorder:number}>;
      const state=new Map(rows.map(row=>[Number(row.id),row]));
      const playedMax=Math.max(0,...rows.filter(row=>row.nowplaying!=='未再生').map(row=>integer(row.reqorder)));
      const unplayed=ids.filter(id=>state.get(id)?.nowplaying==='未再生');
      const update=db.prepare('UPDATE requesttable SET reqorder=? WHERE id=?');
      unplayed.forEach((id,index)=>update.run(playedMax+unplayed.length-index,id));
      const ordered=db.prepare('SELECT id,reqorder FROM requesttable ORDER BY reqorder ASC,id ASC').all() as Array<{id:number;reqorder:number}>;
      ordered.forEach((row,index)=>{if(integer(row.reqorder)!==index+1)update.run(index+1,row.id);});
      db.exec('COMMIT');return unplayed.length;
    }catch(error){
      if(db?.isTransaction)try{db.exec('ROLLBACK');}catch{throw new BoundaryError(503,'QUEUE_WRITE_UNCERTAIN','批量排序提交结果未知，请查询队列后再操作');}
      if(error instanceof BoundaryError)throw error;
      throw new BoundaryError(503,'QUEUE_WRITE_UNAVAILABLE','队列排序失败或数据库不可用');
    }finally{db?.close();}
  }
}

export class QueueMutationService {
  constructor(private repository: QueueMutationRepository) {}
  async execute(database: string, id: number, action: QueueAction, notify: () => Promise<unknown>) {
    const message = this.repository.mutate(database, id, action);
    // Legacy notice lives in another database and was already outside its queue transaction.
    // Do not retry the committed mutation if notification fails.
    try { await notify(); }
    catch { throw new BoundaryError(502, 'QUEUE_COMMITTED_NOTICE_FAILED', '队列已提交，但更新通知失败。请刷新确认；不要重试写操作。'); }
    return action === 'delete' ? { id, deleted: true as const } : { id, action, message };
  }
  async reorder(database:string,ids:number[],notify:()=>Promise<unknown>){
    const count=this.repository.reorder(database,ids);
    try{await notify();}catch{throw new BoundaryError(502,'QUEUE_COMMITTED_NOTICE_FAILED','排序已提交，更新通知未确认；请先重新读取队列');}
    return {reordered:true as const,count};
  }
}
