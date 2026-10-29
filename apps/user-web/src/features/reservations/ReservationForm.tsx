import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { ApiError } from '../../lib/api';
import type { Song } from '../search/api';
import { saveParticipantName } from '../participants/api';
import { setParticipantProfile } from '../../store/participantStore';
import { reserve } from './api';

export function ReservationForm({ song, participantId, participantName, resetKey, onClear, onCreated }: { song: Song | null; participantId:string; participantName:string; resetKey?:number|null; onClear: () => void; onCreated: (id: number, participantName:string) => void }) {
  const t = useT(); const [singer, setSinger] = useState(participantName); const [comment, setComment] = useState(''); const [secret, setSecret] = useState(false); const [keychange,setKeychange]=useState(0);
  const [busy, setBusy] = useState(false); const [submitted, setSubmitted] = useState(false); const [warning, setWarning] = useState(''); const [error, setError] = useState<unknown>(null); const submitting = useRef(false);
  useEffect(()=>{setSinger(participantName);},[participantId,participantName]);
  useEffect(()=>{if(resetKey===null)setSubmitted(false);},[song?.fullpath,resetKey]);
  async function submit(event: FormEvent) { event.preventDefault(); if (submitting.current || submitted || !singer.trim()) return; submitting.current = true; setBusy(true); setError(null); setWarning(''); try {
    let effectiveParticipantId = participantId;
    let effectiveParticipantName = participantName;
    // A first-time user can enter their nickname here. The singer text alone
    // is not an identity, so persist it to this session's profile first.
    if (!effectiveParticipantName.trim() || !effectiveParticipantId) {
      const saved = await saveParticipantName(singer.trim());
      setParticipantProfile(saved);
      effectiveParticipantId = saved.id;
      effectiveParticipantName = saved.displayName;
    }
    const result = await reserve(song, singer, effectiveParticipantId, comment, secret, keychange); setComment(''); setKeychange(0); setSubmitted(true); onCreated(result.id,effectiveParticipantName); setWarning(result.warnings.join(' · '));
  } catch (cause) { setError(cause); } finally { submitting.current = false; setBusy(false); } }
  const apiError = error instanceof ApiError ? error : null;
  const errorStage = apiError?.status === 401 || apiError?.status === 403 ? 'authentication'
    : apiError?.stage || (apiError?.status === 0 ? 'network' : 'api');
  return <section id="reservation-form" className="panel scroll-mt-4" aria-labelledby="reservation-title">
    <p className="eyebrow">{t('reservation')}</p><h2 id="reservation-title" className="text-xl font-bold">{song ? t('selectedSong') : t('reservation')}</h2>
    {song ? <div className="mt-3 flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{song.name}{song.artist ? ` · ${song.artist}` : ''}</p><button className="shrink-0 text-sm text-teal-800 underline" onClick={onClear} disabled={busy}>{t('clear')}</button></div> : <p className="mt-2 text-sm text-slate-500">{t('chooseSong')}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><label htmlFor="singer" className="field-label">{t('singer')}</label><input id="singer" data-testid="reservation-singer" autoComplete="nickname" maxLength={256} required value={singer} onChange={e => setSinger(e.target.value)} disabled={busy} placeholder={t('singer')} /></div>
      <div><label htmlFor="comment" className="field-label">{t('comment')}</label><textarea id="comment" data-testid="reservation-comment" rows={2} maxLength={512} value={comment} onChange={e => setComment(e.target.value)} disabled={busy} placeholder={t('comment')} /></div>
      {song&&<div><label htmlFor="reservation-keychange" className="field-label">{t('requestKey')}</label><select id="reservation-keychange" data-testid="reservation-keychange" value={keychange} onChange={e=>setKeychange(Number(e.target.value))} disabled={busy}>{Array.from({length:13},(_,index)=>index-6).map(value=><option key={value} value={value}>{value===0?'±0':value>0?`+${value}`:value}</option>)}</select><p className="mt-1 text-xs text-slate-500">{t('requestKeyHelp')}</p></div>}
      <label className="privacy-option"><input data-testid="reservation-private" className="w-auto" type="checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} disabled={busy} /><span><span className="font-medium">{t('private')}</span><span className="mt-0.5 block text-xs text-slate-500">他の参加者には曲名などが表示されません。</span></span></label>
      <p className="text-xs text-slate-500">今回の点歌人：{participantName || (singer.trim() ? `${singer.trim()}（初回予約時にニックネームとして保存します）` : 'ニックネームを入力してください')}</p><Button data-testid="reservation-submit" className="w-full" disabled={busy || submitted || !singer.trim()}>{busy ? t('submitting') : t('submit')}</Button>
    </form>
    {warning && <p role="status" className="mt-4 text-amber-800">{warning}</p>}{error !== null && <div role="alert" className="error mt-4" data-testid="reservation-error"><p>{t('submittingError')}</p><p className="mt-1 break-all font-mono text-xs" data-testid="reservation-diagnostic">stage={errorStage}; code={apiError?.code || 'CLIENT_ERROR'}{apiError?.status ? `; http=${apiError.status}` : ''}{apiError?.requestId ? `; requestId=${apiError.requestId}` : '; requestId=unavailable'}{apiError?.relatedRequestId ? `; postRequestId=${apiError.relatedRequestId}` : ''}</p><p className="mt-1 text-xs">診断 ID がない場合、Fastify まで届く前の通信または端末側エラーの可能性があります。予約は再送せず、同じ画面で状態を確認してください。</p></div>}
  </section>;
}
