import { useEffect, useState } from 'react';
import { errorMessage, apiJson, record } from './lib/api';
import { SearchPanel } from './features/search/SearchPanel';
import type { Song } from './features/search/api';
import { ReservationForm } from './features/reservations/ReservationForm';
import { QueuePanel } from './features/queue/QueuePanel';

export function App() {
  const [song, setSong] = useState<Song | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState('正在检查曲库连接…');

  useEffect(() => {
    let active = true;
    void apiJson('/capabilities').then((value) => {
      const features = record(value.features);
      if (active) setConnection(`曲库连接：Everything ${features.everything_search ? '可用' : '未就绪'} · Lister ${features.lister_search ? '已配置（仍需有效曲库）' : '未配置'}。搜索结果以接口实际返回为准。`);
    }).catch((error) => { if (active) setConnection(errorMessage(error)); });
    return () => { active = false; };
  }, []);

  function onCreated(id: number) { setCreatedId(id); setRevision((value) => value + 1); }

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-[0.25em] text-teal-700">YUKARI / USER WEB</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">下一首，唱你的。</h1>
        <p className="mt-3 text-sm text-slate-500">搜索 · 预约 · 一起等待音乐开始</p></div>
      <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-800">连接原版 PHP</span>
    </header>
    <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{connection}</p>
    {createdId !== null && <p role="status" className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">预约已保存，ID {createdId}。队列正在重新查询；这不代表播放器已经开始播放。</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <SearchPanel onSelect={(selected) => { setSong(selected); setCreatedId(null); }} />
        <ReservationForm song={song} onClear={() => setSong(null)} onCreated={onCreated} />
      </div>
      <QueuePanel revision={revision} createdId={createdId} />
    </div>
    <footer className="mt-7 text-xs leading-relaxed text-slate-500">预约顺序和播放状态由服务端提供。真实播放需要主机播放器接入。</footer>
  </main>;
}
