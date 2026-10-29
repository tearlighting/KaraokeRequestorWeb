import { useEffect, useRef, useState } from 'react';
import type { PublicPlayerStatus } from '../../../../../packages/contracts/src/index';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';
import { StatusTag, type StatusKind } from '../../../../../packages/web-foundation/src/StatusTag';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { controlUserPlayer, getPlayerStatus, type UserPlayerControl } from './api';

export function UserPlayerControls() {
  const t = useT();
  const [status, setStatus] = useState<PublicPlayerStatus | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try { const next = await getPlayerStatus(); if (alive.current) { setStatus(next); setError(''); } }
      catch (cause) { if (alive.current) setError(errorMessage(cause)); }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 1200);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const mpv = status?.mpv;
  const active = Boolean(status?.active && status.connected && mpv?.connected && ['playing', 'paused'].includes(mpv.state));
  const locked = busy || !active;
  async function command(input: UserPlayerControl) {
    if (busy || !active) return;
    setBusy(true); setError(''); setNotice('');
    try { const result = await controlUserPlayer(input); setNotice(result.queued ? t('playerControlQueued') : t('mpvControlApplied')); }
    catch (cause) { setError(t('playerControlError', { error: errorMessage(cause) })); }
    finally { setBusy(false); }
  }

  const tracks = mpv?.audioTracks || [];
  const subtitles = mpv?.subtitleTracks || [];
  const duration = mpv?.duration || 0;
  const state: StatusKind = !status ? 'unknown' : !status.connected || !mpv?.connected ? 'failed' : !active ? 'unknown' : mpv.state === 'paused' ? 'paused' : 'playing';
  const stateLabel = !status ? t('checkingStatus') : !status.connected ? t('statusAgentOffline') : !mpv?.connected ? t('statusMpvOffline') : !active ? t('statusNoControllableSong') : mpv.state === 'paused' ? t('statusPaused') : t('statusPlaying');
  const trackName = (track: { title?: string; language?: string; codec?: string; selected?: boolean; id: number }) => `${track.title || track.language || track.codec || t('trackNumber', { id: track.id })}${track.selected ? ` (${t('mpvCurrent')})` : ''}`;

  return <section className="user-player-controls" data-testid="user-player-controls" aria-label={t('playerControls')}>
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">PLAYER</p><h2 className="text-xl font-bold">{t('playingTrackControls')}</h2></div><StatusTag status={state}>{stateLabel}</StatusTag></div>
    {error && <p role="alert" className="error mt-3">{error}</p>}
    {mpv?.connected && active ? <div className="mt-4 space-y-4">
      <div className="player-primary-actions"><Button aria-label={t('pause')} disabled={locked || mpv.state === 'paused'} onClick={() => void command({ action: 'pause' })}><Icon name="paused" size={20} />{t('pause')}</Button><Button aria-label={t('resume')} tone="secondary" disabled={locked || mpv.state !== 'paused'} onClick={() => void command({ action: 'resume' })}><Icon name="playing" size={20} />{t('resume')}</Button><Button className="player-fullscreen-action" tone="secondary" disabled={locked || mpv.fullscreen === undefined} onClick={() => void command({ action: 'fullscreen', value: !mpv.fullscreen })}>{t('fullscreen')} {mpv.fullscreen ? t('fullscreenOff') : t('fullscreenOn')}</Button></div>
      <label className="block text-sm">{t('seekPosition')} <span className="float-right tabular-nums">{time(seekDraft ?? mpv.position ?? 0)} / {time(duration)}</span><input aria-label={t('seekPosition')} className="mt-2 w-full player-range" type="range" min="0" max={Math.max(duration, 0)} step="0.1" value={Math.min(seekDraft ?? mpv.position ?? 0, duration)} disabled={locked || duration <= 0} onChange={event => setSeekDraft(Number(event.currentTarget.value))} onPointerUp={() => { if (seekDraft !== null) void command({ action: 'seek', position: seekDraft }); setSeekDraft(null); }} onKeyUp={() => { if (seekDraft !== null) void command({ action: 'seek', position: seekDraft }); setSeekDraft(null); }} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">{t('volume')} {Math.round(volumeDraft ?? mpv.volume ?? 0)}%<input aria-label={t('volume')} className="mt-2 w-full player-range" type="range" min="0" max="130" step="1" value={volumeDraft ?? mpv.volume ?? 0} disabled={locked} onChange={event => setVolumeDraft(Number(event.currentTarget.value))} onPointerUp={() => { if (volumeDraft !== null) void command({ action: 'volume', value: volumeDraft }); setVolumeDraft(null); }} onKeyUp={() => { if (volumeDraft !== null) void command({ action: 'volume', value: volumeDraft }); setVolumeDraft(null); }} /></label>
        <label className="flex items-center gap-2 self-center"><input aria-label={t('mute')} type="checkbox" checked={mpv.muted === true} disabled={locked} onChange={event => void command({ action: 'mute', value: event.currentTarget.checked })} />{t('mute')}</label>
        <label className="block text-sm">{t('audioTrack')}<select aria-label={t('audioTrack')} className="mt-2 w-full" value={mpv.selectedAudioTrackId ?? ''} disabled={locked || tracks.length < 2} onChange={event => void command({ action: 'audio-track', trackId: Number(event.currentTarget.value) })}>{tracks.length === 0 ? <option value="">{t('audioTrackNone')}</option> : tracks.map(track => <option key={track.id} value={track.id}>{trackName(track)}</option>)}</select>{tracks.length < 2 && <span className="mt-1 block text-xs text-[var(--muted)]">{tracks.length ? t('audioNoSwitch') : t('audioInfoMissing')}</span>}</label>
        <label className="block text-sm">{t('subtitleTrack')}<select aria-label={t('subtitleTrack')} className="mt-2 w-full" value={mpv.selectedSubtitleTrackId ?? 'off'} disabled={locked || subtitles.length === 0} onChange={event => void command({ action: 'subtitle-track', trackId: event.currentTarget.value === 'off' ? null : Number(event.currentTarget.value) })}>{subtitles.length === 0 ? <option value="off">{t('subtitleNone')}</option> : <><option value="off">{t('subtitleOff')}</option>{subtitles.map(track => <option key={track.id} value={track.id}>{trackName(track)}</option>)}</>}</select></label>
        <div className="flex flex-wrap items-center gap-2"><span>{t('audioDelay')} {mpv.audioDelay === undefined ? '-' : `${Math.round(mpv.audioDelay * 1000)} ms`}</span><Button tone="secondary" aria-label={t('playerDelayMinus')} disabled={locked || mpv.audioDelay === undefined || (mpv.audioDelay ?? 0) <= -10} onClick={() => void command({ action: 'audio-delay', value: Math.max(-10, Number(((mpv.audioDelay ?? 0) - 0.1).toFixed(3))) })}>-100 ms</Button><Button tone="secondary" aria-label={t('playerDelayPlus')} disabled={locked || mpv.audioDelay === undefined || (mpv.audioDelay ?? 0) >= 10} onClick={() => void command({ action: 'audio-delay', value: Math.min(10, Number(((mpv.audioDelay ?? 0) + 0.1).toFixed(3))) })}>+100 ms</Button><Button tone="secondary" aria-label={t('playerDelayReset')} disabled={locked || mpv.audioDelay === undefined || mpv.audioDelay === 0} onClick={() => void command({ action: 'audio-delay', value: 0 })}>{t('reset')}</Button></div>
        <div className="flex items-center gap-2"><span>{t('keyAdjustment')} {mpv.keyChangeAvailable ? `${(mpv.keySemitones ?? 0) > 0 ? '+' : ''}${mpv.keySemitones ?? 0}` : t('unsupported')}</span><Button tone="secondary" aria-label={t('playerKeyDown')} disabled={locked || !mpv.keyChangeAvailable || (mpv.keySemitones ?? 0) <= -6} onClick={() => void command({ action: 'key-change', semitones: (mpv.keySemitones ?? 0) - 1 })}>-</Button><Button tone="secondary" aria-label={t('playerKeyUp')} disabled={locked || !mpv.keyChangeAvailable || (mpv.keySemitones ?? 0) >= 6} onClick={() => void command({ action: 'key-change', semitones: (mpv.keySemitones ?? 0) + 1 })}>+</Button><Button tone="secondary" aria-label={t('playerKeyReset')} disabled={locked || !mpv.keyChangeAvailable || !mpv.keySemitones} onClick={() => void command({ action: 'key-change', semitones: 0 })}>{t('reset')}</Button></div>
      </div>
    </div> : <p className="mt-4 text-sm text-[var(--muted)]">{t('noActivePlayerSong')}</p>}
    {notice && <p role="status" className="success-banner mt-3">{notice}</p>}
    <p className="mt-3 text-xs text-[var(--muted)]">{t('playerScopeNote')}</p>
  </section>;
}

function time(value: number) { if (!Number.isFinite(value) || value < 0) return '0:00'; const seconds = Math.floor(value); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
