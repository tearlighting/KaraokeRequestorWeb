import { useCallback, useEffect, useRef } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { getQueue } from './api';
import { useQueuePageStore } from '../../store/queuePageStore';

export function QueuePanel({ revision, createdId }: { revision: number; createdId: number | null }) {
  const t = useT(); const queue = useQueuePageStore(state => state.queue); const queueError = useQueuePageStore(state => state.error); const busy = useQueuePageStore(state => state.busy); const updated = useQueuePageStore(state => state.updated);
  const alive = useRef(false); const inFlight = useRef(false);
  const refresh = useCallback(async () => { if (inFlight.current) return; inFlight.current = true; useQueuePageStore.setState({ busy: true }); try { const result = await getQueue(); if (alive.current) useQueuePageStore.setState({ queue: result, error: '', updated: new Date().toLocaleTimeString() }); } catch (cause) { if (alive.current) useQueuePageStore.setState({ error: errorMessage(cause) }); } finally { inFlight.current = false; if (alive.current) useQueuePageStore.setState({ busy: false }); } }, []);
  useEffect(() => { alive.current = true; void refresh(); const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000); const onVisible = () => { if (!document.hidden) void refresh(); }; document.addEventListener('visibilitychange', onVisible); return () => { alive.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); }; }, [refresh]);
  useEffect(() => { void refresh(); }, [revision, refresh]);
  const submittedItem = queue?.items.find(item => item.id === createdId);
  return <section data-testid="queue-panel" data-loaded={queue !== null} className="panel" aria-labelledby="queue-title"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{t('queueTitle')}</p><h2 id="queue-title" className="text-xl font-bold">{t('queue')}</h2><p className="mt-2 text-sm text-slate-500">{queue ? t('queueCount', { total: queue.total, remaining: queue.remaining }) : t('queueLoading')}</p></div><button className="secondary shrink-0" onClick={() => void refresh()} disabled={busy}>{busy ? t('loading') : t('refresh')}</button></div>
    {createdId !== null && <p data-testid="reservation-feedback" role="status" className="success-banner mt-4">{submittedItem ? <>{t('submitted')}: {submittedItem.display_name} · {submittedItem.nowplaying}</> : `#${createdId} · ${t('submitted')}`}</p>}
    {queueError && <p role="alert" className="error mt-4">{t('queueError')} {queueError}</p>}
    <p className="mt-4 text-xs text-slate-500">予約順と再生状態はサーバーが管理しています。秘密の予約は本人以外には伏せて表示されます。{updated && ` · 更新 ${updated}`}</p>
    <ol className="mt-3 divide-y divide-slate-100" data-testid="queue">{queue?.items.map(item => <li key={item.id} data-request-id={item.id} className={`queue-row ${createdId === item.id ? 'queue-row-current' : ''}`}><div className="flex items-center justify-between gap-3"><span className="queue-position">{String(item.position).padStart(2, '0')} · #{item.id}</span><span className="status-chip">{item.nowplaying}</span></div><p className="mt-2 break-words font-semibold">{item.display_name}</p><p className="mt-1 break-words text-sm text-slate-600">{item.singer} <span aria-hidden="true">·</span> {item.kind}{item.keychange!==0&&<> <span aria-hidden="true">·</span> {t('playerKey')} {item.keychange>0?'+':''}{item.keychange}</>}</p></li>)}</ol>
    {queue?.items.length === 0 && <EmptyState className="mt-4">{t('emptyQueue')}</EmptyState>}
  </section>;
}
