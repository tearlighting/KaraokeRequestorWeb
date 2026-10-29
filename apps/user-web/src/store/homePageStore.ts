import { createUseReactiveStore } from '../../../../packages/reactiveStore';
import type { Song } from '../features/search/api';

type HomePageState = {
  song: Song | null;
  createdId: number | null;
  createdFor: string;
  revision: number;
  connection: string;
  roomName: string;
};

export const useHomePageStore = createUseReactiveStore<HomePageState>(() => ({
  song: null,
  createdId: null,
  createdFor: '',
  revision: 0,
  connection: '曲庫への接続を確認しています…',
  roomName: '',
}));
