type MakeOptional<T, K extends keyof T> = {
    [k in keyof T as k extends K ? never : k]: T[k]
} & {
    [k in K]?: T[k]
}

type EnumToInterface<T extends Record<string, string>, R extends Partial<Record<keyof T, any>> = {}> = {
    [k in keyof T]: k extends keyof R ? R[k] : string
}

type ArrayKey<T extends string[] | readonly string[]> = T extends (infer R)[] ? R : T extends readonly (infer R)[] ? R : never

type ArrayItem<T extends any[]> = T extends (infer R)[] ? R : never

type Debug<T> = T

type EnumKey<T extends Record<string, string>> = keyof T

type PromsiseValue<T extends Promise<any>> = T extends Promise<infer R> ? R : never

type PromiseType<T> = T extends Promise<infer R> ? R : T

type TValidateInfo = { res: true } | { res: false; message: string }
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never