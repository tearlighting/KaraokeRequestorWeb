import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlaybackTaskRepository } from '../src/playback-tasks.js';

const migration=readFileSync(new URL('../migrations/002-playback-task.sql',import.meta.url),'utf8');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'yukari-playback-task-'));const path=join(root,'request.db');const db=new DatabaseSync(path);
  db.exec(`CREATE TABLE requesttable(id INTEGER PRIMARY KEY,songfile TEXT,fullpath TEXT,kind TEXT,reqorder INTEGER,nowplaying TEXT,playtimes INTEGER,loop INTEGER,pause INTEGER,track INTEGER,keychange INTEGER,audiodelay INTEGER,volume INTEGER);
    INSERT INTO requesttable VALUES(1,'first','D:\\media\\first.mp4','動画',1,'未再生',0,0,0,0,0,0,0);
    INSERT INTO requesttable VALUES(2,'second','D:\\media\\second.mp4','動画',2,'未再生',0,0,0,0,0,0,0);`);db.exec(migration);db.close();
  let time=1000;const repo=new PlaybackTaskRepository(root,()=>time);return {root,path,repo,advance:(n:number)=>time+=n,close:()=>rmSync(root,{recursive:true,force:true})};
}
function sql(path:string){return new DatabaseSync(path);}

test('formal claim, playing projection, pause/resume events and real EOF are atomic and idempotent',()=>{
  const f=fixture();try{
    const first=f.repo.claimNext('request.db',1,'agent-a');assert.equal(first.task?.requestId,1);assert.equal(first.task?.state,'claimed');
    assert.throws(()=>f.repo.claimNext('request.db',1,'agent-b'),{code:'PLAYBACK_TASK_OWNED'});
    const task=first.task!;
    let r=f.repo.report('request.db',task.id,'agent-a',{state:'playing',playback:'playing'});assert.equal(r.changed,true);
    f.repo.report('request.db',task.id,'agent-a',{state:'playing',playback:'playing'});
    f.repo.report('request.db',task.id,'agent-a',{playback:'paused'});
    f.repo.report('request.db',task.id,'agent-a',{playback:'paused'});
    f.repo.report('request.db',task.id,'agent-a',{state:'playing',playback:'playing'});
    assert.throws(()=>f.repo.report('request.db',task.id,'agent-a',{state:'completed',playback:'idle'}),{code:'PLAYER_EOF_REQUIRED'});
    r=f.repo.report('request.db',task.id,'agent-a',{state:'completed',playback:'idle',endReason:'eof'});assert.equal(r.changed,true);
    const duplicate=f.repo.report('request.db',task.id,'agent-a',{state:'completed',playback:'idle',endReason:'eof'});assert.equal(duplicate.changed,false);
    const db=sql(f.path);assert.deepEqual({...db.prepare('SELECT nowplaying,playtimes FROM requesttable WHERE id=1').get() as object},{nowplaying:'再生済',playtimes:1});
    assert.equal((db.prepare('SELECT COUNT(*) n FROM playback_event WHERE task_id=?').get(task.id) as {n:number}).n,5);db.close();
    const second=f.repo.claimNext('request.db',1,'agent-a').task!;assert.equal(second.requestId,2);
    f.repo.report('request.db',second.id,'agent-a',{state:'playing',playback:'playing'});
    f.repo.report('request.db',second.id,'agent-a',{state:'completed',playback:'idle',endReason:'eof'});
    const later=sql(f.path);assert.equal((later.prepare("SELECT COUNT(*) n FROM playback_event WHERE task_id=? AND event_type='eof'").get(second.id) as {n:number}).n,1);later.close();
  }finally{f.close();}
});

