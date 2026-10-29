import { useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { errorMessage } from '../../lib/api';
import { getPlayback, type Playback } from './api';
import { formatMediaTitle } from '../search/formatMediaTitle';
import { StatusTag } from '../../../../../packages/web-foundation/src/StatusTag';

export function NowPlayingCard({ compact = false, onlyWhenPlaying = false }: { compact?: boolean; onlyWhenPlaying?: boolean }) {
  const t=useT(); const [playback,setPlayback]=useState<Playback|null>(null); const [error,setError]=useState('');
  useEffect(()=>{let alive=true;const refresh=async()=>{try{const value=await getPlayback();if(alive){setPlayback(value);setError('');}}catch(cause){if(alive)setError(errorMessage(cause));}};void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},5000);return()=>{alive=false;window.clearInterval(timer);};},[]);
  if (onlyWhenPlaying && !playback?.playing) return null;
  return <section className={`now-playing${compact ? ' now-playing-compact' : ''}`} aria-label={t('nowPlaying')} aria-busy={!playback&&!error}><div className="now-playing-top"><span className="music-mark" aria-hidden="true">♫</span><StatusTag status={playback?.playing?'playing':error?'unknown':'queued'}>{error?t('offline'):playback?.playing?t('statusPlaying'):t('statusWaiting')}</StatusTag></div>
    {error?<p role="alert" className="mt-4 text-sm text-rose-200">{t('playbackStatusUnavailable',{error})}</p>:playback?<div className="mt-3"><h2 className="now-playing-title">{playback.playing?formatMediaTitle(playback.title)||t('mediaTitleUnavailable'):t('statusWaiting')}</h2><p className="mt-1 text-sm text-slate-300">{playback.playing?playback.singer||t('noSingerInfo'):t('playbackStartsHint')}</p></div>:<p role="status" className="mt-4 text-sm text-slate-300">{t('loading')}</p>}
    <p className="mt-3 text-xs text-slate-400">{t('updatedEvery5Seconds')}</p></section>;
}
