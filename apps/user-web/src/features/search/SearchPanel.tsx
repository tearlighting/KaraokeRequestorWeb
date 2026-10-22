import type { FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { searchSongs, type Backend, type SearchResult, type Song } from './api';
import { useSearchPageStore } from '../../store/searchPageStore';

export function SearchPanel({ onSelect }: { onSelect: (song: Song) => void }) {
  const t = useT();
  const keyword = useSearchPageStore(state => state.keyword); const backend = useSearchPageStore(state => state.backend);
  const result = useSearchPageStore(state => state.result); const error = useSearchPageStore(state => state.error); const busy = useSearchPageStore(state => state.busy);
  async function search(event: FormEvent) { event.preventDefault(); const state = useSearchPageStore.getState(); if (!state.keyword.trim() || state.busy) return; useSearchPageStore.setState({ busy: true, error: '', result: null }); try { useSearchPageStore.setState({ result: await searchSongs(state.keyword.trim(), state.backend) }); } catch (cause) { useSearchPageStore.setState({ error: errorMessage(cause) }); } finally { useSearchPageStore.setState({ busy: false }); } }
  return <section className="panel" aria-labelledby="search-title">
    <p className="eyebrow">{t('home')}</p><h2 id="search-title" className="text-xl font-bold">{t('searchTitle')}</h2><p className="mt-2 text-sm text-slate-500">{t('searchIntro')}</p>
    <form onSubmit={search} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
      <div className="min-w-0"><label htmlFor="keyword" className="field-label">{t('searchHint')}</label><input id="keyword" data-testid="search-keyword" value={keyword} onChange={e => useSearchPageStore.setState({ keyword: e.target.value })} maxLength={256} placeholder={t('searchHint')} required disabled={busy} /></div>
      <div><label htmlFor="backend" className="field-label">{t('backend')}</label><select id="backend" value={backend} onChange={e => useSearchPageStore.setState({ backend: e.target.value as Backend, result: null, error: '' })} disabled={busy}><option value="everything">Everything</option><option value="lister">YukaLister</option></select></div>
      <Button data-testid="search-submit" className="sm:self-end" disabled={busy}>{busy ? t('searching') : t('search')}</Button>
    </form>
    {error && <p role="alert" className="error mt-4">{t('error')}: {error}</p>}
    <div aria-live="polite" className="mt-5">{result && <p className="mb-3 text-sm text-slate-500">{t('resultCount', { total: result.total, shown: result.items.length })}</p>}
      {result?.items.length === 0 && <p data-testid="search-empty" className="empty-state">{t('noResults')}</p>}
      <ul className="divide-y divide-slate-100">{result?.items.map(song => <li key={song.fullpath} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-semibold">{song.name}</p>{song.artist && <p className="mt-1 text-sm text-slate-500">{song.artist}</p>}</div><Button tone="secondary" className="shrink-0" onClick={() => onSelect(song)}>{t('choose')}</Button></li>)}</ul>
    </div>
  </section>;
}
