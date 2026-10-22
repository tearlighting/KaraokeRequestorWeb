import { createUseReactiveStore } from '../../../../packages/reactiveStore';

type QueuePageState = { selected: number[] };
export const useQueuePageStore = createUseReactiveStore<QueuePageState>(() => ({ selected: [] }));
