/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 将全局的  mixin 与 当前 Vue 的 options 合并
    this.options = mergeOptions(this.options, mixin)
    return this
  }

  console.log('0-8','在Vue对象上添加静态方法mixin');
}
