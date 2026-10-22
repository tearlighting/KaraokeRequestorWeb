

declare module "reactive-store" {

    import type { createUseReactiveStore } from "@/shared/reactiveStore"
    export interface ISetData<T extends object> {
        (callback: (state: T) => void): void
    }

    export interface ISubscriberParams<T extends object> {
        /**
         * the callback of React's useSyncExternalStore
         *
         */
        callback: () => void
        /**
         *
         * the selector to get snapshot
         * @returns
         */
        selector: (s: T) => any
    }

    export type TUseRectiveStoreIns<T extends {}> = ReturnType<typeof createUseReactiveStore<T>>

}