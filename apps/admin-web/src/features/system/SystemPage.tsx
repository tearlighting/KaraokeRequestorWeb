import { useCallback, useEffect, useState } from 'react';
import { message, type AdminClient, type PlayerAgentStatus, type SystemStatus } from '../../lib/admin';

export function SystemPage({ client }: { client: AdminClient }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [agent, setAgent] = useState<PlayerAgentStatus | null>(null);
  const [player, setPlayer] = useState('mpc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { try { setStatus(await client<SystemStatus>('status')); } catch (error) { setError(message(error)); } }, [client]);
  const loadAgent = useCallback(async () => { try { setAgent(await client<PlayerAgentStatus>('player-agent-status')); } catch (error) { setError(message(error)); } }, [client]);
  useEffect(() => { void load(); void loadAgent(); const timer = window.setInterval(() => void loadAgent(), 2500); return () => window.clearInterval(timer); }, [load, loadAgent]);
  async function control(action: string) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await client<{ message: string }>('player', { player, action }); setNotice(result.message); }
    catch (error) { setError(message(error)); }
    finally { await load(); setBusy(false); }
  }
  async function agentAction(operation: string, body?: Record<string, string>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await client<{ id?: string; taskId?: string; queued?: boolean }>(operation, body);
      setNotice(result.id ? `测试任务已提交：${result.id}` : '控制命令已排队；等待 Agent 的播放器状态回报。');
      await loadAgent();
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><section className="panel"><div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">系统状态</h2><button className="secondary" disabled={busy} onClick={() => void load()}>刷新状态</button></div>
    <dl className="mt-5 grid gap-4 sm:grid-cols-2">{status && Object.entries({ '运行环境': `${status.os} / PHP ${status.php_version}`, '播放模式': status.playmode, '检测到的播放器': status.detected_player, 'MPC-BE 接口': status.mpc_reachable ? '可达' : '不可达', 'foobar2000 接口': status.foobar_reachable ? '可达' : '不可达', '当前播放': status.playback?.playingtitle || '没有播放状态' }).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{key}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl></section>
    <section className="panel"><h2 className="text-xl font-bold">播放器控制</h2><p className="mt-2 text-sm text-slate-500">接口响应仅表示命令已收到，实际播放以刷新后的状态为准。不可达时会返回失败。</p>
      <label className="label mt-4" htmlFor="player">播放器</label><select id="player" value={player} onChange={(event) => setPlayer(event.target.value)} disabled={busy}><option value="mpc">MPC-BE</option><option value="foobar">foobar2000</option></select>
      <div className="mt-4 flex flex-wrap gap-3">{Object.entries({ play: '播放', pause: '暂停', playpause: '播放/暂停', stop: '停止' }).map(([action, label]) => <button key={action} className="secondary" disabled={busy || (player === 'foobar' && ['pause', 'stop'].includes(action))} onClick={() => void control(action)}>{label}</button>)}</div>
      {notice && <p role="status" className="mt-4 text-sm text-indigo-700">{notice}</p>}{error && <p role="alert" className="error mt-4">{error}</p>}
    </section>
    <section className="panel"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Windows Player Agent</h2><p className="mt-1 text-sm text-slate-500">本地测试视频闭环；状态来自 mpv JSON IPC。不会写预约播放标记或自动切歌。</p></div><span className={agent?.connected ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800' : 'rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600'}>{agent?.connected ? 'Agent 已连接' : 'Agent 未连接'}</span></div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">播放器实况</dt><dd className="mt-1 font-medium">{agent?.playback || '未知'}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">测试文件</dt><dd className="mt-1 break-all font-medium">{agent?.file || '未播放'}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">任务状态</dt><dd className="mt-1 font-medium">{agent?.task ? `${agent.task.state}${agent.task.error ? `：${agent.task.error}` : ''}` : '无任务'}</dd></div></dl>
      <div className="mt-4 flex flex-wrap gap-3"><button className="primary" disabled={busy || !agent?.connected || !agent.testReady || Boolean(agent?.task && ['pending','claimed','playing'].includes(agent.task.state))} onClick={() => void agentAction('player-agent-test')}>Start local test video</button><button className="secondary" disabled={busy || !agent?.connected || agent?.task?.state !== 'playing'} onClick={() => void agentAction('player-agent-control', { action: 'pause' })}>暂停</button><button className="secondary" disabled={busy || !agent?.connected || agent?.task?.state !== 'playing' || agent.playback !== 'paused'} onClick={() => void agentAction('player-agent-control', { action: 'resume' })}>继续</button><button className="secondary" disabled={busy || !agent?.connected || !agent?.task || !['claimed','playing'].includes(agent.task.state)} onClick={() => void agentAction('player-agent-control', { action: 'stop' })}>停止测试</button><button className="secondary" disabled={busy} onClick={() => void loadAgent()}>刷新 Agent 状态</button></div>
      {!agent?.connected && <p className="mt-3 text-sm text-amber-700">需要在 Windows 宿主机安装并启动 apps/player-agent；请查看该目录 README 的环境变量和安装步骤。</p>}
      {agent?.connected && !agent.testReady && <p className="mt-3 text-sm text-amber-700">Set PLAYER_TEST_VIDEO to a real file under PLAYER_MEDIA_ROOT and restart the host Agent before starting a test.</p>}
    </section></div>;
}
