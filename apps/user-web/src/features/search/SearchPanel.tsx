import { useRef, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { searchSongs, type Backend } from './api';
import { useSearchPageStore } from '../../store/searchPageStore';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';

export function SearchPanel({ onSearched, compact = false }: { onSearched: () => void; compact?: boolean }) {
  const t = useT();
  const keyword = useSearchPageStore(state => state.keyword); const backend = useSearchPageStore(state => state.backend);
  const error = useSearchPageStore(state => state.error); const busy = useSearchPageStore(state => state.busy);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('yukari.recentSearches.v1') || '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 5) : []; } catch { return []; } });

  async function search(event: FormEvent) {
    event.preventDefault(); const state = useSearchPageStore.getState();
    if (!state.keyword.trim() || state.busy) return;
    const term = state.keyword.trim(); useSearchPageStore.setState({ busy: true, error: '', result: null });
    try {
      const next = await searchSongs(term, state.backend); useSearchPageStore.setState({ result: next });
      const history = [term, ...recent.filter(item => item !== term)].slice(0, 5); setRecent(history);
      try { localStorage.setItem('yukari.recentSearches.v1', JSON.stringify(history)); } catch { /* optional preference */ }
      onSearched();
    } catch (cause) { useSearchPageStore.setState({ error: errorMessage(cause) }); }
    finally { useSearchPageStore.setState({ busy: false }); }
  }

  function chooseRecent(term: string) { useSearchPageStore.setState({ keyword: term }); requestAnimationFrame(() => { const form = inputRef.current?.form; form?.requestSubmit(); }); }
  return <section className={`search-surface ${compact ? 'search-panel-compact' : ''}`} aria-label={compact ? t('searchCriteria') : t('searchTitle')}>
    <form onSubmit={search} className="search-form">
      <label className="sr-only" htmlFor={compact ? 'keyword-refine' : 'keyword'}>{t('searchHint')}</label>
      <span className="search-icon" aria-hidden="true"><Icon name="search" size={21}/></span>
      <input ref={inputRef} id={compact ? 'keyword-refine' : 'keyword'} data-testid={compact ? 'search-keyword-refine' : 'search-keyword'} value={keyword} onChange={event => useSearchPageStore.setState({ keyword: event.target.value })} maxLength={256} placeholder={t('searchHint')} required disabled={busy} enterKeyHint="search" autoComplete="off" />
      {keyword && <button type="button" className="search-clear" aria-label={t('searchClear')} onClick={() => { useSearchPageStore.setState({ keyword: '', error: '' }); inputRef.current?.focus(); }}><span aria-hidden="true">×</span></button>}
      <Button aria-label={busy ? t('searching') : t('search')} data-testid={compact ? 'search-submit-refine' : 'search-submit'} className="search-submit" disabled={busy}><Icon name="search" size={18}/><span className="search-submit-label">{busy ? t('searching') : t('search')}</span></Button>
    </form>
    <details className="search-options"><summary>{t('searchSourceLabel')}: {backend === 'everything' ? 'Everything' : 'YukaLister'}</summary><label className="sr-only" htmlFor="backend">{t('backend')}</label><select id="backend" value={backend} onChange={event => useSearchPageStore.setState({ backend: event.target.value as Backend, result: null, error: '' })} disabled={busy}><option value="everything">Everything</option><option value="lister">YukaLister</option></select></details>
    {error && <p role="alert" className="error mt-3">{t('error')}: {error}</p>}
    {!compact && recent.length > 0 && <div className="recent-searches"><p>{t('recentSearches')}</p><div>{recent.map(term => <button key={term} type="button" className="search-chip" onClick={() => chooseRecent(term)}>{term}</button>)}</div></div>}
  </section>;
}
