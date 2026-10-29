import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button, EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type ParticipantAdminItem } from '../../lib/admin';

export function ParticipantsPage({ client }: { client: AdminClient }) {
  const t = useT();
  const [items, setItems] = useState<ParticipantAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    try { const result = await client<{ items: ParticipantAdminItem[] }>('participants'); setItems(result.items); setError(''); }
    catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void reload(); }, [reload]);
  async function rename(item: ParticipantAdminItem) {
    const displayName = window.prompt(t('renameParticipantPrompt', { name: item.displayName }));
    if (!displayName?.trim() || busy) return;
    setBusy(true); setNotice(''); setError('');
    try { await client('participant-rename', { id: item.id, displayName: displayName.trim() }); setNotice(t('renameParticipantSaved')); await reload(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label={t('adminParticipants')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">PARTICIPANTS</p><h2 className="text-2xl font-bold">{t('adminParticipants')}</h2><p className="mt-2 text-sm text-slate-500">{t('participantsDescription')}</p></div>
      <Button tone="secondary" disabled={busy || loading} onClick={() => void reload()}>{t('refresh')}</Button>
    </div>
    {error && <p role="alert" className="error mt-4">{error}</p>}
    {notice && <p role="status" className="success-banner mt-4">{notice}</p>}
    {loading && <p role="status" className="mt-4">{t('participantsLoading')}</p>}
    <div className="mt-4 divide-y divide-slate-200">{items.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div><h3 className="font-semibold">{item.displayName || t('participantUnnamed')} <span className="font-mono text-xs text-slate-400">#{item.id.slice(0, 8)}</span></h3><p className="mt-1 text-sm text-slate-500">{t('participantRequestCount', { count: item.reservationCount })} · {t('participantBrowserHistoryCount', { count: item.submittedCount })}</p></div>
      <Button tone="secondary" disabled={busy} onClick={() => void rename(item)}>{t('renameDisplayName')}</Button>
    </article>)}</div>
    {!loading && items.length === 0 && <EmptyState className="mt-4">{t('noParticipantsYet')}</EmptyState>}
  </section>;
}
