import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type MpvLiveStatus, type PlayerAgentStatus, type QueueData, type SystemStatus } from '../../lib/admin';
import { StatusTag, type StatusKind } from '../../../../../packages/web-foundation/src/StatusTag';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';

interface MpvSnapshot { connected: boolean; agentId?: string; mpv?: MpvLiveStatus; playback: PlayerAgentStatus['playback']; task?: PlayerAgentStatus['task']; controlAck?: { id: string; ok: boolean; error?: string } }

export function PlaybackConsole({client,queue}:{client:AdminClient;queue:QueueData|null}){
  const t=useT();
  const[status,setStatus]=useState<SystemStatus|null>(null);
  const[agent,setAgent]=useState<PlayerAgentStatus|null>(null);
  const[mpv,setMpv]=useState<MpvSnapshot|null>(null);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[seekDraft,setSeekDraft]=useState<number|null>(null);
  const[volumeDraft,setVolumeDraft]=useState<number|null>(null);
  const[pendingControl,setPendingControl]=useState('');

  const load=useCallback(async()=>{
    const results=await Promise.allSettled([client<SystemStatus>('status'),client<PlayerAgentStatus>('player-agent-status')]);
    if(results[0].status==='fulfilled')setStatus(results[0].value);
    if(results[1].status==='fulfilled')setAgent(results[1].value);
    const failed=results.find(item=>item.status==='rejected');
    setError(failed?.status==='rejected'?message(failed.reason):'');
  },[client]);
  const loadMpv=useCallback(async()=>{try{setMpv(await client<MpvSnapshot>('mpv-status'));}catch(cause){setError(message(cause));}},[client]);

  useEffect(()=>{
    void load();void loadMpv();
    const slow=window.setInterval(()=>{if(!document.hidden)void load();},3500);
    const live=window.setInterval(()=>{if(!document.hidden)void loadMpv();},1000);
    return()=>{window.clearInterval(slow);window.clearInterval(live);};
  },[load,loadMpv]);

  useEffect(()=>{
    const ack=mpv?.controlAck;
    if(!pendingControl||ack?.id!==pendingControl)return;
    setPendingControl('');
    if(ack.ok)setNotice(t('mpvControlApplied'));
    else setError(t('mpvControlFailed',{error:ack.error||'unknown error'}));
  },[mpv?.controlAck,pendingControl]);

  async function command(operation:string,action:string,confirmText?:string){
    if(confirmText&&!window.confirm(confirmText))return;
    setBusy(true);setError('');setNotice('');
    try{await client(operation,{action});setNotice(t('mpvControlQueued'));await Promise.all([load(),loadMpv()]);}
    catch(cause){setError(message(cause));}
    finally{setBusy(false);}
  }

  async function mpvControl(body:Record<string,unknown>){
    if(busy||pendingControl)return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await client<{id:string}>('mpv-control',{taskId:activeTaskId,...body});
      setPendingControl(result.id);setNotice(t('mpvControlQueued'));
    }catch(cause){setError(message(cause));}
    finally{setBusy(false);}
  }

  const connected=agent?.connected===true;
  const active=Boolean(agent?.task&&['pending','claimed','playing','uncertain'].includes(agent.task.state));
  const next=queue?.items.find(item=>item.nowplaying==='未再生');
  const modeName=status?.playmode===1?t('mode1'):status?.playmode===2?t('mode2'):`Legacy mode ${status?.playmode??'—'}`;
  const live=mpv?.mpv;
  const task=agent?.task||mpv?.task;
  const testTask=task?.kind==='test';
  const activeTaskId=task&&['claimed','playing'].includes(task.state)?task.id:'';
  const canControl=Boolean(connected&&live?.connected&&['playing','paused'].includes(live.state)&&activeTaskId);
  const currentPosition=live?.position??0;
  const duration=live?.duration??0;
  const tracks=live?.audioTracks??[];
  const subtitles=live?.subtitleTracks??[];

  return <section data-testid="admin-playback-console" className="console-panel" aria-label={t('playbackControl')}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow text-teal-200">PLAYBACK CONTROL</p><h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">{t('playbackControl')}</h2></div>
      <StatusTag className={`agent-badge ${connected?'agent-online':'agent-offline'}`} status={connected?'playing':'unknown'}>{connected?t('agentConnected'):t('agentOffline')}</StatusTag>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <div className="console-stat"><p>{t('mpvQueueTask')}</p><strong>{task?.kind==='queue'&&task.requestId?`${t('requestLabel')} #${task.requestId}`:task?.kind==='test'?t('mpvLocalTest'):t('mpvNoActiveTask')}</strong><p className="mt-1 text-xs"><StatusTag status={taskStatusKind(task?.state)}>{taskStatusLabel(task?.state,t)}</StatusTag></p></div>
      <div className="console-stat"><p>{t('mpvIpc')}</p><strong><StatusTag status={!connected||!live?.connected?'unknown':live.state==='paused'?'paused':live.state==='playing'?'playing':'stopped'}>{!connected?t('agentOffline'):!live?.connected?t('mpvDisconnected'):mpvStateLabel(live.state,t)}</StatusTag></strong><p className="mt-1 truncate text-xs">{live?.file||(!live?.connected?live?.error:t('mpvNoMedia'))||t('mpvNoMedia')}</p></div>
      <div className="console-stat"><p>{t('nextRequest')}</p><strong className="truncate">{next?`${next.display_name} · ${next.singer}`:t('noQueuedRequest')}</strong><p className="mt-1 text-xs">{t('configuredMode')}: {modeName}</p></div>
    </div>

    {live?.connected&&['playing','paused'].includes(live.state)&&<div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4" aria-label={t('mpvLiveControls')}>
      <div className="flex items-center justify-between gap-3"><strong className="truncate text-white">{live.file||t('mpvNoMedia')}</strong><span className="text-xs text-slate-300 inline-flex items-center gap-2"><StatusTag status={live.state==='paused'?'paused':live.state==='playing'?'playing':'stopped'}>{mpvStateLabel(live.state,t)}</StatusTag>{activeTaskId?`${t('taskIdLabel')} ${activeTaskId.slice(0,8)}`:t('mpvNoActiveTask')}</span></div>
      <label className="block text-sm text-slate-200">{t('mpvSeek')} <span className="float-right tabular-nums">{formatTime(seekDraft??currentPosition)} / {formatTime(duration)}</span>
        <input aria-label={t('mpvSeek')} className="mt-2 w-full accent-teal-400" type="range" min="0" max={Math.max(duration,0)} step="0.1" value={Math.min(seekDraft??currentPosition,duration)} disabled={!canControl||duration<=0||busy||Boolean(pendingControl)} onChange={event=>setSeekDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(seekDraft!==null)void mpvControl({action:'seek',position:seekDraft});setSeekDraft(null);}} onKeyUp={()=>{if(seekDraft!==null)void mpvControl({action:'seek',position:seekDraft});setSeekDraft(null);}}/>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-200">{t('mpvVolume')} {Math.round(volumeDraft??live.volume??0)}%
          <input aria-label={t('mpvVolume')} className="mt-2 w-full accent-teal-400" type="range" min="0" max="130" step="1" value={volumeDraft??live.volume??0} disabled={!canControl||busy||Boolean(pendingControl)} onChange={event=>setVolumeDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(volumeDraft!==null)void mpvControl({action:'volume',value:volumeDraft});setVolumeDraft(null);}} onKeyUp={()=>{if(volumeDraft!==null)void mpvControl({action:'volume',value:volumeDraft});setVolumeDraft(null);}}/>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-200"><input aria-label={t('mpvMute')} type="checkbox" checked={live.muted===true} disabled={!canControl||busy||Boolean(pendingControl)} onChange={event=>void mpvControl({action:'mute',value:event.currentTarget.checked})}/>{t('mpvMute')}</label>
        <label className="text-sm text-slate-200">{t('mpvAudioTrack')}
          <select aria-label={t('mpvAudioTrack')} className="mt-2 w-full rounded-lg bg-slate-900 p-2 text-white" value={live.selectedAudioTrackId??''} disabled={!canControl||tracks.length<2||busy||Boolean(pendingControl)} onChange={event=>void mpvControl({action:'audio-track',trackId:Number(event.currentTarget.value)})}>
            {tracks.length===0?<option value="">{t('mpvNoAudioTrack')}</option>:tracks.map(track=><option key={track.id} value={track.id}>{track.title||track.language||track.codec||`Track ${track.id}`}{track.selected?` (${t('mpvCurrent')})`:''}</option>)}
          </select>
          {tracks.length<2&&<span className="mt-1 block text-xs text-slate-400">{tracks.length===0?t('mpvNoAudioTrack'):t('mpvNoAlternateAudio')}</span>}
        </label>
        <label className="text-sm text-slate-200">{t('mpvSubtitle')}
          <select aria-label={t('mpvSubtitle')} className="mt-2 w-full rounded-lg bg-slate-900 p-2 text-white" value={live.selectedSubtitleTrackId??'off'} disabled={!canControl||subtitles.length===0||busy||Boolean(pendingControl)} onChange={event=>void mpvControl({action:'subtitle-track',trackId:event.currentTarget.value==='off'?null:Number(event.currentTarget.value)})}>
            {subtitles.length===0?<option value="off">{t('mpvNoSubtitles')}</option>:<><option value="off">{t('mpvOff')}</option>{subtitles.map(track=><option key={track.id} value={track.id}>{track.title||track.language||track.codec||`Track ${track.id}`}{track.selected?` (${t('mpvCurrent')})`:''}</option>)}</>}
          </select>
          {subtitles.length===0&&<span className="mt-1 block text-xs text-slate-400">{t('mpvNoSubtitleTracks')}</span>}
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200"><strong className="mr-2">{t('playerKey')}: {live.keyChangeAvailable?`${(live.keySemitones??0)>0?'+':''}${live.keySemitones??0}`:t('playerFeatureUnavailable')}</strong><Button tone="secondary" disabled={!canControl||!live.keyChangeAvailable||busy||Boolean(pendingControl)||(live.keySemitones??0)<=-6} onClick={()=>void mpvControl({action:'key-change',semitones:(live.keySemitones??0)-1})}>{t('playerKeyDown')}</Button><Button tone="secondary" disabled={!canControl||!live.keyChangeAvailable||busy||Boolean(pendingControl)||(live.keySemitones??0)>=6} onClick={()=>void mpvControl({action:'key-change',semitones:(live.keySemitones??0)+1})}>{t('playerKeyUp')}</Button><Button tone="secondary" disabled={!canControl||!live.keyChangeAvailable||busy||Boolean(pendingControl)||!live.keySemitones} onClick={()=>void mpvControl({action:'key-change',semitones:0})}>{t('playerKeyReset')}</Button></div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200"><strong className="mr-2">{t('playerAudioDelay')}: {live.audioDelay===undefined?t('playerFeatureUnavailable'):Math.round(live.audioDelay*1000)+' ms'}</strong><Button tone="secondary" disabled={!canControl||busy||Boolean(pendingControl)||live.audioDelay===undefined||(live.audioDelay??0)<=-10} onClick={()=>void mpvControl({action:'audio-delay',value:Math.max(-10,Number(((live.audioDelay??0)-0.1).toFixed(3)))})}>{t('playerDelayMinus')}</Button><Button tone="secondary" disabled={!canControl||busy||Boolean(pendingControl)||live.audioDelay===undefined||(live.audioDelay??0)>=10} onClick={()=>void mpvControl({action:'audio-delay',value:Math.min(10,Number(((live.audioDelay??0)+0.1).toFixed(3)))})}>{t('playerDelayPlus')}</Button><Button tone="secondary" disabled={!canControl||busy||Boolean(pendingControl)||live.audioDelay===undefined||(live.audioDelay??0)===0} onClick={()=>void mpvControl({action:'audio-delay',value:0})}>{t('playerDelayReset')}</Button></div>
      </div>
      {(!live.audioTracks.length||!live.subtitleTracks.length)&&<p className="text-xs text-slate-400">{t('mpvTrackAvailabilityHint')}</p>}
    </div>}

    <div className="mt-4 flex flex-wrap gap-2">
      {status?.playmode===1&&<Button data-testid="autoplay-start" disabled={busy||!connected||!agent?.nodeAutoplayAvailable||agent.autoplayEnabled} onClick={()=>void command('player-agent-autoplay','start',t('playbackStartConfirm'))}>{t('autoplayStart')}</Button>}
      {status?.playmode===2&&!agent?.manualMode&&<Button disabled={busy||!connected||!agent?.nodeAutoplayAvailable} onClick={()=>void command('player-agent-autoplay','arm-manual',t('manualModeConfirm'))}>{t('manualEnable')}</Button>}
      {status?.playmode===2&&agent?.manualMode&&<Button disabled={busy||!connected||active} onClick={()=>void command('player-agent-autoplay','start-next')}>{t('startNext')}</Button>}
      <Button tone="secondary" className="inline-flex items-center gap-2" disabled={busy||!canControl||live?.state==='paused'} onClick={()=>void command(testTask?'player-agent-control':'player-agent-autoplay','pause')}><Icon name="paused" size={17}/>{t('pause')}</Button><Button tone="secondary" className="inline-flex items-center gap-2" disabled={busy||!canControl||live?.state!=='paused'} onClick={()=>void command(testTask?'player-agent-control':'player-agent-autoplay','resume')}><Icon name="playing" size={17}/>{t('resume')}</Button>
      <Button tone="secondary" disabled={busy||!canControl||Boolean(pendingControl)||live?.fullscreen===undefined} onClick={()=>void mpvControl({action:'fullscreen',value:!live?.fullscreen})}>{t('playerFullscreen')}: {live?.fullscreen===undefined?t('playerFeatureUnavailable'):live.fullscreen?'ON':'OFF'}</Button>
      <Button tone="secondary" disabled={busy||!connected||agent?.task?.kind!=='queue'} onClick={()=>void command('player-agent-autoplay','skip',t('skipConfirm'))}>{t('skip')}</Button>
      {task?.kind==='test'?<Button tone="danger" disabled={busy||!connected||!active} onClick={()=>void command('player-agent-control','stop',t('stopTestConfirm'))}>{t('autoplayStop')}</Button>:<Button data-testid="autoplay-stop" tone="danger" disabled={busy||!connected||(!agent?.autoplayEnabled&&!agent?.nodeOwnsQueue)} onClick={()=>void command('player-agent-autoplay','stop',t('autoplayStopConfirm'))}>{t('autoplayStop')}</Button>}
    </div>
    <p className="mt-3 text-xs text-slate-300">{t('mpvStatusDescription')} {t('mpvPitchInfo')}</p>
    {agent?.autoplayUnavailableReason&&<p role="status" className="mt-2 text-sm text-amber-200">{agent.autoplayUnavailableReason}</p>}
    {agent?.task&&<p className="mt-2 text-sm text-slate-200">Task #{agent.task.requestId??'test'} · {agent.task.state}{agent.task.error?` · ${agent.task.error}`:''}</p>}
    {agent?.blockedReason&&<p role="status" className="mt-2 text-sm text-amber-200">{t('autoplayBlocked',{reason:agent.blockedReason})}</p>}
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-950/50 p-3 text-sm text-red-100">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-sm text-emerald-200">{notice}</p>}
    {pendingControl&&<p role="status" className="mt-2 text-xs text-amber-100">{t('mpvWaitingAck')}</p>}
    <Button tone="secondary" className="mt-4 text-xs underline" onClick={()=>void Promise.all([load(),loadMpv()])} disabled={busy}>{t('statusRefresh')}</Button>
  </section>;
}

function formatTime(value:number){if(!Number.isFinite(value)||value<0)return '0:00';const seconds=Math.floor(value);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function mpvStateLabel(state:MpvLiveStatus['state'],t:(key:import('../../../../../packages/language/messages').MessageKey)=>string){if(state==='playing')return t('mpvPlaying');if(state==='paused')return t('mpvPaused');if(state==='idle'||state==='stopped')return t('mpvIdle');return t('mpvUnavailable');}

function taskStatusKind(state?:string):StatusKind { if(state==='playing')return 'playing';if(state==='uncertain')return 'uncertain';if(state==='failed')return 'failed';if(state==='completed')return 'completed';if(state==='stopped')return 'stopped';if(state==='pending'||state==='claimed')return 'queued';return 'unknown';}
function taskStatusLabel(state:string|undefined,t:(key:import('../../../../../packages/language/messages').MessageKey)=>string){switch(state){case'pending':return t('playerTaskPending');case'claimed':return t('playerTaskClaimed');case'playing':return t('playerTaskPlaying');case'uncertain':return t('playerTaskUncertain');case'failed':return t('statusFailed');case'completed':return t('statusCompleted');case'stopped':return t('statusStopped');default:return t('statusUnknown');}}
