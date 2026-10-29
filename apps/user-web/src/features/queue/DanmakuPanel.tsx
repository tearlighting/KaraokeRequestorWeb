import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { apiJson, ApiError, errorMessage } from '../../lib/api';
import { useParticipantStore } from '../../store/participantStore';

export function DanmakuPanel(){
  const t=useT();
  const profile=useParticipantStore(state=>state.profile);
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;const load=()=>{void apiJson('/danmaku/status').then(value=>{if(active)setEnabled(value.enabled===true);}).catch(cause=>{if(active){setEnabled(false);setError(errorMessage(cause));}});};load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(busy||!text.trim())return;
    setBusy(true);setError('');setNotice('');
    try{await apiJson('/danmaku',{method:'POST',body:JSON.stringify({text,nickname:profile?.displayName||''})});setText('');setNotice(t('danmakuSent'));}
    catch(cause){setError(cause instanceof ApiError&&cause.code==='DANMAKU_RATE_LIMITED'?t('danmakuRateLimited'):errorMessage(cause));}
    finally{setBusy(false);}
  }
  return <section className="panel mt-5" aria-label={t('danmakuTitle')} data-testid="danmaku-panel">
    <h2 className="text-lg font-semibold">{t('danmakuTitle')}</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">{t('danmakuHint')}</p>
    {enabled===null&&<p role="status" className="mt-3 text-sm">{t('loading')}</p>}
    {enabled===false&&(error?<p role="alert" className="error mt-3">{error}</p>:<p role="status" className="mt-3 text-sm">{t('danmakuDisabled')}</p>)}
    {enabled&&<form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event=>void submit(event)}>
      <label className="sr-only" htmlFor="danmaku-text">{t('danmakuTitle')}</label>
      <input id="danmaku-text" data-testid="danmaku-text" maxLength={100} value={text} onChange={event=>setText(event.target.value)} placeholder={t('danmakuPlaceholder')} disabled={busy}/>
      <Button data-testid="danmaku-send" disabled={busy||!text.trim()}>{busy?t('submitting'):t('danmakuSend')}</Button>
    </form>}
    {notice&&<p role="status" className="success-banner mt-3">{notice}</p>}{error&&enabled!==false&&<p role="alert" className="error mt-3">{error}</p>}
  </section>;
}
