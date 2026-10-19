import { useCallback, useEffect, useState } from 'react';
import { message, type AdminClient, type SystemStatus } from '../../lib/admin';

export function SystemPage({ client }: { client: AdminClient }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [player, setPlayer] = useState('mpc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { try { setStatus(await client<SystemStatus>('status')); } catch (error) { setError(message(error)); } }, [client]);
  useEffect(() => { void load(); }, [load]);
  async function control(action: string) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await client<{ message: string }>('player', { player, action }); setNotice(result.message); }
    catch (error) { setError(message(error)); }
    finally { await load(); setBusy(false); }
  }
  return <div className="space-y-5"><section className="panel"><div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">系统状态</h2><button className="secondary" disabled={busy} onClick={() => void load()}>刷新状态</button></div>
    <dl className="mt-5 grid gap-4 sm:grid-cols-2">{status && Object.entries({ '运行环境': `${status.os} / PHP ${status.php_version}`, '播放模式': status.playmode, '检测到的播放器': status.detected_player, 'MPC-BE 接口': status.mpc_reachable ? '可达' : '不可达', 'foobar2000 接口': status.foobar_reachable ? '可达' : '不可达', '当前播放': status.playback?.playingtitle || '没有播放状态' }).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{key}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl></section>
    <section className="panel"><h2 className="text-xl font-bold">播放器控制</h2><p className="mt-2 text-sm text-slate-500">接口响应仅表示命令已收到，实际播放以刷新后的状态为准。不可达时会返回失败。</p>
      <label className="label mt-4" htmlFor="player">播放器</label><select id="player" value={player} onChange={(event) => setPlayer(event.target.value)} disabled={busy}><option value="mpc">MPC-BE</option><option value="foobar">foobar2000</option></select>
      <div className="mt-4 flex flex-wrap gap-3">{Object.entries({ play: '播放', pause: '暂停', playpause: '播放/暂停', stop: '停止' }).map(([action, label]) => <button key={action} className="secondary" disabled={busy || (player === 'foobar' && ['pause', 'stop'].includes(action))} onClick={() => void control(action)}>{label}</button>)}</div>
      {notice && <p role="status" className="mt-4 text-sm text-indigo-700">{notice}</p>}{error && <p role="alert" className="error mt-4">{error}</p>}
    </section></div>;
}
