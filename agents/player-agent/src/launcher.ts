import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireInstanceLock } from './instance-lock.js';
import { loadAgentConfig } from './config.js';

type Status='starting'|'running'|'stopping'|'stopped'|'error';
type ErrorCode='AGENT_CONFIG_INVALID'|'AGENT_PROCESS_UNVERIFIED'|'AGENT_START_FAILED'|'AGENT_STOP_FAILED'|'LAUNCHER_RUNTIME_ERROR';
type Action={id:string;action:'start'|'stop'};
type Poll={command:Action|null;agentConnected:boolean;taskActive:boolean};
const config=loadAgentConfig();
if(config.token.length<32)throw new Error('Player Agent credential is unavailable');
const launcherId=`launcher_${config.id}`;
const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const agentEntry=resolve(dirname(fileURLToPath(import.meta.url)),'main.js');
const logRoot=config.logDir;
const logFile=join(logRoot,'launcher.log');
mkdirSync(logRoot,{recursive:true});
const writeLog=(message:string)=>{try{appendFileSync(logFile,`${new Date().toISOString()} ${message}\n`,{encoding:'utf8',mode:0o600});}catch{/* status still reports a fixed error code */}};
const releaseLock=acquireInstanceLock(join(config.lockDir,'launcher.lock'));
let child:ChildProcess|null=null;
let childExited=false;
let state:Status='stopped';
let errorCode:ErrorCode|undefined;
let actionId='';
let stopSent=false;
let stopDeadline=0;
let stoppingAfterTask=false;
let closing=false;
const headers={Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'};

async function poll():Promise<Poll>{
  const response=await fetch(`${config.apiUrl}/api/v1/agent/launcher/poll`,{method:'POST',headers,body:JSON.stringify({launcherId,state,...(errorCode?{error:errorCode}:{})}),signal:AbortSignal.timeout(5000)});
  const value=await response.json() as {ok?:boolean;data?:Poll;error?:{code?:string}};
  if(!response.ok||value.ok!==true||!value.data)throw new Error(value.error?.code||'API_UNAVAILABLE');
  return value.data;
}
function processAlive(pid:number){try{process.kill(pid,0);return true;}catch(error){const code=(error as NodeJS.ErrnoException).code;if(code==='ESRCH')return false;return true;}}
function removeConfirmedStaleLock(){
  const agentLock=join(config.lockDir,'agent.lock');
  if(!existsSync(agentLock))return;
  let pid:number;
  try{const parsed=JSON.parse(readFileSync(agentLock,'utf8')) as {pid?:unknown};if(!Number.isSafeInteger(parsed.pid)||Number(parsed.pid)<=0)throw new Error();pid=Number(parsed.pid);}
  catch{throw Object.assign(new Error('Agent lock cannot be verified; it was preserved'),{code:'AGENT_PROCESS_UNVERIFIED'});}
  if(processAlive(pid))throw Object.assign(new Error('An Agent process owns the lock but is not authenticated to Fastify; refusing a second instance'),{code:'AGENT_PROCESS_UNVERIFIED'});
  try{unlinkSync(agentLock);}catch{throw Object.assign(new Error('Confirmed stale Agent lock could not be removed'),{code:'AGENT_PROCESS_UNVERIFIED'});}
}
function startAgent(){
  if(child&&!childExited)return;
  if(!existsSync(agentEntry))throw Object.assign(new Error('Built Agent entry is missing'),{code:'AGENT_START_FAILED'});
  removeConfirmedStaleLock();
  const out=join(logRoot,'agent.stdout.log'),err=join(logRoot,'agent.stderr.log');
  const outFd=(awaitlessOpen(out));const errFd=(awaitlessOpen(err));
  try{
    child=spawn(process.execPath,[agentEntry],{cwd:repoRoot,windowsHide:true,detached:true,shell:false,stdio:['ignore',outFd,errFd]});
    childExited=false;child.unref();
    child.once('error',()=>{childExited=true;state='error';errorCode='AGENT_START_FAILED';writeLog('AGENT_START_FAILED');});
    child.once('exit',(code)=>{childExited=true;child=null;if(state!=='stopping'){state='error';errorCode='AGENT_START_FAILED';writeLog(`AGENT_EXIT_${code??'unknown'}`);}});
    state='starting';errorCode=undefined;writeLog('AGENT_START_REQUESTED');
  }finally{closeFd(outFd);closeFd(errFd);}
}
// Keep log handling explicit and avoid shell redirection or command strings.
const awaitlessOpen=(path:string)=>openSync(path,'a',0o600);
const closeFd=(fd:number)=>{try{closeSync(fd);}catch{}};
function stopAgentPipe(){
  return new Promise<void>((resolvePromise,reject)=>{
    if(process.platform!=='win32'){reject(new Error('Named pipe control is available only on Windows'));return;}
    const pipe=`\\\\.\\pipe\\yukari-agent-${config.id}`;
    const socket=createConnection(pipe);const timeout=setTimeout(()=>{socket.destroy();reject(new Error('Agent stop pipe timed out'));},3000);
    socket.once('connect',()=>socket.end('stop'));
    socket.once('close',()=>{clearTimeout(timeout);resolvePromise();});
    socket.once('error',error=>{clearTimeout(timeout);reject(error);});
  });
}
function setError(error:unknown,fallback:ErrorCode){const code=error&&typeof error==='object'&&'code'in error?String((error as {code:unknown}).code):'';errorCode=(['AGENT_CONFIG_INVALID','AGENT_PROCESS_UNVERIFIED','AGENT_START_FAILED','AGENT_STOP_FAILED','LAUNCHER_RUNTIME_ERROR'] as string[]).includes(code)?code as ErrorCode:fallback;state='error';writeLog(errorCode);}
async function runAction(command:Action|null,snapshot:Poll){
  if(!command)return;
  if(command.id!==actionId){actionId=command.id;stopSent=false;stopDeadline=0;stoppingAfterTask=false;errorCode=undefined;state=command.action==='start'?'stopped':'stopping';}
  if(command.action==='start'){
    if(snapshot.agentConnected){state='running';errorCode=undefined;return;}
    if(child&&!childExited){state='starting';return;}
    if(state==='error'&&actionId===command.id)return;
    try{startAgent();}catch(error){setError(error,'AGENT_START_FAILED');}
    return;
  }
  state='stopping';
  if(snapshot.taskActive){stoppingAfterTask=true;return;}
  if(!stopSent&&snapshot.agentConnected){try{await stopAgentPipe();stopSent=true;stopDeadline=Date.now()+25000;stoppingAfterTask=false;}catch(error){setError(error,'AGENT_STOP_FAILED');return;}}
  if(child&&!childExited){
    if(stopSent&&Date.now()>stopDeadline){setError(new Error('Agent did not exit after graceful stop'),'AGENT_STOP_FAILED');return;}
    return;
  }
  // Fastify keeps the last Agent heartbeat live for 15 seconds after shutdown;
  // wait beyond that TTL before deciding that the process failed to exit.
  if(snapshot.agentConnected){if(!stopDeadline)stopDeadline=Date.now()+25000;if(Date.now()>stopDeadline)setError(new Error('Agent connection did not close'),'AGENT_STOP_FAILED');return;}
  state='stopped';errorCode=undefined;stopSent=false;stoppingAfterTask=false;
}
process.on('SIGINT',()=>{closing=true;});
process.on('SIGTERM',()=>{closing=true;});
writeLog('LAUNCHER_STARTED');
while(!closing){
  try{const snapshot=await poll();await runAction(snapshot.command,snapshot);}
  catch{writeLog('API_UNAVAILABLE');if(!child||childExited)state='stopped';}
  await new Promise(resolvePromise=>setTimeout(resolvePromise,1500));
}
releaseLock();
