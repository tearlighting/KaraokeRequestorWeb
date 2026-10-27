import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button, EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type PlaybackHistory, type PlayerAgentStatus, type SystemStatus } from '../../lib/admin';

export function SystemPage({ client }: { client: AdminClient }) {
  const t=useT(); const [status,setStatus]=useState<SystemStatus|null>(null); const [history,setHistory]=useState<PlaybackHistory|null>(null); const [agent,setAgent]=useState<PlayerAgentStatus|null>(null);
  const [legacyPlayer,setLegacyPlayer]=useState('mpc'); const [operationBusy,setOperationBusy]=useState(false); const [operationNotice,setOperationNotice]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setBusy(true);setError('');const results=await Promise.allSettled([client<SystemStatus>('status'),client<PlaybackHistory>('playback-history'),client<PlayerAgentStatus>('player-agent-status')]);if(results[0].status==='fulfilled')setStatus(results[0].value);if(results[1].status==='fulfilled')setHistory(results[1].value);if(results[2].status==='fulfilled')setAgent(results[2].value);const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')setError(message(failed.reason));setBusy(false);},[client]);
  async function run(operation:string,body?:Record<string,string>,confirmText?:string){if(confirmText&&!window.confirm(confirmText))return;setOperationBusy(true);setError('');setOperationNotice('');try{const result=await client<{message?:string;id?:string;action?:string}>(operation,body);const action=operation==='player-agent-launcher'?body?.action:undefined;setOperationNotice(action==='start'?'起動要求を受け付けました。接続状態は下の実測表示で確認できます。':action==='stop'?'停止要求を受け付けました。タスクの安全な停止と Agent 終了を待っています。':result.message||(result.id?'テストタスクを作成しました。':'操作を受け付けました。'));await load();}catch(cause){setError(message(cause));}finally{setOperationBusy(false);}}
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const timer=setInterval(()=>{void client<PlayerAgentStatus>('player-agent-status').then(setAgent).catch(()=>{});},3000);return()=>clearInterval(timer);},[client]);
  const diagnostics:Record<string,string|number>={
    [t('environment')]:`${status?.os??'—'} · PHP ${status?.php_version??'—'}`,[t('legacyMode')]:status?.playmode??'—',[t('detectedPlayer')]:status?.detected_player??'—',
    'MPC-BE':status?(status.mpc_reachable?t('connectionPossible'):t('connectionFailed')):'—','foobar2000':status?(status.foobar_reachable?t('connectionPossible'):t('connectionFailed')):'—',
    [t('playbackState')]:status?.playback?.playingtitle||'再生情報なし',
  };
  return <div className="space-y-5"><section className="panel" aria-busy={!status&&!error}><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">DIAGNOSTICS</p><h2 className="text-2xl font-bold">{t('diagnosticsTitle')}</h2></div><Button tone="secondary" data-testid="system-refresh" onClick={()=>void load()} disabled={busy}>{t('refresh')}</Button></div>
    {error&&<p role="alert" className="error mt-4">{error}</p>}{!status&&!error&&<p role="status" className="mt-4 text-sm text-slate-500">{t('loading')}</p>}{status&&<dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(diagnostics).map(([label,value])=><div className="diagnostic-card" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <p className="mt-4 text-xs text-slate-500">診断情報を表示します。設定と正式な再生操作は各ページで行います。</p></section>
    <section className="panel" data-testid="media-agent-status" aria-busy={operationBusy}>
      <p className="eyebrow">WINDOWS MEDIA AGENT</p><h2 className="text-xl font-bold">Media Agent / Everything</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="diagnostic-card"><dt>Windows Launcher</dt><dd>{agent?.launcher?.connected?`接続中 ? ${agent.launcher.state}`:agent?.launcher?.state==='starting'?'起動処理中':'未接続'}</dd></div>
        <div className="diagnostic-card"><dt>Player Agent</dt><dd>{agent?.connected?'Fastify に認証接続済み':'未接続'}</dd></div>
        <div className="diagnostic-card"><dt>メディアルート</dt><dd>{agent?.mediaRootConfigured?'設定済み':'未設定または Agent 未接続'}</dd></div>
        <div className="diagnostic-card"><dt>検索経路</dt><dd>{agent?.agentSearchEnabled?'Windows Media Agent':'Legacy PHP (fallback)'}</dd></div>
        <div className="diagnostic-card"><dt>Everything HTTP</dt><dd>{agent?.everything==='connected_media_found'?'接続済み・許可範囲内に検索結果あり':agent?.everything==='connected_no_media'?'接続済み・今回の検索では該当なし':agent?.everything==='unavailable'?'接続失敗または認証エラー':agent?.everything==='not_checked'?'未確認':'Agent 未接続'}</dd></div>
        <div className="diagnostic-card"><dt>mpv 状態</dt><dd>{agent?.playback??'未確認'}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button data-testid="agent-launcher-start" disabled={operationBusy||!agent?.launcher?.connected||agent.launcher.state==='starting'||agent.launcher.state==='stopping'} onClick={()=>void run('player-agent-launcher',{action:'start'})}>Agent 起動・接続</Button>
        <Button data-testid="agent-launcher-stop" tone="danger" disabled={operationBusy||!agent?.launcher?.connected||agent.launcher.state==='stopping'||(!agent?.connected&&agent?.launcher?.state==='stopped')} onClick={()=>void run('player-agent-launcher',{action:'stop'},'再生中のタスクを安全に停止してから Player Agent を終了します。続行しますか？')}>Agent 停止</Button>
      </div>
      {!agent?.launcher?.connected&&<p className="mt-3 text-sm text-amber-800">Windows Launcher 未接続です。ボタンは表示されますが、操作には Windows ログオン Launcher が Fastify に接続している必要があります。ログオンタスクは現在未登録です。</p>}
      {agent?.launcher?.error&&<p role="alert" className="mt-2 text-sm text-red-700">Launcher error: {agent.launcher.error}. ログ: %LOCALAPPDATA%\\YukariPlayerAgent\\logs\\launcher.log</p>}
      {agent?.agentError&&<p role="status" className="mt-3 text-sm text-amber-800">Agent error: {agent.agentError}. ログ: %LOCALAPPDATA%\\YukariPlayerAgent\\logs</p>}
      {!agent?.connected&&<p className="mt-3 text-sm text-slate-500">Launcher と Agent は別々の状態です。Launcher 接続後は「Agent 起動・接続」で Agent を起動できます。</p>}
    </section>
    <section className="panel"><p className="eyebrow">LEGACY / TEST PLAYER</p><h2 className="text-xl font-bold">{t('testPlayer')}</h2><p className="mt-2 text-sm text-slate-500">Legacy プレーヤーの操作とローカルテスト動画です。正式キューの Node 操作はメイン画面を使用してください。</p>
      <label className="label mt-4" htmlFor="legacy-player">Legacy Player</label><select id="legacy-player" value={legacyPlayer} onChange={event=>setLegacyPlayer(event.target.value)}><option value="mpc">MPC-BE</option><option value="foobar">foobar2000</option></select>
      <div className="mt-3 flex flex-wrap gap-2">{Object.entries({play:'再生',pause:'一時停止',playpause:'再生 / 一時停止',stop:'停止'}).map(([action,label])=><Button tone="secondary" key={action} disabled={operationBusy||agent?.nodeOwnsQueue||(legacyPlayer==='foobar'&&['pause','stop'].includes(action))} onClick={()=>void run('player',{player:legacyPlayer,action},action==='stop'?'Legacy プレーヤーを停止しますか？':undefined)}>{label}</Button>)}</div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Windows Player Agent</p><p className="mt-1 text-sm text-slate-500">{agent?.connected?`${t('agentConnected')} · ${agent.playback}`:t('agentOffline')}</p></div><span className="text-sm">{agent?.task?`Task ${agent.task.state}`:'Task —'}</span></div>
        <div className="mt-3 flex flex-wrap gap-2"><Button data-testid="system-start-test" tone="secondary" disabled={operationBusy||!agent?.connected||!agent.testReady||agent.nodeOwnsQueue||agent.autoplayEnabled||Boolean(agent.task&&['pending','claimed','playing','uncertain'].includes(agent.task.state))} onClick={()=>void run('player-agent-test',{},'設定済みのローカルテスト動画を再生しますか？')}>{t('testVideo')}</Button>
          {agent?.task?.kind==='test'&&<><Button tone="secondary" disabled={operationBusy||agent.playback!=='playing'} onClick={()=>void run('player-agent-control',{action:'pause'})}>{t('testPause')}</Button><Button tone="secondary" disabled={operationBusy||agent.playback!=='paused'} onClick={()=>void run('player-agent-control',{action:'resume'})}>{t('testResume')}</Button><Button tone="danger" disabled={operationBusy||!['claimed','playing'].includes(agent.task.state)} onClick={()=>void run('player-agent-control',{action:'stop'},'テスト動画を停止しますか？')}>{t('testStop')}</Button></>}</div></div>
      {operationNotice&&<p role="status" className="mt-3 text-sm text-emerald-800">{operationNotice}</p>}{agent?.file&&<p className="mt-3 text-xs text-slate-500">プライバシー保護のためメディアの絶対パスは表示しません。</p>}
    </section>
    <section className="panel"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">HISTORY</p><h2 className="text-xl font-bold">{t('historyTitle')}</h2></div><Button tone="secondary" disabled={busy} onClick={()=>void load()}>{t('historyRefresh')}</Button></div>
      {history&&history.tasks.length?<ol className="mt-3 divide-y divide-slate-100">{history.tasks.map(task=><li className="flex flex-wrap justify-between gap-2 py-4 text-sm" key={task.id}><span className="font-medium">Request #{task.requestId} · {task.state}{task.errorCode?` · ${task.errorCode}`:''}</span><span className="text-slate-500">{new Date(task.createdAt).toLocaleString()}</span></li>)}</ol>:history?<EmptyState className="mt-4">{t('emptyHistory')}</EmptyState>:<p role="status" className="mt-4 text-sm text-slate-500">{t('loading')}</p>}
    </section></div>;
}
