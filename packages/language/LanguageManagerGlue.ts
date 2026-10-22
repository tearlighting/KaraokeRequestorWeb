import type { ILanguageManager, NestedKeys, TranslationParams } from "./core"
import { LanguageCore } from "./core/LanguageCore"

export class LanguageManagerGlue<TKey extends string = string, TMessage extends Record<string, any> = {}> {
  private _managerIns: ILanguageManager
  constructor(private _coreIns: LanguageCore<TKey, TMessage>, managerFactory: () => ILanguageManager) {
    this._managerIns = managerFactory()
    this._managerIns.init(this._coreIns.messages, this._coreIns.currentLocale)
  }
  get managerIns() {
    return this._managerIns
  }
  t(path: NestedKeys<TMessage>, params?: TranslationParams) {
    return this._managerIns.t(path as string, params)
  }
  setLocale(locale: TKey): void {
    this._coreIns.setLocale(locale)
    this._managerIns.setLocale(locale)
  }
  get languages() {
    return this._coreIns.locales
  }
  get currentLocale() {
    return this._coreIns.currentLocale
  }
}

export const createLanguageManagerGlue = <TKey extends string = string, TMessage extends Record<string, any> = {}>(coreIns: LanguageCore<TKey, TMessage>, managerFactory: () => ILanguageManager) =>
  new LanguageManagerGlue<TKey, TMessage>(coreIns, managerFactory)
