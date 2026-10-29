import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useT } from '../../../packages/web-foundation/src/i18n';
import { LocaleProvider } from './store/languageStore';
import { ThemeProvider } from './store/themeStore';
import { errorMessage, apiJson, record } from './lib/api';
import { SearchPanel } from './features/search/SearchPanel';
import { SearchResultsPage, resetSearchResultsScroll } from './features/search/SearchResultsPage';
import { formatMediaTitle } from './features/search/formatMediaTitle';
import { ReservationForm } from './features/reservations/ReservationForm';
import { recoverPendingReservations } from './features/reservations/api';
import { PlayerPage } from './features/queue/PlayerPage';
import { QueuePanel } from './features/queue/QueuePanel';
import { MyPage } from './features/participants/MyPage';
import { loadParticipantProfile } from './features/participants/api';
import { setParticipantProfile } from './store/participantStore';
import { useParticipantStore } from './store/participantStore';
import { useHomePageStore } from './store/homePageStore';

const tabs = [
  { to: '/', label: 'ホーム', icon: 'home' as const, end: true },
  { to: '/player', label: 'プレイヤー', icon: 'player' as const },
  { to: '/queue', label: 'キュー', icon: 'queue' as const },
  { to: '/me', label: 'マイページ', icon: 'person' as const },
];

function UserLayout() {
  const t = useT();
  const roomName = useHomePageStore(state => state.roomName);
  useEffect(() => {
    let active = true;
    try { localStorage.removeItem('yukari.selectedParticipant.v1'); } catch { /* storage may be disabled */ }
    const recover = async () => {
      const recovered = await recoverPendingReservations();
      if (active && recovered.length) useHomePageStore.setState(state => { state.createdId = recovered[recovered.length - 1]!.id; state.revision += recovered.length; });
    };
    void apiJson('/capabilities').then(async value => {
      const features = record(value.features); const server = record(value.server);
      if (active) useHomePageStore.setState({ connection: `Everything ${features.everything_search ? '利用可能' : '未設定'} · YukaLister ${features.lister_search ? '利用可能' : '未設定'}`, roomName: typeof server.room_name === 'string' ? server.room_name : '' });
      await recover();
    }).catch(error => { if (active) useHomePageStore.setState({ connection: errorMessage(error) }); });
    void loadParticipantProfile().then(value => { if (active) setParticipantProfile(value); }).catch(error => { if (active) useParticipantStore.setState({ loading: false, error: errorMessage(error) }); });
    const online = () => { void recover().catch(() => {}); };
    window.addEventListener('online', online);
    return () => { active = false; window.removeEventListener('online', online); };
  }, []);

  return <div className="user-app-shell">
    <header className="user-topbar">
      <Link to="/" className="user-brand" aria-label="Yukari ホーム"><span className="brand-orbit" aria-hidden="true">Y</span><strong>Yukari</strong></Link>
      {roomName && <span data-testid="room-name" className="room-chip">{roomName}</span>}
      <nav aria-label="メインナビゲーション" className="user-desktop-nav">{tabs.map(tab => <NavLink key={tab.to} end={'end' in tab ? tab.end : false} to={tab.to}>{tab.label}</NavLink>)}</nav>
    </header>
    <main className="user-main"><Outlet /></main>
    <nav aria-label="メイン" className="user-bottom-nav" data-testid="user-bottom-nav">
      {tabs.map(tab => <NavLink key={tab.to} end={'end' in tab ? tab.end : false} to={tab.to} className={({ isActive }) => isActive ? 'active' : ''}>
        <TabIcon name={tab.icon} /><span>{tab.label}</span>
      </NavLink>)}
    </nav>
  </div>;
}

function TabIcon({ name }: { name: 'home' | 'player' | 'queue' | 'person' }) {
  const common = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'home') return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
  if (name === 'player') return <svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === 'queue') return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

