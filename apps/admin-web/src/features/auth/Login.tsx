import { useState, type FormEvent } from 'react';
import { login, message, type Session } from '../../lib/admin';

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [easyPass, setEasyPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    const credentials = { username, password, easyPass };
    try { const session = await login(credentials); setPassword(''); setEasyPass(''); onLogin(session); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-4 py-16"><p className="text-xs font-bold tracking-widest text-indigo-700">YUKARI / ADMIN</p>
    <h1 className="my-4 text-3xl font-bold">管理你的现场</h1>
    <p className="mb-6 text-sm text-slate-500">使用原版 admin 账号及非空管理密码登录。密码仅用于验证，后续使用会话。</p>
    <form className="panel space-y-4" onSubmit={submit}>
      <div><label className="label" htmlFor="username">管理员账号</label><input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
      <div><label className="label" htmlFor="password">管理密码</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
      <details><summary className="text-sm text-slate-500">另外启用了访问口令？</summary><label className="label mt-3" htmlFor="easy-pass">原版访问口令</label><input id="easy-pass" type="password" value={easyPass} onChange={(event) => setEasyPass(event.target.value)} /></details>
      <button className="primary w-full" disabled={busy}>{busy ? '正在认证…' : '登录管理端'}</button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  </main>;
}