test('node restart and lease expiry fail closed as uncertain and require Agent confirmed stop',()=>{
  const f=fixture();try{
    const task=f.repo.claimNext('request.db',1,'agent-a').task!;
    f.repo.report('request.db',task.id,'agent-a',{state:'playing',playback:'playing'});
    assert.equal(f.repo.recoverOnStartup('request.db'),1);
    const recovered=f.repo.claimNext('request.db',1,'agent-a');assert.equal(recovered.uncertain,true);assert.equal(recovered.commandTaskId,task.id);
    assert.throws(()=>f.repo.report('request.db',task.id,'agent-a',{state:'completed',playback:'idle',endReason:'eof'}),{code:'PLAYBACK_OUTCOME_UNCERTAIN'});
    f.repo.report('request.db',task.id,'agent-a',{state:'failed',playback:'stopped',error:'confirmed stop'});
    assert.equal(f.repo.readTask('request.db',task.id)?.state,'failed');
    const db=sql(f.path);assert.equal((db.prepare('SELECT nowplaying FROM requesttable WHERE id=1').get() as {nowplaying:string}).nowplaying,'停止中');db.close();
  }finally{f.close();}
});

test('expired lease becomes uncertain rather than being reassigned or replayed',()=>{
  const f=fixture();try{const task=f.repo.claimNext('request.db',1,'agent-a').task!;f.advance(16000);const next=f.repo.claimNext('request.db',1,'agent-b');assert.equal(next.uncertain,true);assert.equal(next.commandTaskId,task.id);assert.equal(f.repo.current('request.db')?.state,'uncertain');}finally{f.close();}
});

test('formal queue scheduler fails closed for Legacy play modes 2 through 5 without claiming a row',()=>{
  const f=fixture();try{
    for(const mode of [2,3,4,5])assert.throws(()=>f.repo.claimNext('request.db',mode,'agent-a'),{code:'AUTOPLAY_MODE_UNSUPPORTED'});
    const db=sql(f.path);assert.equal((db.prepare("SELECT COUNT(*) n FROM requesttable WHERE nowplaying='\u672a\u518d\u751f'").get() as {n:number}).n,2);assert.equal((db.prepare('SELECT COUNT(*) n FROM playback_task').get() as {n:number}).n,0);db.close();
  }finally{f.close();}
});

test('startup adopts one pre-migration Legacy active marker as uncertain and never replays it',()=>{
  const f=fixture();try{const db=sql(f.path);db.prepare('UPDATE requesttable SET nowplaying=? WHERE id=1').run('再生中');db.close();
    assert.equal(f.repo.recoverOnStartup('request.db'),1);const current=f.repo.current('request.db');assert.equal(current?.state,'uncertain');assert.equal(current?.requestId,1);
    const assignment=f.repo.claimNext('request.db',1,'new-agent');assert.equal(assignment.command,'stop');assert.equal(assignment.commandTaskId,current?.id);
    f.repo.report('request.db',String(current?.id),'new-agent',{state:'failed',playback:'stopped'});assert.equal(f.repo.readTask('request.db',String(current?.id))?.state,'failed');
  }finally{f.close();}
});

test('projection trigger failure rolls back task and event together; history excludes media path',()=>{
  const f=fixture();try{const task=f.repo.claimNext('request.db',1,'agent-a').task!;const db=sql(f.path);db.exec("CREATE TRIGGER fail_play BEFORE UPDATE OF nowplaying ON requesttable WHEN NEW.nowplaying='再生中' BEGIN SELECT RAISE(ABORT,'injected'); END;");db.close();
    assert.throws(()=>f.repo.report('request.db',task.id,'agent-a',{state:'playing',playback:'playing'}));
    assert.equal(f.repo.readTask('request.db',task.id)?.state,'claimed');const check=sql(f.path);assert.equal((check.prepare('SELECT COUNT(*) n FROM playback_event WHERE task_id=? AND event_type=\'playing\'').get(task.id) as {n:number}).n,0);check.close();
    const hist=JSON.stringify(f.repo.history('request.db',20,0));assert.equal(hist.includes('D:\\media'),false);
  }finally{f.close();}
});
