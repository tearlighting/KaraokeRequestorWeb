import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Link } from 'react-router-dom';
import { DanmakuPanel } from './DanmakuPanel';
import { NowPlayingCard } from './NowPlayingCard';
import { UserPlayerControls } from './UserPlayerControls';

/** User player view. Fastify limits controls to the currently active queue task. */
export function PlayerPage(){
  const t=useT();
  return <div className="user-page-stack" data-testid="user-player-page"><header className="player-page-heading"><h1>{t('userPlayerRoute')}</h1><Link to="/queue" className="player-queue-link">次の曲・キューを見る <span aria-hidden="true">›</span></Link></header><NowPlayingCard/><UserPlayerControls/><DanmakuPanel/></div>;
}
