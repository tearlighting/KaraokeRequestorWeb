import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { controlPlayer, getPlayerStatus } from './api';
import type { MpvLiveStatus, PublicPlayerStatus } from '../../../../../packages/contracts/src/index';

export function PlayerPage() {
  const t=useT();
  const [status,setStatus]=useState<PublicPlayerStatus|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [pendingId,setPendingId]=useState('');
  const [pendingPlaybackAction,setPendingPlaybackAction]=useState<'pause'|'resume'|''>('');
  const [seekDraft,setSeekDraft]=useState<number|null>(null);
  const [volumeDraft,setVolumeDraft]=useState<number|null>(null);
  const load=useCallback(async()=>{try{setStatus(await getPlayerStatus());setError('');}catch(cause){setError(errorMessage(cause));}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>{if(!document.hidden)void load();},1000);return()=>window.clearInterval(timer);},[load]);
  const live=status?.mpv;
  const canControl=Boolean(status?.connected&&status.active&&live?.connected&&['playing','paused'].includes(live.state));
  useEffect(()=>{if(!pendingId||live?.controlAck?.id!==pendingId)return;setPendingId('');if(live.controlAck.ok)setNotice(t('mpvControlApplied'));else setError(t('playerControlError',{error:live.controlAck.error||'unknown'}));},[pendingId,live?.controlAck,t]);
  useEffect(()=>{if(!pendingPlaybackAction||!live)return;const confirmed=(pendingPlaybackAction==='pause'&&live.state==='paused')||(pendingPlaybackAction==='resume'&&live.state==='playing');if(confirmed){setPendingPlaybackAction('');setNotice(t('mpvControlApplied'));}},[pendingPlaybackAction,live?.state,t]);
  useEffect(()=>{if(!pendingPlaybackAction)return;const timer=window.setTimeout(()=>{setPendingPlaybackAction('');setError(t('playerControlUnconfirmed'));},10000);return()=>window.clearTimeout(timer);},[pendingPlaybackAction,t]);

  async function send(input:Parameters<typeof controlPlayer>[0]){
    if(busy||pendingId||pendingPlaybackAction)return;setBusy(true);setError('');setNotice('');
    try{const result=await controlPlayer(input);setNotice(t('playerControlQueued'));if(result.id)setPendingId(result.id);if(input.action==='pause'||input.action==='resume')setPendingPlaybackAction(input.action);await load();}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  const duration=live?.duration??0,position=live?.position??0;
  const tracks=live?.audioTracks??[],subtitles=live?.subtitleTracks??[];
  return <section className="panel mt-5 space-y-5" data-testid="user-player-page" aria-busy={!status&&!error}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">PLAYER</p><h1 className="mt-1 text-2xl font-bold">{t('userPlayerRoute')}</h1><p className="mt-2 text-sm text-[var(--muted)]">{t('mpvStatusDescription')}</p></div>
      <span className={`status-pill ${canControl?'status-live':'status-idle'}`}><span className="status-dot"/>{status?.connected?t('playerConnected'):t('playerNotConnected')}</span></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {!status&&!error&&<p role="status">{t('loading')}</p>}
    {status&&<>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--border)] p-4"><p className="text-xs text-[var(--muted)]">mpv</p><strong>{live?.connected?stateLabel(live.state,t):t('mpvDisconnected')}</strong></div><div className="rounded-2xl border border-[var(--border)] p-4"><p className="text-xs text-[var(--muted)]">{t('mpvQueueTask')}</p><strong>{taskStateLabel(status.taskState,t)}</strong></div><div className="rounded-2xl border border-[var(--border)] p-4"><p className="text-xs text-[var(--muted)]">{t('mpvVolume')}</p><strong>{live?.volume===undefined?'—':`${Math.round(live.volume)}%`}{live?.muted?` · ${t('mpvMute')}`:''}</strong></div></div>
      {canControl&&live?<>
        <label className="block text-sm font-medium">{t('mpvSeek')} <span className="float-right tabular-nums">{formatTime(seekDraft??position)} / {formatTime(duration)}</span><input aria-label={t('mpvSeek')} className="mt-2 w-full accent-[var(--primary)]" type="range" min="0" max={Math.max(duration,0)} step="0.1" value={Math.min(seekDraft??position,duration)} disabled={duration<=0||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)} onChange={event=>setSeekDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(seekDraft!==null)void send({action:'seek',position:seekDraft});setSeekDraft(null);}} onKeyUp={()=>{if(seekDraft!==null)void send({action:'seek',position:seekDraft});setSeekDraft(null);}}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('mpvVolume')} {Math.round(volumeDraft??live.volume??0)}%<input aria-label={t('mpvVolume')} className="mt-2 accent-[var(--primary)]" type="range" min="0" max="130" step="1" value={volumeDraft??live.volume??0} disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)} onChange={event=>setVolumeDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(volumeDraft!==null)void send({action:'volume',value:volumeDraft});setVolumeDraft(null);}} onKeyUp={()=>{if(volumeDraft!==null)void send({action:'volume',value:volumeDraft});setVolumeDraft(null);}}/></label>
          <label className="flex items-center gap-2 self-end pb-2"><input aria-label={t('mpvMute')} className="!w-5" type="checkbox" checked={live.muted===true} disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)} onChange={event=>void send({action:'mute',value:event.currentTarget.checked})}/>{t('mpvMute')}</label>
          <label className="text-sm">{t('mpvAudioTrack')}<select aria-label={t('mpvAudioTrack')} className="mt-2" value={live.selectedAudioTrackId??''} disabled={tracks.length<2||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)} onChange={event=>void send({action:'audio-track',trackId:Number(event.currentTarget.value)})}>{tracks.length===0?<option value="">{t('mpvNoAudioTrack')}</option>:tracks.map(track=><option key={track.id} value={track.id}>{trackLabel(track)}</option>)}</select>{tracks.length<2&&<span className="mt-1 block text-xs text-[var(--muted)]">{tracks.length===0?t('mpvNoAudioTrack'):t('mpvNoAlternateAudio')}</span>}</label>
          <label className="text-sm">{t('mpvSubtitle')}<select aria-label={t('mpvSubtitle')} className="mt-2" value={live.selectedSubtitleTrackId??'off'} disabled={subtitles.length===0||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)} onChange={event=>void send({action:'subtitle-track',trackId:event.currentTarget.value==='off'?null:Number(event.currentTarget.value)})}>{subtitles.length===0?<option value="off">{t('mpvNoSubtitles')}</option>:<><option value="off">{t('mpvOff')}</option>{subtitles.map(track=><option key={track.id} value={track.id}>{trackLabel(track)}</option>)}</>}</select>{subtitles.length===0&&<span className="mt-1 block text-xs text-[var(--muted)]">{t('mpvNoSubtitleTracks')}</span>}</label>
        </div>
        <div className="flex flex-wrap gap-2"><Button disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.state==='paused'} onClick={()=>void send({action:'pause'})}>{t('pause')}</Button><Button tone="secondary" disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.state!=='paused'} onClick={()=>void send({action:'resume'})}>{t('resume')}</Button><Button tone="secondary" disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.fullscreen===undefined} onClick={()=>void send({action:'fullscreen',value:!live.fullscreen})}>{t('playerFullscreen')}: {live.fullscreen===undefined?t('playerFeatureUnavailable'):live.fullscreen?'ON':'OFF'}</Button></div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] p-4"><strong className="mr-2 text-sm">{t('playerKey')}: {live.keyChangeAvailable?`${(live.keySemitones??0)>0?'+':''}${live.keySemitones??0}`:t('playerFeatureUnavailable')}</strong><Button tone="secondary" disabled={!live.keyChangeAvailable||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||(live.keySemitones??0)<=-6} onClick={()=>void send({action:'key-change',semitones:(live.keySemitones??0)-1})}>{t('playerKeyDown')}</Button><Button tone="secondary" disabled={!live.keyChangeAvailable||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||(live.keySemitones??0)>=6} onClick={()=>void send({action:'key-change',semitones:(live.keySemitones??0)+1})}>{t('playerKeyUp')}</Button><Button tone="secondary" disabled={!live.keyChangeAvailable||busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||!live.keySemitones} onClick={()=>void send({action:'key-change',semitones:0})}>{t('playerKeyReset')}</Button></div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] p-4"><strong className="mr-2 text-sm">{t('playerAudioDelay')}: {live.audioDelay===undefined?t('playerFeatureUnavailable'):`${Math.round(live.audioDelay*1000)} ms`}</strong><Button tone="secondary" disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.audioDelay===undefined||live.audioDelay<=-10} onClick={()=>live.audioDelay!==undefined&&void send({action:'audio-delay',value:Math.max(-10,Number((live.audioDelay-0.1).toFixed(3)))})}>{t('playerDelayMinus')}</Button><Button tone="secondary" disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.audioDelay===undefined||live.audioDelay>=10} onClick={()=>live.audioDelay!==undefined&&void send({action:'audio-delay',value:Math.min(10,Number((live.audioDelay+0.1).toFixed(3)))})}>{t('playerDelayPlus')}</Button><Button tone="secondary" disabled={busy||Boolean(pendingId)||Boolean(pendingPlaybackAction)||live.audioDelay===undefined||live.audioDelay===0} onClick={()=>void send({action:'audio-delay',value:0})}>{t('playerDelayReset')}</Button></div>
      </>:<p role="status" className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t('playerQueueOnly')}</p>}
    </>}
    {notice&&<p role="status" className="success-banner">{notice}</p>}{(pendingId||pendingPlaybackAction)&&<p role="status" className="text-sm text-[var(--muted)]">{t('mpvWaitingAck')}</p>}
  </section>;
}

function stateLabel(state:MpvLiveStatus['state'],t:(key:import('../../../../../packages/language/messages').MessageKey)=>string){if(state==='playing')return t('mpvPlaying');if(state==='paused')return t('mpvPaused');if(state==='idle'||state==='stopped')return t('mpvIdle');return t('mpvUnavailable');}
function trackLabel(track:MpvLiveStatus['audioTracks'][number]){return track.title||track.language||track.codec||`Track ${track.id}`;}
function taskStateLabel(state:PublicPlayerStatus['taskState'],t:(key:import('../../../../../packages/language/messages').MessageKey)=>string){if(state==='pending')return t('playerTaskPending');if(state==='claimed')return t('playerTaskClaimed');if(state==='playing')return t('playerTaskPlaying');if(state==='uncertain')return t('playerTaskUncertain');return t('mpvNoActiveTask');}
function formatTime(value:number){if(!Number.isFinite(value)||value<0)return '0:00';const seconds=Math.floor(value);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
