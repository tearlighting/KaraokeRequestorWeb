import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Link } from 'react-router-dom';
import { DanmakuPanel } from './DanmakuPanel';
import { NowPlayingCard } from './NowPlayingCard';
import { UserPlayerControls } from './UserPlayerControls';

/** User controls remain scoped by Fastify to the currently active playback task. */
export function PlayerPage() {
  const t = useT();
  return <div className="user-page-stack player-page" data-testid="user-player-page">
    <header className="player-page-heading"><div><p className="eyebrow">YUKARI · PLAYER</p><h1>{t('userPlayerRoute')}</h1></div><Link to="/queue" className="player-queue-link">{t('nextRequest')} · {t('queueView')} <span aria-hidden="true">›</span></Link></header>
    <div className="player-stage"><NowPlayingCard /><UserPlayerControls /></div>
    <DanmakuPanel />
  </div>;
}
