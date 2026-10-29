import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { ApiError } from '../../lib/api';
import type { Song } from '../search/api';
import { saveParticipantName } from '../participants/api';
import { setParticipantProfile } from '../../store/participantStore';
import { reserve } from './api';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';

export function ReservationForm({ song, participantId, participantName, resetKey, onClear, onCreated }: { song: Song | null; participantId: string; participantName: string; resetKey?: number | null; onClear: () => void; onCreated: (id: number, participantName: string) => void }) {
  const t = useT();
  const [singer, setSinger] = useState(participantName);
  const [comment, setComment] = useState('');
  const [secret, setSecret] = useState(false);
  const [keychange, setKeychange] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState<unknown>(null);
  const submitting = useRef(false);

  useEffect(() => { setSinger(participantName); }, [participantId, participantName]);
  useEffect(() => { if (resetKey === null) setSubmitted(false); }, [song?.fullpath, resetKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || submitted || !singer.trim()) return;
    submitting.current = true; setBusy(true); setError(null); setWarning('');
    try {
      let effectiveParticipantId = participantId;
      let effectiveParticipantName = participantName;
      if (!effectiveParticipantName.trim() || !effectiveParticipantId) {
        const saved = await saveParticipantName(singer.trim());
        setParticipantProfile(saved); effectiveParticipantId = saved.id; effectiveParticipantName = saved.displayName;
      }
      const result = await reserve(song, singer, effectiveParticipantId, comment, secret, keychange);
      setComment(''); setKeychange(0); setSubmitted(true); onCreated(result.id, effectiveParticipantName); setWarning(result.warnings.join(' · '));
    } catch (cause) { setError(cause); }
    finally { submitting.current = false; setBusy(false); }
  }

  const apiError = error instanceof ApiError ? error : null;
  const errorStage = apiError?.status === 401 || apiError?.status === 403 ? 'authentication' : apiError?.stage || (apiError?.status === 0 ? 'network' : 'api');
  const errorStageLabel = errorStage === 'authentication' ? t('errorStageAuthentication') : errorStage === 'network' ? t('errorStageNetwork') : t('errorStageApi');

  return <section id="reservation-form" className="reservation-panel" aria-labelledby="reservation-title">
    <header className="reservation-panel-heading"><p className="eyebrow">{t('reservation')}</p><h2 id="reservation-title">{t('reservation')}</h2></header>
    {song ? <div className="reservation-song"><span className="music-mark" aria-hidden="true">♫</span><span className="min-w-0"><strong>{t('selectedSong')}</strong><span className="reservation-song-title">{song.artist ? `${song.artist} · ` : ''}{song.name}</span></span><button type="button" className="shrink-0 text-sm font-medium text-[var(--primary)] underline" onClick={onClear} disabled={busy}>{t('clear')}</button></div> : <p className="mt-2 text-sm text-[var(--muted)]">{t('chooseSong')}</p>}
    <form onSubmit={submit} className="reservation-flow">
      <div className="reservation-person"><label htmlFor="singer" className="field-label">{t('singer')}</label><input id="singer" data-testid="reservation-singer" autoComplete="nickname" maxLength={256} required value={singer} onChange={event => setSinger(event.target.value)} disabled={busy} placeholder={t('singer')} /><p className="reservation-current-singer">{t('currentParticipant')}: <strong>{participantName || (singer.trim() ? `${singer.trim()} · ${t('nicknameSavedOnFirstRequest')}` : t('nicknamePlaceholder'))}</strong></p></div>
      <label className="reservation-comment"><span className="field-label">{t('comment')}</span><textarea id="comment" data-testid="reservation-comment" rows={2} maxLength={512} value={comment} onChange={event => setComment(event.target.value)} disabled={busy} placeholder={t('comment')} /></label>
      {song && <label className="reservation-key"><span className="field-label">{t('requestKey')}</span><select id="reservation-keychange" data-testid="reservation-keychange" value={keychange} onChange={event => setKeychange(Number(event.target.value))} disabled={busy}>{Array.from({ length: 13 }, (_, index) => index - 6).map(value => <option key={value} value={value}>{value === 0 ? '±0' : value > 0 ? `+${value}` : value}</option>)}</select><span className="reservation-help">{t('requestKeyHelp')}</span></label>}
      <label className="privacy-option"><input data-testid="reservation-private" type="checkbox" checked={secret} onChange={event => setSecret(event.target.checked)} disabled={busy} /><span><strong>{t('private')}</strong><span className="reservation-help">{t('reservationPrivacyHint')}</span></span></label>
      <div className="reservation-submit-wrap"><Button aria-label={busy ? t('submitting') : t('submit')} data-testid="reservation-submit" className="reservation-submit" disabled={busy || submitted || !singer.trim()}><Icon name="check" size={20} /><span>{busy ? t('submitting') : t('confirmShort')}</span></Button></div>
    </form>
    {warning && <p role="status" className="mt-4 text-amber-800">{warning}</p>}
    {error !== null && <div role="alert" className="error mt-4" data-testid="reservation-error"><p>{t('submittingError')}</p><p className="mt-1 break-all font-mono text-xs" data-testid="reservation-diagnostic">stage={errorStageLabel}; code={apiError?.code || 'CLIENT_ERROR'}{apiError?.status ? `; http=${apiError.status}` : ''}{apiError?.requestId ? `; requestId=${apiError.requestId}` : '; requestId=unavailable'}{apiError?.relatedRequestId ? `; postRequestId=${apiError.relatedRequestId}` : ''}</p><p className="mt-1 text-xs">{t('diagnosticUnavailable')}</p></div>}
  </section>;
}
