/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,  // 是否是 pre 标签
  isUnaryTag, // 是否是 特殊标签
  mustUseProp, // 不同元素绑定值不同，input - value， checkbox - checked等
  canBeLeftOpenTag, // 是否是 特殊标签
  isReservedTag,  // 是否是保留字的标签
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}
