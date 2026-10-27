import { openSync, closeSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

/** Removes an old lock only when Windows/Node confirms its recorded PID is gone. */
export function acquireInstanceLock(path:string,pid=process.pid,isAlive=(owner:number)=>{try{process.kill(owner,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}}){
  let fd:number;
  try{fd=openSync(path,'wx');}
  catch(error){
    let owner:number;
    try{const parsed=JSON.parse(readFileSync(path,'utf8')) as {pid?:unknown};if(!Number.isSafeInteger(parsed.pid)||Number(parsed.pid)<=0)throw new Error('invalid');owner=Number(parsed.pid);}
    catch{throw new Error('Player Agent lock exists but its owner cannot be verified; do not remove it manually until the process is checked');}
    try{if(isAlive(owner))throw new Error(`Player Agent is already running (PID ${owner})`);}
    catch(check){if(check instanceof Error&&check.message.startsWith('Player Agent is already running'))throw check;throw new Error(`Cannot confirm the old Player Agent exited (PID ${owner}); lock was preserved`);}
    try{unlinkSync(path);}catch{throw new Error('Stale Player Agent lock could not be removed safely');}
    try{fd=openSync(path,'wx');}catch{throw new Error('Player Agent lock changed during stale-lock recovery; another process may be starting');}
  }
  writeFileSync(fd,JSON.stringify({pid,startedAt:Date.now()}));
  let released=false;
  return ()=>{if(released)return;released=true;try{closeSync(fd);}catch{}try{const lock=JSON.parse(readFileSync(path,'utf8')) as {pid?:number};if(lock.pid===pid)unlinkSync(path);}catch{/* another owner or already removed */}};
}
