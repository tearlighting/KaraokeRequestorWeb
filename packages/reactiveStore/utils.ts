import { reactive } from '@vue/reactivity';

export type PageStore<P = void> = { init: (payload: P) => void; dispose(): void };
export function mergeDisposeOnly<T extends Record<string, PageStore<any>>>(stores: T) {
  const init = (payload?: unknown) => Object.values(stores).forEach(store => (store.init as (value?: unknown) => void)(payload));
  const dispose = () => Object.values(stores).forEach(store => store.dispose());
  return { init, dispose, ...stores };
}
export function withMergeDispose<T extends Record<string, PageStore<any>>>(stores: T) {
  const initialized = reactive({ current: false });
  const { init, dispose, ...rest } = mergeDisposeOnly(stores);
  return {
    initialized,
    ...rest,
    init(payload?: unknown) {
      if (initialized.current) return;
      initialized.current = true;
      init(payload);
    },
    dispose() {
      if (!initialized.current) return;
      initialized.current = false;
      dispose();
    },
  };
}
