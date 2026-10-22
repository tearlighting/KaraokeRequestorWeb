import { useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button, Card } from '../../../../../packages/web-foundation/src/primitives';
import { login, message, type Session } from '../../lib/admin';

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const t = useT(); const [username, setUsername] = useState('admin'); const [password, setPassword] = useState(''); const [easyPass, setEasyPass] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { const session = await login({ username, password, easyPass }); setPassword(''); setEasyPass(''); onLogin(session); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-md px-4 py-16"><p className="eyebrow">YUKARI / ADMIN</p><h1 className="my-4 text-3xl font-bold">{t('login')}</h1><p className="mb-6 text-sm text-slate-500">{t('notAuthorized')}</p>
    <Card><form className="space-y-4" onSubmit={submit}><div><label className="label" htmlFor="username">{t('username')}</label><input id="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></div>
      <div><label className="label" htmlFor="password">{t('password')}</label><input data-testid="admin-password" id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
      <details><summary className="cursor-pointer text-sm text-slate-500">{t('easyPassPrompt')}</summary><label className="label mt-3" htmlFor="easy-pass">{t('easyPass')}</label><input id="easy-pass" type="password" value={easyPass} onChange={e => setEasyPass(e.target.value)} /></details>
      <Button data-testid="admin-login" className="w-full" disabled={busy}>{busy ? t('loading') : t('login')}</Button>{error && <p role="alert" className="error">{error}</p>}
    </form></Card>
  </main>;
}
