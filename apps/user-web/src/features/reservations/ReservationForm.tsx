import { useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../lib/api';
import type { Song } from '../search/api';
import { reserve } from './api';

export function ReservationForm({ song, onClear, onCreated }: {
  song: Song | null; onClear: () => void; onCreated: (id: number) => void;
}) {
  const [singer, setSinger] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !singer.trim()) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const id = await reserve(song, singer, comment);
      setComment(''); onClear(); onCreated(id);
    } catch (error) { setError(errorMessage(error)); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className="panel" aria-labelledby="reservation-title">
    <h2 id="reservation-title" className="text-xl font-bold">{song ? '确认预约' : '预约一次休息'}</h2>
    {song ? <div className="mt-3 flex items-start justify-between gap-3"><p className="break-all text-sm">{song.name}</p>
      <button className="shrink-0 text-sm text-teal-700 underline" onClick={onClear} disabled={busy}>取消选择</button></div>
      : <p className="mt-2 text-sm text-slate-500">使用原系统的“小休止”类型加入队列，不会创建歌曲或启动播放器。</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><label htmlFor="singer" className="field-label">你的名字</label>
        <input id="singer" autoComplete="nickname" maxLength={256} required value={singer} onChange={(e) => setSinger(e.target.value)} disabled={busy} /></div>
      <div><label htmlFor="comment" className="field-label">备注（选填）</label>
        <textarea id="comment" rows={2} maxLength={512} value={comment} onChange={(e) => setComment(e.target.value)} disabled={busy} /></div>
      <button className="primary w-full" disabled={busy || !singer.trim()}>{busy ? '正在提交…' : song ? '提交歌曲预约' : '提交休息预约'}</button>
    </form>
    {error && <p role="alert" className="error mt-4">{error}</p>}
  </section>;
}
