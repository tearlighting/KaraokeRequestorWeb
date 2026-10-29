import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Preferences } from '../../../packages/web-foundation/src/preferences';
import { useT } from '../../../packages/web-foundation/src/i18n';
import { LocaleProvider } from './store/languageStore';
import { ThemeProvider } from './store/themeStore';
import { Login } from './features/auth/Login';
import { QueuePage } from './features/queue/QueuePage';
import { SystemPage } from './features/system/SystemPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { PlaybackPage } from './features/playback/PlaybackPage';
import { ParticipantsPage } from './features/participants/ParticipantsPage';
import { currentSession, adminClient, logout, message, type Session } from './lib/admin';

function AdminRoutes() {
  const [auth, setAuth] = useState<Session | null>(null); const [checked, setChecked] = useState(false); const [error, setError] = useState('');
  const client = useMemo(() => auth ? adminClient() : null, [auth]); const location = useLocation(); const navigate = useNavigate(); const t = useT();
  useEffect(() => { let active = true; void currentSession().then(session => { if (active) setAuth(session); }).catch(() => { if (active) setAuth(null); }).finally(() => { if (active) setChecked(true); }); return () => { active = false; }; }, []);
  async function signOut() { try { await logout(); setAuth(null); setError(''); navigate('/login', {replace:true}); } catch (cause) { setError(message(cause)); } }
  if (!checked) return <main className="mx-auto max-w-xl p-8"><p role="status" className="panel">{t('loading')}</p></main>;
  if (location.pathname === '/login') return auth ? <Navigate to="/" replace /> : <Login onLogin={session => { setAuth(session); navigate('/', {replace:true}); }} />;
  if (!auth || !client) return <Navigate to="/login" replace state={{from: location.pathname}} />;
  return <div className="admin-shell min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="admin-sidebar"><Link to="/" className="brand-mark admin-brand"><span className="brand-orbit">♫</span><span><small>YUKARI / ADMIN</small><strong>{t('adminTitle')}</strong></span></Link>
      <nav aria-label="管理ナビゲーション" className="mt-6 flex flex-wrap gap-2 lg:flex-col"><NavLink data-testid="admin-nav-queue" end to="/" className={({isActive})=>`admin-nav-item ${isActive?'admin-nav-current':''}`}>{t('queueManage')}</NavLink><NavLink data-testid="admin-nav-playback" to="/playback" className={({isActive})=>`admin-nav-item ${isActive?'admin-nav-current':''}`}>{t('playbackRoute')}</NavLink><NavLink data-testid="admin-nav-participants" to="/participants" className="admin-nav-item">{"\u53c2\u52a0\u8005"}</NavLink><NavLink data-testid="admin-nav-system" to="/system" className={({isActive})=>`admin-nav-item ${isActive?'admin-nav-current':''}`}>{t('diagnostics')}</NavLink><NavLink data-testid="admin-nav-settings" to="/settings" className={({isActive})=>`admin-nav-item ${isActive?'admin-nav-current':''}`}>{t('settings')}</NavLink></nav>
      <div className="mt-6 border-t border-white/10 pt-5"><p className="text-xs text-slate-400">{auth.username}</p><button className="mt-3 text-sm text-slate-300 underline" onClick={() => void signOut()}>{t('logout')}</button><div className="mt-4"><Preferences /></div></div>
    </aside>
      <nav aria-label="Admin" className="admin-mobile-nav" data-testid="admin-mobile-nav"><NavLink to="/playback">{"\u518d\u751f"}</NavLink><NavLink end to="/">{"\u30ad\u30e5\u30fc"}</NavLink><NavLink to="/participants">{"\u53c2\u52a0\u8005"}</NavLink><NavLink to="/settings">{"\u8a2d\u5b9a"}</NavLink></nav>
    <main className="admin-main mx-auto w-full max-w-none min-w-0 p-4 sm:p-7 xl:p-9"><header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">YUKARI · KARAOKE</p><h1 data-testid="admin-page-title" className="mt-2 text-3xl font-bold tracking-tight">{location.pathname === '/system' ? t('systemTitle') : location.pathname === '/settings' ? t('settingsTitle') : location.pathname === '/playback' ? t('playbackRoute') : location.pathname === '/participants' ? 'Participants' : t('queueManage')}</h1></div><Link data-testid="admin-show-request-qr" to="/system?showQr=1" className="primary inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap"><span aria-hidden="true">QR</span>点歌二维码を表示</Link></header>{error && <p role="alert" className="error mb-5">{error}</p>}
      <Routes><Route path="/" element={<QueuePage client={client} />} /><Route path="/playback" element={<PlaybackPage client={client} />} /><Route path="/participants" element={<ParticipantsPage client={client} />} /><Route path="/system" element={<SystemPage client={client} />} /><Route path="/settings" element={<SettingsPage client={client} onLogout={signOut} />} /><Route path="*" element={<AdminNotFound />} /></Routes>
    </main>
  </div>;
}
function AdminNotFound() { const t = useT(); return <section className="panel"><h2 className="text-xl font-bold">{t('notFound')}</h2><Link to="/" className="primary mt-4 inline-flex">{t('backHome')}</Link></section>; }
export function App() { const basename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, ''); return <ThemeProvider><LocaleProvider><BrowserRouter basename={basename}><AdminRoutes /></BrowserRouter></LocaleProvider></ThemeProvider>; }
