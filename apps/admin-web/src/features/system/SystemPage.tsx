import { useCallback, useEffect, useState } from 'react';
import { message, type AdminClient, type MediaCheck, type PlaybackHistory, type PlayerAgentStatus, type SystemStatus } from '../../lib/admin';
import type { QueueData } from '../../lib/admin';

const mediaLabels: Record<string, string> = {
  playable: '可播放', path_unmapped: '路径未映射', file_missing: '文件不存在',
  invalid_path: '路径无效或越权', agent_offline: 'Agent 不在线', pending: '检查中', claimed: '检查中', timeout: '检查超时',
};

export function SystemPage({ client }: { client: AdminClient }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [agent, setAgent] = useState<PlayerAgentStatus | null>(null);
  const [history, setHistory] = useState<PlaybackHistory | null>(null);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [mediaChecks, setMediaChecks] = useState<Record<number, string>>({});
  const [player, setPlayer] = useState('mpc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { try { setStatus(await client<SystemStatus>('status')); } catch (cause) { setError(message(cause)); } }, [client]);
  const loadAgent = useCallback(async () => { try { setAgent(await client<PlayerAgentStatus>('player-agent-status')); } catch (cause) { setError(message(cause)); } }, [client]);
  const loadHistory = useCallback(async () => { try { setHistory(await client<PlaybackHistory>('playback-history')); } catch (cause) { setError(message(cause)); } }, [client]);
  const loadQueue = useCallback(async () => { try { setQueue(await client<QueueData>('queue')); } catch (cause) { setError(message(cause)); } }, [client]);
  useEffect(() => {
    void load(); void loadAgent(); void loadHistory(); void loadQueue();
    const timer = window.setInterval(() => { void loadAgent(); void loadHistory(); }, 2500);
    return () => window.clearInterval(timer);
  }, [load, loadAgent, loadHistory, loadQueue]);

  async function control(action: string) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await client<{ message: string }>('player', { player, action }); setNotice(result.message); }
    catch (cause) { setError(message(cause)); }
    finally { await load(); setBusy(false); }
  }
  async function agentAction(operation: string, body?: Record<string, string>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await client<{ id?: string; taskId?: string; queued?: boolean }>(operation, body);
      setNotice(result.id ? `任务已提交：${result.id}` : '控制命令已提交，等待 Agent 实际状态回报。');
      await Promise.all([loadAgent(), loadHistory()]);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  async function checkMedia(requestId: number) {
    setMediaChecks(value => ({ ...value, [requestId]: 'pending' }));
    try {
      let result = await client<MediaCheck>('media-check', { id: String(requestId) });
      if (result.state === 'pending' && result.id) {
        const checkId = result.id;
        for (let attempt = 0; attempt < 20 && result.state === 'pending'; attempt++) {
          await new Promise(resolve => window.setTimeout(resolve, 500));
          result = await client<MediaCheck>('media-check-result', { id: String(requestId), checkId });
        }
      }
      setMediaChecks(value => ({ ...value, [requestId]: result.state === 'pending' ? 'timeout' : result.state }));
    } catch (cause) { setMediaChecks(value => ({ ...value, [requestId]: message(cause) })); }
  }

  const taskActive = Boolean(agent?.task && ['pending', 'claimed', 'playing', 'uncertain'].includes(agent.task.state));
  const agentControls = agent?.connected === true;
  return <div className="space-y-5" aria-busy={!status && !agent && !error}>
    <section className="panel">
      <div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">系统状态</h2><button className="secondary" disabled={busy} onClick={() => void load()}>刷新状态</button></div>
      {!status && !error && <p role="status" className="mt-4 text-sm text-slate-500">正在读取 PHP 与播放器状态…</p>}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">{status && Object.entries({
        '运行环境': `${status.os} / PHP ${status.php_version}`, 'Legacy 播放模式': status.playmode,
        '检测到的播放器': status.detected_player, 'MPC-BE 接口': status.mpc_reachable ? '可达' : '不可达',
        'foobar2000 接口': status.foobar_reachable ? '可达' : '不可达', 'Legacy 当前播放': status.playback?.playingtitle || '没有播放状态',
      }).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{key}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl>
    </section>
    <section className="panel">
      <h2 className="text-xl font-bold">Legacy 播放器控制</h2>
      <p className="mt-2 text-sm text-slate-500">Fastify 接管队列期间 Legacy 控制会被拒绝。选择播放操作前，请确认播放器和队列归属。</p>
      <label className="label mt-4" htmlFor="player">播放器</label><select id="player" value={player} onChange={event => setPlayer(event.target.value)} disabled={busy}><option value="mpc">MPC-BE</option><option value="foobar">foobar2000</option></select>
      <div className="mt-4 flex flex-wrap gap-3">{Object.entries({ play: '播放', pause: '暂停', playpause: '播放/暂停', stop: '停止' }).map(([action, label]) => <button key={action} className="secondary" disabled={busy || agent?.nodeOwnsQueue || (player === 'foobar' && ['pause', 'stop'].includes(action))} onClick={() => void control(action)}>{label}</button>)}</div>
      {notice && <p role="status" className="mt-4 text-sm text-indigo-700">{notice}</p>}{error && <p role="alert" className="error mt-4">{error}</p>}
    </section>
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Windows Player Agent</h2><p className="mt-1 text-sm text-slate-500">正式任务由 Fastify 协调并写入 SQLite；Agent 只执行并回报 mpv 实际状态。</p></div><span className={agent?.connected ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800' : 'rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600'}>{agent?.connected ? 'Agent 已连接' : 'Agent 未连接'}</span></div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">播放器实况</dt><dd className="mt-1 font-medium">{agent?.playback || '未知'}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">当前媒体</dt><dd className="mt-1 break-all font-medium">{agent?.file || '未播放'}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">正式任务</dt><dd className="mt-1 font-medium">{agent?.task ? `预约 #${agent.task.requestId} · ${agent.task.state}${agent.task.error ? `：${agent.task.error}` : ''}` : '无任务'}</dd></div></dl>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="primary" disabled={busy || !agentControls || !agent?.testReady || agent.nodeOwnsQueue || agent.autoplayEnabled || taskActive} onClick={() => void agentAction('player-agent-test')}>Start local test video</button>
        {status?.playmode === 1 && <button className="primary" disabled={busy || !agentControls || !agent?.nodeAutoplayAvailable || agent.autoplayEnabled} onClick={() => void agentAction('player-agent-autoplay', { action: 'start' })}>启用顺序自动播放（Legacy 模式 1）</button>}
        {status?.playmode === 2 && <>
          <button className="primary" disabled={busy || !agentControls || !agent?.nodeAutoplayAvailable || agent.autoplayEnabled} onClick={() => void agentAction('player-agent-autoplay', { action: 'arm-manual' })}>接管并启用人工逐首启动（Legacy 模式 2）</button>
          <button className="primary" disabled={busy || !agentControls || !agent?.nodeAutoplayAvailable || !agent?.manualMode || taskActive} onClick={() => void agentAction('player-agent-autoplay', { action: 'start-next' })}>开始下一首预约</button>
        </>}
        {[3, 4, 5].includes(status?.playmode || 0) && <p className="basis-full text-sm text-amber-800">当前 Legacy 播放模式 {status?.playmode} 暂不由 Node 调度；此处不会修改原设置。</p>}
        <button className="secondary" disabled={busy || !agentControls || !agent?.autoplayEnabled || !agent.nodeAutoplayAvailable} onClick={() => void agentAction('player-agent-autoplay', { action: 'pause' })}>暂停预约</button>
        <button className="secondary" disabled={busy || !agentControls || !agent?.autoplayEnabled || agent.playback !== 'paused'} onClick={() => void agentAction('player-agent-autoplay', { action: 'resume' })}>继续预约</button>
        <button className="secondary" disabled={busy || !agentControls || !agent?.autoplayEnabled || agent?.task?.kind !== 'queue'} onClick={() => void agentAction('player-agent-autoplay', { action: 'skip' })}>跳过当前预约</button>
        <button className="secondary" disabled={busy || !agentControls || (!agent?.autoplayEnabled && !agent?.nodeOwnsQueue)} onClick={() => void agentAction('player-agent-autoplay', { action: 'stop' })}>停止队列接管</button>
        <button className="secondary" disabled={busy || !agentControls || agent?.task?.kind !== 'test' || !['claimed', 'playing'].includes(agent.task.state)} onClick={() => void agentAction('player-agent-control', { action: 'pause' })}>暂停测试</button>
        <button className="secondary" disabled={busy || !agentControls || agent?.task?.kind !== 'test' || agent.task.state !== 'playing' || agent.playback !== 'paused'} onClick={() => void agentAction('player-agent-control', { action: 'resume' })}>继续测试</button>
        <button className="secondary" disabled={busy || !agentControls || agent?.task?.kind !== 'test' || !agent.task || !['claimed', 'playing'].includes(agent.task.state)} onClick={() => void agentAction('player-agent-control', { action: 'stop' })}>停止测试</button>
        <button className="secondary" disabled={busy} onClick={() => void loadAgent()}>刷新 Agent 状态</button>
      </div>
      <p className="mt-3 text-sm text-slate-600">管理策略不修改 Legacy 的 playmode。模式 2 每首需管理员显式点击“开始下一首”；EOF 后等待下一次人工操作。模式 3 手动播放列表尚未迁移。正式自动播放开关当前由服务配置关闭。</p>
      {agent?.blockedReason && <p role="status" className="mt-3 text-sm text-amber-800">自动播放暂停：{agent.blockedReason}</p>}
      {!agent?.connected && <p className="mt-3 text-sm text-amber-700">请在 Windows 宿主机启动 apps/player-agent，详见目录 README。</p>}
      {agent?.connected && !agent.testReady && <p className="mt-3 text-sm text-amber-700">在 PLAYER_MEDIA_ROOT 下配置有效 PLAYER_TEST_VIDEO 后重启 Agent。</p>}
    </section>
    <section className="panel">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">预约媒体可用性</h2><p className="mt-1 text-sm text-slate-500">Agent 使用本地显式路径映射检查；页面不会显示或推测 Windows 路径。</p></div><button className="secondary" disabled={busy} onClick={() => void loadQueue()}>刷新预约</button></div>
      <div className="mt-3 divide-y">{queue?.items.map(item => <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={item.id}><span className="min-w-0 truncate">#{item.id} · {item.songfile}</span><div className="flex items-center gap-3"><span>{mediaLabels[mediaChecks[item.id] || (!agent?.connected ? 'agent_offline' : '')] || mediaChecks[item.id] || ''}</span><button className="secondary" disabled={busy || !agent?.connected || mediaChecks[item.id] === 'pending'} onClick={() => void checkMedia(item.id)}>检查媒体</button></div></div>)}{queue?.items.length === 0 && <p className="py-3 text-sm text-slate-500">预约队列为空</p>}</div>
    </section>
    <section className="panel"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">预约播放历史</h2><button className="secondary" disabled={busy} onClick={() => void loadHistory()}>刷新历史</button></div><div className="mt-3 divide-y">{history?.tasks.map(task => <div className="flex flex-wrap justify-between gap-2 py-3 text-sm" key={task.id}><span>预约 #{task.requestId} · {task.state}</span><span className="text-slate-500">{new Date(task.createdAt).toLocaleString()}</span></div>)}{history?.tasks.length === 0 && <p className="py-3 text-sm text-slate-500">暂无播放任务</p>}</div></section>
  </div>;
}
