import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { ParticipantPanel } from './ParticipantPanel';
import { Preferences } from '../../../../../packages/web-foundation/src/preferences';
import { formatMediaTitle } from '../search/formatMediaTitle';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import type { MessageKey } from '../../../../../packages/language';
import { StatusTag, type StatusKind } from '../../../../../packages/web-foundation/src/StatusTag';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';

type ReservationState = 'queued' | 'playing' | 'completed' | 'stopped' | 'failed' | 'uncertain' | 'unknown';
type OwnedReservation = { id: number; title: string; singer: string; kind: string; status: ReservationState; position: number; requestedAt: number; playbackState: string | null; startedAt: number | null; finishedAt: number | null; errorCode: string | null };
const statusKey: Record<ReservationState, MessageKey> = { queued: 'statusQueued', playing: 'statusPlaying', completed: 'statusCompleted', stopped: 'statusStopped', failed: 'statusFailed', uncertain: 'statusUncertain', unknown: 'statusUnknown' };
const statusKind: Record<ReservationState, StatusKind> = { queued: 'queued', playing: 'playing', completed: 'completed', stopped: 'stopped', failed: 'failed', uncertain: 'uncertain', unknown: 'unknown' };

export function MyPage() {
  const t = useT();
  const [items, setItems] = useState<OwnedReservation[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const from = reset ? 0 : offset;
      const result = await apiJson(`/user/reservations?limit=20&offset=${from}`);
      const rows = Array.isArray(result.items) ? result.items as OwnedReservation[] : [];
      setItems(current => reset ? rows : [...current, ...rows]);
      setOffset(typeof result.nextOffset === 'number' ? result.nextOffset : from + rows.length);
      setHasMore(result.hasMore === true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('reservationReadError')); }
    finally { setLoading(false); }
  }, [loading, offset, t]);
  useEffect(() => { void load(true); }, []);

  const current = items.filter(item => item.status === 'queued' || item.status === 'playing');
  const past = items.filter(item => !current.includes(item));
  return <section className="user-page-stack my-page" aria-labelledby="my-page-title" data-testid="my-page">
    <header className="user-page-heading"><p className="eyebrow">YUKARI · ACCOUNT</p><h1 id="my-page-title">{t('myPageTitle')}</h1></header>
    <ParticipantPanel />
    <details className="my-preferences"><summary><span className="my-preferences-icon" aria-hidden="true">⚙</span><span>{t('appSettings')}</span><span className="my-preferences-current">{t('language')} · {t('theme')}</span></summary><Preferences /></details>
    {error && <p role="alert" className="error">{error}</p>}
    <section className="my-reservations" aria-labelledby="my-reservations-title">
      <header><div><p className="eyebrow">HISTORY</p><h2 id="my-reservations-title">{t('myReservations')}</h2></div><span className="my-reservation-count">{items.length}</span></header>
      {loading && items.length === 0 && <p role="status" className="mt-4 text-sm text-[var(--muted)]">{t('loading')}</p>}
      {!loading && items.length === 0 && !error && <div className="my-empty-state"><Icon name="queued" size={22} /><p>{t('noMyReservations')}</p></div>}
      {current.length > 0 && <section className="my-reservation-group"><h3>{t('currentReservations')}</h3><ul>{current.map(item => <ReservationRow key={item.id} item={item} t={t} />)}</ul></section>}
      {past.length > 0 && <section className="my-reservation-group"><h3>{t('playbackHistory')}</h3><ul>{past.map(item => <ReservationRow key={item.id} item={item} t={t} />)}</ul></section>}
      {hasMore && <button type="button" className="secondary mt-4 min-h-11 w-full" disabled={loading} onClick={() => void load(false)}>{loading ? t('loading') : t('loadMore')}</button>}
      <p className="my-history-note">{t('sameNicknameNotice')}</p>
    </section>
  </section>;
}

function ReservationRow({ item, t }: { item: OwnedReservation; t: ReturnType<typeof useT> }) {
  const date = (value: number | null) => value && Number.isFinite(value) ? new Date(value * 1000).toLocaleString() : '—';
  return <li className="my-reservation-row" data-testid={`my-reservation-${item.id}`}>
    <div className="my-reservation-top"><div className="min-w-0"><p className="my-reservation-title">{formatMediaTitle(item.title)}</p><p className="my-reservation-singer">{item.singer}<span aria-hidden="true"> · </span>{item.kind}</p>{item.status === 'queued' && <p className="my-reservation-position">{t('queuePosition', { position: item.position })}</p>}</div><StatusTag status={statusKind[item.status] || 'unknown'}>{t(statusKey[item.status] || statusKey.unknown)}</StatusTag></div>
    <p className="my-reservation-dates">{t('requestedAt')} {date(item.requestedAt)} · {t('playbackStartedAt')} {date(item.startedAt)} · {t('finishedAt')} {date(item.finishedAt)}</p>
    {item.playbackState && <p className="my-reservation-details">{t('playbackDetails')}: {item.playbackState}{item.errorCode ? ` · ${item.errorCode}` : ''}</p>}
  </li>;
}
