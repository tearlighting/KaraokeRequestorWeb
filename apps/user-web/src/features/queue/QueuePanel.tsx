import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { getQueue } from './api';
import { useQueuePageStore } from '../../store/queuePageStore';
import { formatMediaTitle } from '../search/formatMediaTitle';
import { StatusTag, type StatusKind } from '../../../../../packages/web-foundation/src/StatusTag';
import { apiJson } from '../../lib/api';
import { useState } from 'react';

function queueStatus(value: string): StatusKind {
  if (value === '\u672a\u518d\u751f') return 'queued';
  if (value === '\u518d\u751f\u4e2d') return 'playing';
  if (value.includes('\u518d\u751f\u6e08')) return 'completed';
  if (value.includes('\u5931\u6557')) return 'failed';
  if (value.includes('\u78ba\u8a8d')) return 'uncertain';
  if (value.includes('\u505c\u6b62') || value.includes('\u51e6\u7406\u6e08')) return 'stopped';
  if (value.includes('\u5f85\u3061')) return 'queued';
  return 'unknown';
}
function queueStatusLabel(status: StatusKind, t: ReturnType<typeof useT>) {
  const keys = { queued: 'statusQueued', playing: 'statusPlaying', completed: 'statusCompleted', failed: 'statusFailed', uncertain: 'statusUncertain', stopped: 'statusStopped', paused: 'statusPaused', unknown: 'statusUnknown' } as const;
  return t(keys[status]);
}

export function QueuePanel({ revision, createdId }: { revision: number; createdId: number | null }) {
  const t = useT();
  const queue = useQueuePageStore(state => state.queue);
  const queueError = useQueuePageStore(state => state.error);
  const busy = useQueuePageStore(state => state.busy);
  const updated = useQueuePageStore(state => state.updated);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(() => new Set());
  const alive = useRef(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; useQueuePageStore.setState({ busy: true });
    try { const result = await getQueue(20, 0, 'active'); if (alive.current) useQueuePageStore.setState({ queue: result, error: '', updated: new Date().toLocaleTimeString() }); }
    catch (cause) { if (alive.current) useQueuePageStore.setState({ error: errorMessage(cause) }); }
    finally { inFlight.current = false; if (alive.current) useQueuePageStore.setState({ busy: false }); }
  }, []);
  const loadMore = useCallback(async () => {
    if (inFlight.current) return;
    const current = useQueuePageStore.getState().queue;
    if (!current?.hasMore) return;
    inFlight.current = true; useQueuePageStore.setState({ busy: true });
    try { const next = await getQueue(20, current.nextOffset, 'active'); if (alive.current) useQueuePageStore.setState({ queue: { ...next, items: [...current.items, ...next.items], hasMore: next.hasMore, nextOffset: next.nextOffset }, error: '', updated: new Date().toLocaleTimeString() }); }
    catch (cause) { if (alive.current) useQueuePageStore.setState({ error: errorMessage(cause) }); }
    finally { inFlight.current = false; if (alive.current) useQueuePageStore.setState({ busy: false }); }
  }, []);
  useEffect(() => { alive.current = true; void refresh(); const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000); const onVisible = () => { if (!document.hidden) void refresh(); }; document.addEventListener('visibilitychange', onVisible); return () => { alive.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); }; }, [refresh]);
  useEffect(() => { void refresh(); }, [revision, refresh]);
  useEffect(() => { let active = true; const refreshOwned = async () => { try { const result = await apiJson('/user/reservations?limit=50&offset=0'); const ids = Array.isArray(result.items) ? result.items.map((item: { id?: unknown }) => item.id).filter((id: unknown): id is number => typeof id === 'number') : []; if (active) setOwnedIds(new Set(ids)); } catch { /* Queue remains usable if personal history is unavailable. */ } }; void refreshOwned(); const timer = window.setInterval(() => { if (!document.hidden) void refreshOwned(); }, 30000); return () => { active = false; window.clearInterval(timer); }; }, [revision]);

  const submittedItem = queue?.items.find(item => item.id === createdId);
  return <section data-testid="queue-panel" data-loaded={queue !== null} className="queue-board" aria-labelledby="queue-title">
    <header className="queue-board-heading" aria-labelledby="queue-title"><div><span className="queue-count">{queue ? queue.remaining : "-"}</span><div><h2 id="queue-title" className="sr-only">{t("queue")}</h2><p>{queue ? t("queueCount", { total: queue.total, remaining: queue.remaining }) : t("queueLoading")}</p></div></div><button type="button" className="icon-action" aria-label={busy ? t("loading") : t("refresh")} title={t("refresh")} onClick={() => void refresh()} disabled={busy}><span aria-hidden="true">&#8635;</span></button></header>
    {createdId !== null && <p data-testid="reservation-feedback" role="status" className="success-banner queue-feedback">{submittedItem ? <>{t('submitted')}: {submittedItem.display_name} · {queueStatusLabel(queueStatus(submittedItem.nowplaying), t)}</> : `#${createdId} · ${t('submitted')}`}</p>}
    {queueError && <p role="alert" className="error mt-4">{t('queueError')} {queueError}</p>}
    <p className="queue-updated">{updated ? t('updatedAt', { time: updated }) : ''}</p>
    <ol className="queue-list" data-testid="queue">{queue?.items.map(item => { const status = queueStatus(item.nowplaying); const mine = createdId === item.id || ownedIds.has(item.id); return <li key={item.id} data-request-id={item.id} className={`queue-item${status === 'playing' ? ' queue-item-playing' : ''}${mine ? ' queue-item-mine' : ''}`}>
      <div className="queue-item-position">{String(item.position).padStart(2, '0')}</div>
      <div className="queue-item-content"><div className="queue-item-titleline"><p className="queue-item-title">{formatMediaTitle(item.display_name)}</p>{mine && <span className="queue-mine-badge">{t('mineQueueBadge')}</span>}</div><p className="queue-item-person">{item.singer}<span aria-hidden="true"> · </span>{item.kind}{item.keychange !== 0 && <span className="queue-key-badge">{t('playerKey')} {item.keychange > 0 ? '+' : ''}{item.keychange}</span>}</p></div>
      <StatusTag status={status}>{queueStatusLabel(status, t)}</StatusTag>
    </li>; })}</ol>
    {queue?.items.length === 0 && <EmptyState className="queue-empty"><p>{t('emptyQueue')}</p><Link className="secondary mt-3 inline-flex" to="/">{t('backToSearch')}</Link></EmptyState>}
    {queue?.hasMore && <button type="button" className="secondary mt-4 min-h-11 w-full" onClick={() => void loadMore()} disabled={busy}>{busy ? t('loading') : t('showMore20')}</button>}
  </section>;
}
