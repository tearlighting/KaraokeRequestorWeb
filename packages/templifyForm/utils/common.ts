import type {
    I18nResolveCxt,
    IResolvableValueRestable,
    LabelInput,
} from 'templify-form';

import {
    ResolvableValue,
    ResolvableValueRestable,
} from '../core';

export function toResolvable<TCtx>(val: LabelInput<TCtx>): ResolvableValue<TCtx> {
    if (typeof val === "function") {
        return new ResolvableValue<TCtx>("", val)
    } else if (typeof val === "string") {
        return new ResolvableValue<TCtx>(val)
    }
    return val
}

export function toResolvableRestable<TCtx>(val: LabelInput<TCtx>): ResolvableValue<TCtx> & IResolvableValueRestable {
    if (typeof val === "function") {
        return new ResolvableValueRestable<TCtx>("", val)
    } else if (typeof val === "string") {
        return new ResolvableValueRestable<TCtx>(val)
    }
    if (isResolvableValueRestable(val)) return val
    throw new Error("Invalid value type")
}

export function resolvable<TCtx>(val: string, transformer: (ctx: TCtx, val: string) => string): ResolvableValue<TCtx> {
    return new ResolvableValue<TCtx>(val, transformer)
}

export const createResolvable = <T>() => resolvable<T>

export const createResolveI18n = createResolvable<I18nResolveCxt>()

export const isResolvableValueRestable = (obj: any): obj is IResolvableValueRestable => {
    return obj?.rest && typeof obj.rest === "function" && obj?.show && typeof obj.show === "function"
}

const resolvedPromise = Promise.resolve()
export const nextTick = (fn?: () => void) => {
    return fn ? resolvedPromise.then(fn) : resolvedPromise
}