function HomePage() {
  const connection = useHomePageStore(state => state.connection);
  const profile = useParticipantStore(state => state.profile);
  const participantLoading = useParticipantStore(state => state.loading);
  const navigate = useNavigate();
  return <section className="user-home" aria-labelledby="home-title">
    <div className="home-heading"><h1 id="home-title">歌いたい曲を探す</h1>{!participantLoading && !profile?.displayName && <Link to="/me" className="participant-setup-callout">点歌人の名前を設定 <span aria-hidden="true">›</span></Link>}</div>
    <SearchPanel onSearched={() => { resetSearchResultsScroll(); navigate('/search/results'); }} />
    <details className="connection-details"><summary>検索の接続状態</summary><p role="status">{connection}</p></details>
  </section>;
}

function QueuePage() {
  const revision = useHomePageStore(state => state.revision); const createdId = useHomePageStore(state => state.createdId);
  return <section className="user-page-stack" data-testid="user-queue-page"><header className="user-page-heading"><h1>キュー</h1><p>この部屋の再生順</p></header><QueuePanel revision={revision} createdId={createdId} /></section>;
}

function SongDetailPage() {
  const song = useHomePageStore(state => state.song); const createdId = useHomePageStore(state => state.createdId); const createdFor = useHomePageStore(state => state.createdFor); const revision = useHomePageStore(state => state.revision);
  const profile = useParticipantStore(state => state.profile); const participantId = profile?.id || ''; const participantName = profile?.displayName || ''; const navigate = useNavigate();
  if (!song) return <Navigate to="/search/results" replace />;
  function onCreated(id: number, name: string) { useHomePageStore.setState(state => { state.createdId = id; state.createdFor = name; state.revision += 1; }); navigate('/queue'); }
  return <section className="user-page-stack" data-testid="song-detail">
    <button type="button" data-testid="song-detail-back" className="back-link" onClick={() => navigate(-1)}>‹ 検索結果へ戻る</button>
    <header className="song-detail-heading"><span className="music-mark" aria-hidden="true">♫</span><div className="min-w-0"><h1>{formatMediaTitle(song.name)}</h1>{song.artist && <p>{song.artist}</p>}</div></header>
    <details className="raw-media-name"><summary>ファイル情報</summary><p>{song.name}</p>{song.size > 0 && <p>{(song.size / 1024 / 1024).toFixed(0)} MB</p>}</details>
    <ReservationForm song={song} participantId={participantId} participantName={participantName} resetKey={createdId} onClear={() => { useHomePageStore.setState({ song: null }); navigate('/search/results'); }} onCreated={onCreated} />
    {createdId !== null && <section className="success-banner" data-testid="reservation-feedback" role="status"><strong>予約を受け付けました · #{createdId}</strong><p className="mt-1">点歌人: {createdFor || participantName}</p><p className="mt-2 text-sm text-[var(--muted)]">キューはサーバーから確認できます。</p><Link className="secondary mt-3 inline-flex" to="/queue">キューを見る</Link></section>}
    <p className="sr-only">更新 {revision}</p>
  </section>;
}

function NotFound() { const t = useT(); return <section className="panel text-center"><h1 className="text-xl font-bold">{t('notFound')}</h1><Link className="primary mt-4 inline-flex" to="/">{t('backHome')}</Link></section>; }
function RoutedApp() { return <Routes><Route element={<UserLayout />}><Route index element={<HomePage />} /><Route path="search" element={<HomePage />} /><Route path="search/results" element={<SearchResultsPage />} /><Route path="song" element={<SongDetailPage />} /><Route path="player" element={<PlayerPage />} /><Route path="queue" element={<QueuePage />} /><Route path="me" element={<MyPage />} /><Route path="*" element={<NotFound />} /></Route></Routes>; }
export function App() { const basename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, ''); return <ThemeProvider><LocaleProvider><BrowserRouter basename={basename}><RoutedApp /></BrowserRouter></LocaleProvider></ThemeProvider>; }
