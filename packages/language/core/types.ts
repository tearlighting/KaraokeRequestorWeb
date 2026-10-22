export type NestedKeys<T, P extends string = ""> =
    // 如果有 "_"，把自己算一个 key
    | ("_" extends keyof T ? (P extends "" ? never : P) : never)
    // 然后继续递归子节点
    | {
        [K in Exclude<keyof T, "_"> & string]: T[K] extends Record<string, any> ? NestedKeys<T[K], AddPrefix<K, P>> : AddPrefix<K, P>
    }[Exclude<keyof T, "_"> & string]

type AddPrefix<T extends string, P extends string> = P extends "" ? T : `${P}.${T}`

type FilterI18nKey<T extends string> = T extends `${infer R}` ? R : never

export interface ILanguageItem<TKey extends string, TMessage extends Record<string, any>> {
    value: TKey
    message: TMessage
    label?: string
}

export interface ILanguageManager {
    readonly instance: import('i18next').i18n
    setLocale(locale: string): void
    init(message: Record<string, any>, locale?: keyof typeof message): void
    t(key: string, params?: TranslationParams): string
}
export type TranslationParams = Record<string, string | number>
