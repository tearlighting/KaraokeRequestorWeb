import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { getPlayback, getQueue, type Playback, type Queue } from './api';

export function QueuePanel({ revision, createdId }: { revision: number; createdId: number | null }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [queueError, setQueueError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState('');
  const alive = useRef(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    const results = await Promise.allSettled([getQueue(), getPlayback()]);
    if (alive.current) {
      const [q, p] = results;
      if (q.status === 'fulfilled') { setQueue(q.value); setQueueError(''); setUpdated(new Date().toLocaleTimeString()); }
      else setQueueError(errorMessage(q.reason));
      if (p.status === 'fulfilled') { setPlayback(p.value); setPlaybackError(''); }
      else setPlaybackError(errorMessage(p.reason));
      setBusy(false);
    }
    inFlight.current = false;
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  useEffect(() => { void refresh(); }, [revision, refresh]);

  return <section className="panel" aria-labelledby="queue-title">
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="queue-title" className="text-xl font-bold">预约队列</h2>
        <p className="mt-2 text-sm text-slate-500">{queue ? `${queue.total} 条记录 · ${queue.remaining} 条待播放` : '正在连接队列…'}</p></div>
      <button className="secondary shrink-0" onClick={() => void refresh()} disabled={busy}>{busy ? '更新中…' : '刷新队列'}</button>
    </div>
    <div className="mt-5 rounded-xl bg-teal-50 p-4" aria-live="polite">
      <p className="text-xs font-semibold tracking-wider text-teal-800">当前播放 · 服务端状态</p>
      {playbackError ? <p className="mt-2 text-sm text-red-800">播放状态获取失败：{playbackError}</p>
        : <p className="mt-2 font-medium">{playback?.playing ? `${playback.title || '播放中'} · ${playback.singer}（状态 ${playback.status}）` : playback ? '当前没有播放状态，播放器可能未启动' : '正在查询…'}</p>}
    </div>
    {queueError && <p role="alert" className="error mt-4">队列刷新失败，下面可能是旧数据：{queueError}</p>}
    <p className="mt-4 text-xs text-slate-500">按服务器返回顺序显示，位置与播放状态由 PHP 决定。每 5 秒查询。{updated && ` 最近更新 ${updated}`}</p>
    <ul className="mt-3 divide-y divide-slate-100" data-testid="queue">
      {queue?.items.map((item) => <li key={item.id} data-request-id={item.id} className={`py-4 ${createdId === item.id ? 'rounded-lg bg-teal-50 px-3' : ''}`}>
        <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">位置 {item.position} · ID {item.id}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{item.nowplaying}</span></div>
        <p className="mt-2 break-words font-semibold">{item.display_name}</p>
        <p className="mt-1 break-words text-sm text-slate-600">{item.singer} · {item.kind}</p>
      </li>)}
    </ul>
    {queue?.items.length === 0 && <p className="mt-5 text-sm text-slate-500">队列暂时为空，来预约第一首吧。</p>}
  </section>;
}
