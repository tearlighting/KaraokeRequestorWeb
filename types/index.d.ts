import type { DesktopApi } from '../src/shared/ipcs'
declare global {
  interface Window { desktopApi: DesktopApi }

  interface IAddPlugin {
    (app: App<Element>): void
  }

  interface IDisposablePageStore<TPayload = never> {
    init: [TPayload] extends [never]
    ? () => void
    : (payload: TPayload) => void
    dispose(): void
  }

  interface IHasInitailStatePageReactiveStore {
    initialized: {
      current: boolean
    }
  }

  interface IRefObject<T> {
    current: T | null
  }

  type TInitParamsIntersection<T extends Record<string, IDisposablePageStore<any> | IDisposablePageStore>> =
    UnionToIntersection<
      TInitProps<T[keyof T] & {}>
    >

  type TDefaultParam<T> = [T] extends [never] | [void] | [unknown] ? {} : T

  type TAllVoid<T> =
    TInitProps<T[keyof T]> extends void ? true : false

  type TInitProps<T extends IDisposablePageStore<any>> = T extends IDisposablePageStore<infer P> ? P : never
}



export { }

