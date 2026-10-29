import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { useSearchPageStore } from '../../store/searchPageStore';
import { useHomePageStore } from '../../store/homePageStore';
import { SearchPanel } from './SearchPanel';
import { formatMediaTitle } from './formatMediaTitle';

let savedScroll = 0;
export function resetSearchResultsScroll() { savedScroll = 0; }

export function SearchResultsPage() {
  const t = useT();
  const navigate = useNavigate();
  const result = useSearchPageStore(state => state.result);
  const keyword = useSearchPageStore(state => state.keyword);
  const error = useSearchPageStore(state => state.error);

  useEffect(() => { window.scrollTo(0, savedScroll); }, []);

  const refine = () => { savedScroll = 0; window.scrollTo(0, 0); };
  if (error) return <section className="user-page-stack results-page">
    <SearchPanel compact onSearched={refine} />
    <div className="results-error"><p role="alert" className="error">{error}</p><button className="secondary mt-3" onClick={() => navigate('/')}>{t('backToSearch')}</button></div>
  </section>;
  if (!result) return <section className="user-page-stack results-page">
    <SearchPanel compact onSearched={refine} />
    <div className="results-empty"><EmptyState>{t('noResultsPrompt')}</EmptyState></div>
  </section>;

  return <section className="user-page-stack results-page" aria-labelledby="results-title">
    <SearchPanel compact onSearched={refine} />
    <div className="results-surface">
      <header className="results-heading">
        <h1 id="results-title" data-testid="search-results-title">{t('searchResultsTitle')}</h1>
        <p className="results-summary">{t('searchSummary', { query: keyword, count: result.total })}</p>
      </header>
      {result.items.length === 0 ? <EmptyState data-testid="search-empty">{t('noResults')}</EmptyState> : <ul className="search-results-list">{result.items.map((song, index) => <li key={`${song.fullpath}:${index}`}>
        <button type="button" className="search-result-button" aria-label={t('searchResultSongLabel', { title: formatMediaTitle(song.name) })} onClick={() => { savedScroll = window.scrollY; useHomePageStore.setState({ song, createdId: null }); navigate('/song'); }}>
          <span className="music-mark search-music-mark" aria-hidden="true">♫</span>
          <span className="min-w-0 flex-1"><strong className="block line-clamp-2 break-words">{formatMediaTitle(song.name)}</strong>{song.artist && <span className="mt-1 block truncate text-sm text-[var(--muted)]">{song.artist}</span>}</span>
          <span className="result-meta">{song.size > 0 ? `${(song.size / 1024 / 1024).toFixed(0)} MB` : ''}</span>
          <span aria-hidden="true" className="search-result-chevron">›</span>
        </button>
      </li>)}</ul>}
    </div>
  </section>;
}
