import { randomUUID } from 'node:crypto';
import { BoundaryError } from './errors.js';

export interface AgentSearchItem { name: string; path: string; size: number }
interface Job { id: string; keyword: string; userId: string; state: 'pending'|'claimed'; agentId?: string; createdAt: number; settle: (value: { items: Array<{ name:string; fullpath:string; artist:string; size:number }>; total:number })=>void; reject: (error: Error)=>void; timer: ReturnType<typeof setTimeout> }
interface MediaRef { path: string; userId: string; expiresAt: number }

/** Bounded, short-lived handoff between browser requests and the outbound-only Windows Agent. */
export class AgentSearchCoordinator {
  private jobs = new Map<string, Job>();
  private media = new Map<string, MediaRef>();
  private health: 'not_checked'|'connected_no_media'|'connected_media_found'|'unavailable' = 'not_checked';
  private lastError: string | undefined;
  private lastCheckedAt = 0;
  constructor(private clock = () => Date.now(), private maxJobs = 4, private ttlMs = 8000) {}
  status() { this.expire(); return { everything: this.health, lastError: this.lastError, lastCheckedAt: this.lastCheckedAt || null }; }
  create(keyword: string, userId: string) {
    this.expire();
    if (this.jobs.size >= this.maxJobs) throw new BoundaryError(503,'SEARCH_BUSY','Windows media search is busy; retry shortly');
    const id=randomUUID();
    return new Promise<{items:Array<{name:string;fullpath:string;artist:string;size:number}>;total:number}>((resolve,reject)=>{
      const timer=setTimeout(()=>{const job=this.jobs.get(id);if(job){this.jobs.delete(id);reject(new BoundaryError(504,'SEARCH_TIMEOUT','Windows Media Agent did not return search results in time'));}},this.ttlMs);
      this.jobs.set(id,{id,keyword,userId,state:'pending',createdAt:this.clock(),settle:resolve,reject,timer});
    });
  }
  claim(agentId:string, searchReady:boolean) {
    this.expire(); if(!searchReady)return null; const job=[...this.jobs.values()].find(value=>value.state==='pending');
    if(!job)return null; job.state='claimed';job.agentId=agentId;return {id:job.id,keyword:job.keyword};
  }
  complete(id:string,agentId:string,items:AgentSearchItem[],health:'connected_no_media'|'connected_media_found'|'unavailable',error?:string) {
    this.expire();const job=this.jobs.get(id);
    if(!job||job.state!=='claimed'||job.agentId!==agentId)throw new BoundaryError(409,'STALE_SEARCH_JOB','Search request expired or was already completed');
    this.jobs.delete(id);clearTimeout(job.timer);this.health=health;this.lastCheckedAt=this.clock();this.lastError=error;
    if(health==='unavailable') { job.reject(new BoundaryError(503,'EVERYTHING_UNAVAILABLE',error==='EVERYTHING_AUTH_FAILED'?'Everything HTTP authentication failed':'Everything HTTP Server is unavailable'));return {accepted:true}; }
    const bounded=items.slice(0,50).map(item=>{
      if(this.media.size>=2000){const oldest=this.media.keys().next().value as string|undefined;if(oldest)this.media.delete(oldest);}
      const ref=randomUUID();this.media.set(ref,{path:item.path,userId:job.userId,expiresAt:this.clock()+30*60_000});
      return {name:item.name,fullpath:`media:${ref}`,artist:'',size:item.size};
    });
    job.settle({items:bounded,total:bounded.length});return {accepted:true};
  }
  resolveSelection(userId:string,value:string) {
    this.expire();
    if(!value.startsWith('media:'))return value;
    const ref=this.media.get(value.slice(6));
    if(!ref||ref.userId!==userId)throw new BoundaryError(404,'MEDIA_SELECTION_EXPIRED','This search result expired; search again before reserving');
    return ref.path;
  }
  private expire(){const now=this.clock();for(const [id,job]of this.jobs)if(now-job.createdAt>this.ttlMs){clearTimeout(job.timer);this.jobs.delete(id);job.reject(new BoundaryError(504,'SEARCH_TIMEOUT','Windows Media Agent did not return search results in time'));}for(const [id,ref]of this.media)if(ref.expiresAt<=now)this.media.delete(id);}
}
