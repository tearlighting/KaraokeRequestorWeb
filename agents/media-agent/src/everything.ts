import { basename, win32 } from 'node:path';
import { MediaPathResolver } from './media-path.js';

const VIDEO_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.webm','.m4v','.mpeg','.mpg']);
export interface EverythingResult { name: string; path: string; size: number }
export type EverythingHealth = 'connected_no_media'|'connected_media_found'|'unavailable';
export interface EverythingOutcome { items: EverythingResult[]; health: EverythingHealth; error?: string }

/** Calls only the configured Everything HTTP endpoint; no shell, browser, or arbitrary URL input. */
export async function searchEverything(keyword:string, endpoint:string, paths:MediaPathResolver, options:{username?:string;password?:string;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EverythingOutcome>{
  let url:URL;
  try { url=new URL(endpoint); } catch { return {items:[],health:'unavailable',error:'EVERYTHING_CONFIG_INVALID'}; }
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash) return {items:[],health:'unavailable',error:'EVERYTHING_CONFIG_INVALID'};
  const params=new URLSearchParams({search:`${keyword} ext:mp4;mkv;avi;mov;wmv;webm;m4v;mpeg;mpg`,json:'1',count:'50',offset:'0',path_column:'1',size_column:'1',sort:'name',ascending:'1'});
  url.search=params.toString();
  const headers:Record<string,string>={Accept:'application/json'};
  if(options.username||options.password)headers.Authorization=`Basic ${Buffer.from(`${options.username||''}:${options.password||''}`).toString('base64')}`;
  try {
    const response=await (options.fetcher||fetch)(url,{headers,signal:AbortSignal.timeout(options.timeoutMs??4000),redirect:'error'});
    if(response.status===401||response.status===403)return {items:[],health:'unavailable',error:'EVERYTHING_AUTH_FAILED'};
    if(!response.ok)return {items:[],health:'unavailable',error:'EVERYTHING_HTTP_ERROR'};
    const text=await response.text();if(text.length>2_000_000)return {items:[],health:'unavailable',error:'EVERYTHING_RESPONSE_TOO_LARGE'};
    let data:unknown;try{data=JSON.parse(text);}catch{return {items:[],health:'unavailable',error:'EVERYTHING_INVALID_JSON'};}
    if(!data||typeof data!=='object'||!Array.isArray((data as {results?:unknown}).results))return {items:[],health:'unavailable',error:'EVERYTHING_INVALID_JSON'};
    const results=(data as {results:unknown[]}).results;const items:EverythingResult[]=[];
    if(results.some(raw=>!raw||typeof raw!=='object'||typeof (raw as Record<string,unknown>).name!=='string'||typeof (raw as Record<string,unknown>).path!=='string'||!Number.isFinite(Number((raw as Record<string,unknown>).size))))return {items:[],health:'unavailable',error:'EVERYTHING_INVALID_JSON'};
    for(const raw of results){
      if(!raw||typeof raw!=='object')continue;const row=raw as Record<string,unknown>;
      if(typeof row.name!=='string'||typeof row.path!=='string'||!Number.isFinite(Number(row.size)))continue;
      const full=win32.join(row.path,row.name);if(!VIDEO_EXT.has(win32.extname(row.name).toLowerCase()))continue;
      try{const verified=paths.resolveQueueFile(full);items.push({name:basename(verified),path:verified,size:Math.max(0,Number(row.size))});}catch{/* Anything outside the selected root or unresolved is intentionally omitted. */}
      if(items.length>=50)break;
    }
    return {items,health:items.length?'connected_media_found':'connected_no_media'};
  }catch(error){return {items:[],health:'unavailable',error:error instanceof Error&&error.name==='TimeoutError'?'EVERYTHING_TIMEOUT':'EVERYTHING_UNREACHABLE'};}
}
