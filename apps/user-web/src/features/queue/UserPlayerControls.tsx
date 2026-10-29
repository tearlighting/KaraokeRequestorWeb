import { useEffect, useRef, useState } from 'react';
import type { PublicPlayerStatus } from '../../../../../packages/contracts/src/index';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { controlUserPlayer, getPlayerStatus, type UserPlayerControl } from './api';

export function UserPlayerControls(){
  const [status,setStatus]=useState<PublicPlayerStatus|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [seekDraft,setSeekDraft]=useState<number|null>(null);
  const [volumeDraft,setVolumeDraft]=useState<number|null>(null);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;let pending=false;const refresh=async()=>{if(pending)return;pending=true;try{const next=await getPlayerStatus();if(alive.current){setStatus(next);setError('');}}catch(cause){if(alive.current)setError(errorMessage(cause));}finally{pending=false;}};void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},1200);const onVisible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',onVisible);return()=>{alive.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};},[]);
  const mpv=status?.mpv;
  const active=Boolean(status?.active&&status.connected&&mpv?.connected&&['playing','paused'].includes(mpv.state));
  const locked=busy||!active;
  async function command(input:UserPlayerControl){if(busy||!active)return;setBusy(true);setError('');setNotice('');try{const result=await controlUserPlayer(input);setNotice(`${label(input.action)}をプレイヤーへ送信しました${result.queued?'。状態を確認しています。':'。'}`);}catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}}
  const tracks=mpv?.audioTracks||[];const subtitles=mpv?.subtitleTracks||[];const duration=mpv?.duration||0;
  return <section className="panel user-player-controls" data-testid="user-player-controls" aria-label="プレイヤー操作">
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">PLAYER CONTROLS</p><h2 className="text-xl font-bold">再生中の曲を操作</h2></div><span className={`status-pill ${active?'status-live':'status-idle'}`}>{!status?'確認中…':!status.connected?'Agent 未接続':!mpv?.connected?'mpv 未接続':active?mpv.state==='paused'?'一時停止中':'再生中':'操作できる曲がありません'}</span></div>
    {error&&<p role="alert" className="error mt-3">{error}</p>}
    {mpv?.connected&&active?<div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2"><Button disabled={locked||mpv.state==='paused'} onClick={()=>void command({action:'pause'})}>一時停止</Button><Button tone="secondary" disabled={locked||mpv.state!=='paused'} onClick={()=>void command({action:'resume'})}>再生</Button><Button tone="secondary" disabled={locked||mpv.fullscreen===undefined} onClick={()=>void command({action:'fullscreen',value:!mpv.fullscreen})}>全画面 {mpv.fullscreen?'OFF':'ON'}</Button></div>
      <label className="block text-sm">再生位置 <span className="float-right tabular-nums">{time(seekDraft??mpv.position??0)} / {time(duration)}</span><input aria-label="再生位置" className="mt-2 w-full accent-teal-600" type="range" min="0" max={Math.max(duration,0)} step="0.1" value={Math.min(seekDraft??mpv.position??0,duration)} disabled={locked||duration<=0} onChange={event=>setSeekDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(seekDraft!==null)void command({action:'seek',position:seekDraft});setSeekDraft(null);}} onKeyUp={()=>{if(seekDraft!==null)void command({action:'seek',position:seekDraft});setSeekDraft(null);}}/></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">音量 {Math.round(volumeDraft??mpv.volume??0)}%<input aria-label="音量" className="mt-2 w-full accent-teal-600" type="range" min="0" max="130" step="1" value={volumeDraft??mpv.volume??0} disabled={locked} onChange={event=>setVolumeDraft(Number(event.currentTarget.value))} onPointerUp={()=>{if(volumeDraft!==null)void command({action:'volume',value:volumeDraft});setVolumeDraft(null);}} onKeyUp={()=>{if(volumeDraft!==null)void command({action:'volume',value:volumeDraft});setVolumeDraft(null);}}/></label>
        <label className="flex items-center gap-2 self-center"><input aria-label="ミュート" type="checkbox" checked={mpv.muted===true} disabled={locked} onChange={event=>void command({action:'mute',value:event.currentTarget.checked})}/>ミュート</label>
        <label className="block text-sm">音声トラック<select aria-label="音声トラック" className="mt-2 w-full" value={mpv.selectedAudioTrackId??''} disabled={locked||tracks.length<2} onChange={event=>void command({action:'audio-track',trackId:Number(event.currentTarget.value)})}>{tracks.length===0?<option value="">音声トラックなし</option>:tracks.map(track=><option key={track.id} value={track.id}>{track.title||track.language||track.codec||`Track ${track.id}`}{track.selected?'（現在）':''}</option>)}</select>{tracks.length<2&&<span className="mt-1 block text-xs text-[var(--muted)]">{tracks.length?'切り替えられる音声はありません':'音声情報はありません'}</span>}</label>
        <label className="block text-sm">字幕<select aria-label="字幕" className="mt-2 w-full" value={mpv.selectedSubtitleTrackId??'off'} disabled={locked||subtitles.length===0} onChange={event=>void command({action:'subtitle-track',trackId:event.currentTarget.value==='off'?null:Number(event.currentTarget.value)})}>{subtitles.length===0?<option value="off">字幕なし</option>:<><option value="off">字幕を切る</option>{subtitles.map(track=><option key={track.id} value={track.id}>{track.title||track.language||track.codec||`Track ${track.id}`}{track.selected?'（現在）':''}</option>)}</>}</select></label>
        <div className="flex flex-wrap items-center gap-2"><span>音声遅延 {mpv.audioDelay===undefined?'—':`${Math.round(mpv.audioDelay*1000)} ms`}</span><Button tone="secondary" disabled={locked||mpv.audioDelay===undefined||(mpv.audioDelay??0)<=-10} onClick={()=>void command({action:'audio-delay',value:Math.max(-10,Number(((mpv.audioDelay??0)-0.1).toFixed(3)))})}>−100 ms</Button><Button tone="secondary" disabled={locked||mpv.audioDelay===undefined||(mpv.audioDelay??0)>=10} onClick={()=>void command({action:'audio-delay',value:Math.min(10,Number(((mpv.audioDelay??0)+0.1).toFixed(3)))})}>＋100 ms</Button><Button tone="secondary" disabled={locked||mpv.audioDelay===undefined||mpv.audioDelay===0} onClick={()=>void command({action:'audio-delay',value:0})}>戻す</Button></div>
        <div className="flex items-center gap-2"><span>キー {mpv?.keyChangeAvailable?`${(mpv.keySemitones??0)>0?'+':''}${mpv.keySemitones??0}`:'未対応'}</span><Button tone="secondary" disabled={locked||!mpv?.keyChangeAvailable||(mpv.keySemitones??0)<=-6} onClick={()=>void command({action:'key-change',semitones:(mpv?.keySemitones??0)-1})}>−</Button><Button tone="secondary" disabled={locked||!mpv?.keyChangeAvailable||(mpv.keySemitones??0)>=6} onClick={()=>void command({action:'key-change',semitones:(mpv?.keySemitones??0)+1})}>＋</Button><Button tone="secondary" disabled={locked||!mpv?.keyChangeAvailable||!mpv.keySemitones} onClick={()=>void command({action:'key-change',semitones:0})}>戻す</Button></div>
      </div>
    </div>:<p className="mt-4 text-sm text-[var(--muted)]">曲が再生され、Agent と mpv が接続すると、音量・シーク・音声トラックなどを操作できます。</p>}
    {notice&&<p role="status" className="success-banner mt-3">{notice}</p>}
    <p className="mt-3 text-xs text-[var(--muted)]">操作は現在再生中の曲だけに適用されます。キューの開始・停止・スキップや並べ替えは管理者が行います。</p>
  </section>;
}
function time(value:number){if(!Number.isFinite(value)||value<0)return '0:00';const seconds=Math.floor(value);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function label(action:UserPlayerControl['action']){return ({pause:'一時停止',resume:'再生',seek:'シーク',volume:'音量',mute:'ミュート', 'audio-track':'音声トラック','subtitle-track':'字幕','audio-delay':'音声遅延','key-change':'キー変更',fullscreen:'全画面'} as const)[action];}
