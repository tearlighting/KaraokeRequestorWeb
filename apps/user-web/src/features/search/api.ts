import { ApiError, apiJson, record } from '../../lib/api';

export type Backend = 'everything' | 'lister';
export interface Song {
  name: string;
  fullpath: string;
  artist: string;
  size: number;
}
export interface SearchResult { items: Song[]; total: number }

export async function searchSongs(keyword: string, backend: Backend): Promise<SearchResult> {
  const params = new URLSearchParams({ backend, keyword });
  const data = await apiJson(`/search?${params}`);
  if (!Array.isArray(data.items) || typeof data.total !== 'number') throw new ApiError('搜索接口缺少 items 或 total');
  const items: Song[] = [];
  for (const entry of data.items) {
    const item = record(entry);
    if (backend === 'everything') {
      if (typeof item.name !== 'string' || typeof item.fullpath !== 'string') throw new ApiError('搜索结果缺少文件名或完整路径');
      items.push({ name: item.name, fullpath: item.fullpath, size: Number(item.size ?? 0), artist: '' });
    } else {
      if (!Array.isArray(item.files)) throw new ApiError('Lister 搜索结果缺少 files');
      for (const entry of item.files) {
        const file = record(entry);
        if (typeof file.found_path !== 'string') throw new ApiError('Lister 搜索结果缺少 found_path');
        const basename = file.found_path.split(/[\\/]/).pop() || file.found_path;
        items.push({ name: basename, fullpath: file.found_path, artist: String(item.song_artist ?? ''), size: Number(file.found_file_size ?? 0) });
      }
    }
  }
  return { items, total: data.total };
}
