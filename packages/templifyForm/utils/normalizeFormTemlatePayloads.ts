import type {
  ICreateFormTemplateProps,
  INormalizedCreateFormTemplateProps,
} from 'templify-form';

import { ETemplateType } from '../constants';
import {
  toResolvable,
  toResolvableRestable,
} from './common';

const labelsTransform = (payload: ICreateFormTemplateProps<string, any, any>) => {
  const { labels, props } = payload
  for (let prop of props) {
    labels[prop] = toResolvable(labels[prop])
  }
  return payload
}
const errorsTransform = (payload: ICreateFormTemplateProps<string, any, any>) => {
  const { errors, props } = payload
  for (let prop of props) {
    errors![prop] = toResolvableRestable(errors![prop] ?? "")
  }
  return payload
}

const optionsTransform = (payload: ICreateFormTemplateProps<string, any, any>) => {
  const { options, types, props } = payload
  for (let prop of props) {
    if (types[prop] === ETemplateType.select) {
      options![prop] = (options![prop] || []).map((item) => {
        return {
          label: toResolvable(item.label),
          value: item.value,
        }
      })
    }
  }
  return payload
}

export const normalizeFormTemlatePayloads = <TProp extends string, TTypes extends Partial<Record<TProp, ETemplateType>>, TResolveCxt = any>(
  params: ICreateFormTemplateProps<TProp, TTypes, TResolveCxt>
) => {
  const { props, labels, types = {}, options = {}, readonlys = {}, errors = {}, renders = {}, formItemClassNames = {}, formItemContentClassNames = {}, formItemLabelClassNames = {} } = params
  if (props.length !== Object.keys(labels).length) throw new Error("props and labels length must be equal")
  const res = {
    props,
    labels,
    types,
    options,
    readonlys,
    errors,
    renders,
    formItemClassNames,
    formItemContentClassNames,
    formItemLabelClassNames,
  }
  return optionsTransform(errorsTransform(labelsTransform(res))) as unknown as INormalizedCreateFormTemplateProps<TProp, TTypes, TResolveCxt>
}
