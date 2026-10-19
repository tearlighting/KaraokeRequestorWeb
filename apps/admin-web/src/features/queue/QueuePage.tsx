import { useCallback, useEffect, useState } from 'react';
import { message, type AdminClient, type QueueData } from '../../lib/admin';

export function QueuePage({ client }: { client: AdminClient }) {
  const [data, setData] = useState<QueueData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const reload = useCallback(async (clearError = true) => {
    try { setData(await client<QueueData>('queue')); if (clearError) setError(''); }
    catch (error) { setError(message(error)); }
  }, [client]);
  useEffect(() => { void reload(); }, [reload]);
  async function mutate(operation: string, id: number, action?: string) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const result = await client<{ message?: string }>(operation, { id: String(id), ...(action ? { action } : {}) });
      setNotice(result.message || '操作已由服务端处理，队列已重新查询。'); setDeleting(null);
    } catch (error) { setError(message(error)); }
    finally { await reload(false); setBusy(false); }
  }
  return <section className="panel"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">预约队列</h2><p className="mt-2 text-sm text-slate-500">{data?.total ?? '—'} 条记录 · 待播放 {data?.remaining_count ?? '—'}</p></div><button className="secondary" disabled={busy} onClick={() => void reload()}>刷新队列</button></div>
    <p className="mt-4 text-xs text-slate-500">按服务器返回顺序显示。上移/下移对应显示位置，不代表下一首播放。</p>
    {error && <p role="alert" className="error mt-4">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">{notice}</p>}
    <ul className="mt-4 divide-y divide-slate-100">{data?.items.map((item) => <li key={item.id} data-request-id={item.id} className="py-5">
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">位置 {item.position} · ID {item.id}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{item.nowplaying}</span></div>
      <h3 className="mt-2 break-all font-semibold">{item.songfile || item.display_name}</h3><p className="mt-1 break-all text-sm text-slate-500">{item.singer} · {item.kind}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button className="secondary" disabled={busy} onClick={() => void mutate('move', item.id, 'up')}>上移</button><button className="secondary" disabled={busy} onClick={() => void mutate('move', item.id, 'down')}>下移</button><button className="secondary" disabled={busy} onClick={() => void mutate('move', item.id, 'warikomi')}>下一首</button><button className="secondary text-red-700" disabled={busy} onClick={() => setDeleting(item.id)}>删除</button></div>
      {deleting === item.id && <div role="group" aria-label="删除确认" className="mt-3 rounded-xl bg-red-50 p-3 text-sm"><p>确认删除 ID {item.id} 的预约？</p><div className="mt-3 flex gap-2"><button className="primary bg-red-700" disabled={busy} onClick={() => void mutate('delete', item.id)}>确认删除</button><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>取消</button></div></div>}
    </li>)}</ul>{data?.items.length === 0 && <p className="py-8 text-slate-500">队列为空</p>}
  </section>;
}
