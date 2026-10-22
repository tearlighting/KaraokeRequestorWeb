import { createUseReactiveStore } from '../../../../packages/reactiveStore';
import type { Queue } from '../features/queue/api';

type QueuePageState = { queue: Queue | null; error: string; busy: boolean; updated: string };
export const useQueuePageStore = createUseReactiveStore<QueuePageState>(() => ({ queue: null, error: '', busy: false, updated: '' }));
