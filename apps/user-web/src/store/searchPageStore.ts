import { createUseReactiveStore } from '../../../../packages/reactiveStore';
import type { Backend, SearchResult } from '../features/search/api';

type SearchPageState = {
  keyword: string;
  backend: Backend;
  result: SearchResult | null;
  error: string;
  busy: boolean;
};

export const useSearchPageStore = createUseReactiveStore<SearchPageState>(() => ({
  keyword: '', backend: 'everything', result: null, error: '', busy: false,
}));
