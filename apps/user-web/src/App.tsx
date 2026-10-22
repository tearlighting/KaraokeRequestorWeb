import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { Preferences } from '../../../packages/web-foundation/src/preferences';
import { useT } from '../../../packages/web-foundation/src/i18n';
import { LocaleProvider } from './store/languageStore';
import { ThemeProvider } from './store/themeStore';
import { errorMessage, apiJson, record } from './lib/api';
import { SearchPanel } from './features/search/SearchPanel';
import type { Song } from './features/search/api';
import { ReservationForm } from './features/reservations/ReservationForm';
import { QueuePanel } from './features/queue/QueuePanel';
import { NowPlayingCard } from './features/queue/NowPlayingCard';
import { useHomePageStore } from './store/homePageStore';

function UserLayout() {
  const t = useT();
  return <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <header className="app-header mb-6 flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="brand-mark"><span className="brand-orbit">♫</span><span><small>{t('brand')}</small><strong>みんなで歌う、今日の一曲。</strong></span></Link>
      <div className="flex flex-wrap items-center gap-2"><nav aria-label="ページ" className="flex gap-1"><NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{t('home')}</NavLink><NavLink to="/queue" className={({isActive}) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{t('queue')}</NavLink></nav><Preferences /></div>
    </header>
    <NowPlayingCard />
    <Outlet />
    <footer className="mt-8 border-t border-[var(--border)] pt-5 text-xs leading-relaxed text-[var(--muted)]">予約順と再生状態はサーバーから取得しています。検索・再生の表示は実際の応答に基づきます。</footer>
  </main>;
}
function HomePage() {
  const song = useHomePageStore(state => state.song); const createdId = useHomePageStore(state => state.createdId);
  const revision = useHomePageStore(state => state.revision); const connection = useHomePageStore(state => state.connection);
  useEffect(() => { let active = true; void apiJson('/capabilities').then(value => { const features = record(value.features); if (active) useHomePageStore.setState({ connection: `Everything ${features.everything_search ? '利用可能' : '未設定'} · Lister ${features.lister_search ? '利用可能' : '未設定'}` }); }).catch(error => { if (active) useHomePageStore.setState({ connection: errorMessage(error) }); }); return () => { active = false; }; }, []);
  function onCreated(id: number) { useHomePageStore.setState(state => { state.createdId = id; state.revision += 1; }); }
  function onSelectSong(selected: Song) { useHomePageStore.setState({ song: selected, createdId: null }); window.setTimeout(() => document.getElementById('reservation-form')?.scrollIntoView({behavior:'smooth',block:'start'}), 0); }
  const t = useT();
  return <div className="mt-5 space-y-5"><h1 data-testid="user-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">{t('tagline')}</h1><p role="status" className="connection-banner">{connection}</p>{createdId !== null && <p role="status" className="success-banner"><strong>予約を受け付けました · #{createdId}</strong><span className="mt-1 block">予約内容と再生状況は、下の予約キューで確認できます。</span></p>}
    <section id="search" className="scroll-mt-5"><SearchPanel onSelect={onSelectSong} /></section>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]"><div className="min-w-0 lg:sticky lg:top-5"><ReservationForm song={song} onClear={() => useHomePageStore.setState({ song: null })} onCreated={onCreated} /></div><div className="min-w-0"><QueuePanel revision={revision} createdId={createdId} /></div></div>
  </div>;
}
function QueueRoute() { return <div className="mt-5"><QueuePanel revision={0} createdId={null} /></div>; }
function NotFound() { const t = useT(); return <section className="panel mt-8 text-center"><h1 className="text-2xl font-bold">{t('notFound')}</h1><Link className="primary mt-5 inline-flex" to="/">{t('backHome')}</Link></section>; }
function RoutedApp() { return <Routes><Route element={<UserLayout />}><Route index element={<HomePage />} /><Route path="search" element={<HomePage />} /><Route path="queue" element={<QueueRoute />} /><Route path="*" element={<NotFound />} /></Route></Routes>; }
export function App() { const basename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, ''); return <ThemeProvider><LocaleProvider><BrowserRouter basename={basename}><RoutedApp /></BrowserRouter></LocaleProvider></ThemeProvider>; }
