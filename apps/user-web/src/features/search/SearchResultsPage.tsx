import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { useSearchPageStore } from '../../store/searchPageStore';
import { useHomePageStore } from '../../store/homePageStore';
import { SearchPanel } from './SearchPanel';
import { formatMediaTitle } from './formatMediaTitle';

let savedScroll=0;
export function resetSearchResultsScroll(){savedScroll=0;}
export function SearchResultsPage(){
  const t=useT();const navigate=useNavigate();const result=useSearchPageStore(state=>state.result);const keyword=useSearchPageStore(state=>state.keyword);const error=useSearchPageStore(state=>state.error);
  useEffect(()=>{window.scrollTo(0,savedScroll);},[]);
  if(error)return <section className="user-page-stack"><SearchPanel compact onSearched={()=>{savedScroll=0;window.scrollTo(0,0);}}/><div className="panel"><p role="alert" className="error">{error}</p><button className="secondary mt-3" onClick={()=>navigate('/')}>検索ページへ戻る</button></div></section>;
  if(!result)return <section className="user-page-stack"><SearchPanel compact onSearched={()=>{savedScroll=0;window.scrollTo(0,0);}}/><div className="panel"><p>検索結果はありません。キーワードを入力して検索してください。</p></div></section>;
  return <section className="user-page-stack" aria-labelledby="results-title"><SearchPanel compact onSearched={()=>{savedScroll=0;window.scrollTo(0,0);}}/><div className="results-surface"><header className="results-heading"><h1 id="results-title" data-testid="search-results-title">検索結果</h1><p className="break-all">「{keyword}」 · {t('resultCount',{total:result.total,shown:result.items.length})}</p></header>
    {result.items.length===0?<EmptyState data-testid="search-empty">{t('noResults')}</EmptyState>:<ul className="search-results-list">{result.items.map((song,index)=><li key={`${song.fullpath}:${index}`}><button type="button" className="search-result-button" aria-label={`${formatMediaTitle(song.name)} の詳細`} onClick={()=>{savedScroll=window.scrollY;useHomePageStore.setState({song,createdId:null});navigate('/song');}}><span className="music-mark search-music-mark" aria-hidden="true">♫</span><span className="min-w-0 flex-1"><strong className="block line-clamp-2 break-words">{formatMediaTitle(song.name)}</strong>{song.artist&&<span className="mt-1 block truncate text-sm text-[var(--muted)]">{song.artist}</span>}</span><span className="result-meta">{song.size>0?`${(song.size/1024/1024).toFixed(0)} MB`:''}</span><span aria-hidden="true" className="search-result-chevron">›</span></button></li>)}</ul>}
    <button type="button" className="secondary min-h-11" onClick={()=>navigate('/')}>検索を変更</button>
  </div></section>;
}
