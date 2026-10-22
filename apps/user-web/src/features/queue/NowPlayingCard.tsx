import { useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { errorMessage } from '../../lib/api';
import { getPlayback, type Playback } from './api';

export function NowPlayingCard() {
  const t=useT(); const [playback,setPlayback]=useState<Playback|null>(null); const [error,setError]=useState('');
  useEffect(()=>{let alive=true;const refresh=async()=>{try{const value=await getPlayback();if(alive){setPlayback(value);setError('');}}catch(cause){if(alive)setError(errorMessage(cause));}};void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},5000);return()=>{alive=false;window.clearInterval(timer);};},[]);
  return <section className="now-playing" aria-label={t('nowPlaying')} aria-busy={!playback&&!error}><div className="flex items-center justify-between gap-3"><p className="eyebrow text-teal-200">NOW PLAYING · {t('nowPlaying')}</p><span className={`status-pill ${playback?.playing?'status-live':'status-idle'}`}><span aria-hidden="true" className="status-dot"/>{error?t('offline'):playback?.playing?'再生中':t('waiting')}</span></div>
    {error?<p role="alert" className="mt-4 max-w-3xl text-sm text-rose-200">再生状態を取得できませんでした: {error}</p>:playback?<div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{playback.playing?playback.title||'曲名を取得できません':t('waiting')}</h2><p className="mt-2 text-sm text-slate-300">{playback.playing?playback.singer||'予約者情報なし':'曲の再生が始まると、ここに表示されます。'}</p></div>{playback.status&&<span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">{playback.status}</span>}</div>:<p role="status" className="mt-4 text-sm text-slate-300">{t('loading')}</p>}
    <p className="mt-4 text-xs text-slate-400">5 秒ごとにサーバーの再生状態を確認します。</p></section>;
}
