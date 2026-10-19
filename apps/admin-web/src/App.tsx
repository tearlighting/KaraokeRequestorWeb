import { useMemo, useState } from 'react';
import { adminClient, logout, message, type Session } from './lib/admin';
import { Login } from './features/auth/Login';
import { QueuePage } from './features/queue/QueuePage';
import { SystemPage } from './features/system/SystemPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  const [auth, setAuth] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('queue');
  const client = useMemo(() => auth ? adminClient() : null, [auth]);
  async function signOut() { try { await logout(); setAuth(null); setPage('queue'); setError(''); } catch (error) { setError(message(error)); } }
  if (!auth || !client) return <Login onLogin={setAuth} />;
  return <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]"><aside className="border-b border-slate-200 bg-slate-950 p-5 text-white lg:min-h-screen"><p className="text-xs font-bold tracking-[0.25em] text-indigo-300">YUKARI / ADMIN</p><h1 className="mt-3 text-xl font-bold">现场管理</h1>
    <nav aria-label="管理导航" className="mt-6 flex flex-wrap gap-2 lg:flex-col">{Object.entries({ queue: '预约队列', system: '系统与播放器', settings: '管理设置' }).map(([key, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} className={`rounded-xl px-4 py-3 text-left text-sm ${page === key ? 'bg-indigo-600' : 'text-slate-300 hover:bg-slate-800'}`} onClick={() => setPage(key)}>{label}</button>)}</nav>
    <button className="mt-6 text-sm text-slate-300 underline" onClick={() => void signOut()}>退出管理端</button></aside>
    <main className="mx-auto w-full max-w-5xl min-w-0 p-4 sm:p-8"><header className="mb-6"><p className="text-sm text-slate-500">管理员 / {auth.username}</p><h2 className="mt-2 text-3xl font-bold">让现场井然有序</h2></header>
      {error && <p role="alert" className="error mb-5">{error}</p>}
      {page === 'queue' ? <QueuePage client={client} /> : page === 'system' ? <SystemPage client={client} /> : <SettingsPage client={client} />}
    </main></div>;
}
