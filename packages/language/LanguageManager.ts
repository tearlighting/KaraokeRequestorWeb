import { createInstance, type i18n } from 'i18next'
import type { ILanguageManager, TranslationParams } from './core'

export class LanguageManager implements ILanguageManager {
  private _i18nIns: i18n | null = null
  get instance(): i18n {
    if (!this._i18nIns) throw new Error('LanguageManager is not initialized')
    return this._i18nIns
  }
  init(messages: Record<string, Record<string, unknown>>, defaultLocale?: string): this {
    const locale = defaultLocale ?? Object.keys(messages)[0]
    if (!locale || !messages[locale]) throw new Error('A registered default locale is required')
    this._i18nIns = createInstance()
    void this._i18nIns.init({
      resources: Object.fromEntries(Object.entries(messages).map(([key, translation]) => [key, { translation }])),
      lng: locale, fallbackLng: messages.ja ? 'ja' : locale, supportedLngs: Object.keys(messages),
      initAsync: false, interpolation: { prefix: '{', suffix: '}', escapeValue: false }
    })
    return this
  }
  setLocale(locale: string): void {
    if (!this.instance.hasResourceBundle(locale, 'translation')) throw new Error(`Unknown locale: ${locale}`)
    void this.instance.changeLanguage(locale)
  }
  t(path: string, params?: TranslationParams): string {
    const key = this.instance.exists(`${path}._`) ? `${path}._` : path
    return this.instance.t(key, { ...params, defaultValue: path, returnObjects: false })
  }
}
export const createLanguageManager = (): LanguageManager => new LanguageManager()
