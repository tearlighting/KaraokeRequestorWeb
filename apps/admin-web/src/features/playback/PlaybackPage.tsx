import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button, EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type QueueData } from '../../lib/admin';
import { PlaybackConsole } from '../queue/PlaybackConsole';

export function PlaybackPage({client}:{client:AdminClient}){
  const t=useT();
  const [queue,setQueue]=useState<QueueData|null>(null);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    try{setQueue(await client<QueueData>('queue'));setError('');}
    catch(cause){setError(message(cause));}
  },[client]);
  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>{if(!document.hidden)void load();},5000);
    return()=>window.clearInterval(timer);
  },[load]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">PLAYER</p><h2 className="text-2xl font-bold">{t('playbackRoute')}</h2><p className="mt-2 text-sm text-slate-500">mpv の実測状態と Agent の接続状態を別々に表示します。</p></div>
      <Button tone="secondary" onClick={()=>void load()}>{t('refresh')}</Button>
    </div>
    {error&&<p role="alert" className="error">{error}</p>}
    {!queue&&!error&&<p role="status" className="panel">{t('loading')}</p>}
    <PlaybackConsole client={client} queue={queue}/>
    {queue&&queue.remaining_count===0&&<EmptyState>予約キューに未再生の曲はありません。</EmptyState>}
  </div>;
}
