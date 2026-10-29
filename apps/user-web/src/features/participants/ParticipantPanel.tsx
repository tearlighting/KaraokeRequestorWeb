import { useEffect, useState } from 'react';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { loadParticipantProfile, saveParticipantName } from './api';
import { setParticipantProfile, useParticipantStore } from '../../store/participantStore';
import { useT } from '../../../../../packages/web-foundation/src/i18n';

export function ParticipantPanel() {
  const t = useT();
  const profile = useParticipantStore(state => state.profile);
  const loading = useParticipantStore(state => state.loading);
  const saving = useParticipantStore(state => state.saving);
  const error = useParticipantStore(state => state.error);
  const [name, setName] = useState('');
  useEffect(() => { let active = true; void loadParticipantProfile().then(data => { if (active) { setParticipantProfile(data); setName(data.displayName); } }).catch(cause => { if (active) useParticipantStore.setState({ loading: false, error: errorMessage(cause) }); }); return () => { active = false; }; }, []);
  useEffect(() => { if (profile) setName(profile.displayName); }, [profile?.displayName]);
  async function save() {
    if (saving || !name.trim()) return;
    useParticipantStore.setState({ saving: true, error: '' });
    try { const saved = await saveParticipantName(name.trim()); setParticipantProfile(saved); setName(saved.displayName); }
    catch (cause) { useParticipantStore.setState({ error: errorMessage(cause) }); }
    finally { useParticipantStore.setState({ saving: false }); }
  }
  const displayName = profile?.displayName || name;
  return <section className="participant-panel" aria-label={t('participants')}>
    <header className="participant-profile-heading"><span className="participant-avatar" aria-hidden="true">{displayName.trim().slice(0, 1) || 'Y'}</span><span className="participant-profile-copy"><span>{t('currentParticipant')}</span><strong>{displayName || t('nicknamePlaceholder')}</strong></span></header>
    <div className="participant-edit-row"><label className="sr-only" htmlFor="participant-own-name">{t('ownNickname')}</label><input id="participant-own-name" maxLength={64} value={name} onChange={event => setName(event.target.value)} placeholder={t('nicknamePlaceholder')} disabled={loading || saving} /><Button tone="secondary" disabled={loading || saving || !name.trim() || name.trim() === profile?.displayName} onClick={() => void save()}>{saving ? t('saving') : t('saveNickname')}</Button></div>
    <p className="participant-note">{t('nicknameHelp')}</p>
    {loading && <p role="status" className="mt-2 text-xs">{t('participantLoading')}</p>}{error && <p role="alert" className="error mt-2">{t('participantError')}: {error}</p>}
  </section>;
}
