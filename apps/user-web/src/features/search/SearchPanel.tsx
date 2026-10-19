import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../lib/api';
import { searchSongs, type Backend, type SearchResult, type Song } from './api';

export function SearchPanel({ onSelect }: { onSelect: (song: Song) => void }) {
  const [keyword, setKeyword] = useState('');
  const [backend, setBackend] = useState<Backend>('everything');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!keyword.trim() || busy) return;
    setBusy(true); setError(''); setResult(null);
    try { setResult(await searchSongs(keyword.trim(), backend)); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <section className="panel" aria-labelledby="search-title">
    <h2 id="search-title" className="text-xl font-bold">找一首想唱的歌</h2>
    <p className="mt-2 text-sm text-slate-500">搜索已连接的本地曲库，选择文件后预约。</p>
    <form onSubmit={search} className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <div>
        <label htmlFor="keyword" className="field-label">歌曲或关键词</label>
        <input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={256} placeholder="输入歌名、歌手或文件名" required disabled={busy} />
      </div>
      <div>
        <label htmlFor="backend" className="field-label">曲库来源</label>
        <select id="backend" value={backend} onChange={(e) => { setBackend(e.target.value as Backend); setResult(null); setError(''); }} disabled={busy}>
          <option value="everything">Everything</option><option value="lister">Lister 曲库</option>
        </select>
      </div>
      <button className="primary sm:self-end" disabled={busy}>{busy ? '搜索中…' : '搜索歌曲'}</button>
    </form>
    {error && <p role="alert" className="error mt-4">{error}</p>}
    <div aria-live="polite" className="mt-5">
      {result && <p className="mb-3 text-sm text-slate-500">后端匹配 {result.total} 首，本次返回 {result.items.length} 个文件。</p>}
      {result?.items.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">没有返回歌曲。请确认关键词和曲库连接；空结果不代表播放器已连接。</p>}
      <ul className="divide-y divide-slate-100">
        {result?.items.map((song) => <li key={song.fullpath} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="break-words font-semibold">{song.name}</p>
            {song.artist && <p className="mt-1 text-sm text-slate-500">{song.artist}</p>}
            <p className="mt-1 break-all text-xs text-slate-500">{song.fullpath}</p>
          </div>
          <button className="secondary shrink-0" onClick={() => onSelect(song)}>选择预约</button>
        </li>)}
      </ul>
    </div>
  </section>;
}
