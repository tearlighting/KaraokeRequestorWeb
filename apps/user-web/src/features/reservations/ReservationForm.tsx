import { useRef, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import type { Song } from '../search/api';
import { reserve } from './api';

export function ReservationForm({ song, onClear, onCreated }: { song: Song | null; onClear: () => void; onCreated: (id: number) => void }) {
  const t = useT(); const [singer, setSinger] = useState(''); const [comment, setComment] = useState(''); const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false); const [warning, setWarning] = useState(''); const [error, setError] = useState(''); const submitting = useRef(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (submitting.current || !singer.trim()) return; submitting.current = true; setBusy(true); setError(''); setWarning(''); try { const result = await reserve(song, singer, comment, secret); setComment(''); onClear(); onCreated(result.id); setWarning(result.warnings.join(' · ')); } catch (cause) { setError(errorMessage(cause)); } finally { submitting.current = false; setBusy(false); } }
  return <section id="reservation-form" className="panel scroll-mt-4" aria-labelledby="reservation-title">
    <p className="eyebrow">{t('reservation')}</p><h2 id="reservation-title" className="text-xl font-bold">{song ? t('selectedSong') : t('reservation')}</h2>
    {song ? <div className="mt-3 flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{song.name}{song.artist ? ` · ${song.artist}` : ''}</p><button className="shrink-0 text-sm text-teal-800 underline" onClick={onClear} disabled={busy}>{t('clear')}</button></div> : <p className="mt-2 text-sm text-slate-500">{t('chooseSong')}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><label htmlFor="singer" className="field-label">{t('singer')}</label><input id="singer" data-testid="reservation-singer" autoComplete="nickname" maxLength={256} required value={singer} onChange={e => setSinger(e.target.value)} disabled={busy} placeholder={t('singer')} /></div>
      <div><label htmlFor="comment" className="field-label">{t('comment')}</label><textarea id="comment" data-testid="reservation-comment" rows={2} maxLength={512} value={comment} onChange={e => setComment(e.target.value)} disabled={busy} placeholder={t('comment')} /></div>
      <label className="privacy-option"><input data-testid="reservation-private" className="w-auto" type="checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} disabled={busy} /><span><span className="font-medium">{t('private')}</span><span className="mt-0.5 block text-xs text-slate-500">他の参加者には曲名などが表示されません。</span></span></label>
      <Button data-testid="reservation-submit" className="w-full" disabled={busy || !singer.trim()}>{busy ? t('submitting') : t('submit')}</Button>
    </form>
    {warning && <p role="status" className="mt-4 text-amber-800">{warning}</p>}{error && <p role="alert" className="error mt-4">{t('submittingError')}: {error}</p>}
  </section>;
}
