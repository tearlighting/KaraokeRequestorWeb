import { useCallback, useSyncExternalStore } from 'react';
import { effect, isReactive, reactive, stop } from '@vue/reactivity';

export type ISetData<T extends object> = (callback: (state: T) => void) => void;
export interface ISubscriberParams<T extends object> {
  callback: () => void;
  selector: (state: T) => unknown;
}

function trackDeep(value: unknown, visited = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object' || !isReactive(value)) return;
  if (visited.has(value)) return;
  visited.add(value);
  for (const key of Object.keys(value)) trackDeep((value as Record<string, unknown>)[key], visited);
}

export function createReactiveStore<T extends object>(initializer: (setData: ISetData<T>) => T) {
  let state!: T;
  let revision = 0;
  const pending: Array<(value: T) => void> = [];
  const setData: ISetData<T> = callback => {
    if (state) callback(state);
    else pending.push(callback);
  };
  state = reactive(initializer(setData)) as T;
  pending.forEach(callback => callback(state));

  const getState = () => state;
  const getVersion = () => revision;
  const setState = (partial: Partial<T> | ((current: T) => void)) => {
    if (typeof partial === 'function') partial(state);
    else Object.assign(state, partial);
  };
  const subscribe = ({ callback, selector }: ISubscriberParams<T>) => {
    let initial = true;
    const runner = effect(() => {
      trackDeep(selector(state));
      if (initial) initial = false;
      else { revision += 1; callback(); }
    });
    return () => stop(runner);
  };
  return { getState, getVersion, setState, subscribe };
}

export function createUseReactiveStore<T extends object>(initializer: (setData: ISetData<T>) => T) {
  const store = createReactiveStore(initializer);
  function useStoreFactory(): T;
  function useStoreFactory<S>(selector: (state: T) => S): S;
  function useStoreFactory<S>(selector?: (state: T) => S) {
    return selector ? useReactiveStore(store, selector) : useReactiveStore(store);
  }
  return Object.assign(useStoreFactory, {
    setState: store.setState,
    getState: store.getState,
    subscribe: store.subscribe,
  });
}

export function useReactiveStore<T extends object>(store: ReturnType<typeof createReactiveStore<T>>): T;
export function useReactiveStore<T extends object, S>(store: ReturnType<typeof createReactiveStore<T>>, selector: (state: T) => S): S;
export function useReactiveStore<T extends object, S>(store: ReturnType<typeof createReactiveStore<T>>, selector?: (state: T) => S) {
  const select = useCallback((state: T) => selector ? selector(state) : state, [selector]) as (state: T) => S | T;
  const subscribe = useCallback((callback: () => void) => store.subscribe({ callback, selector: select }), [store, select]);
  useSyncExternalStore(subscribe, store.getVersion, store.getVersion);
  return select(store.getState());
}
