/* @flow */

import { toArray } from '../util/index'

// 给Vue对象添加全局方法use
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 如果plugin已经存在，则不处理
    // 如果多次注册同一个plugin，则他们指向的同一个引用，则indexOf能识别是同一个对象
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 获取插件注册时的参数
    const args = toArray(arguments, 1)
    // 将Vue对象作为插件的第一个参数
    args.unshift(this)
    // 如果插件的有install方法，立即执行
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果插件本身是个函数，则也立即执行
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }

  console.log('0-7','在Vue对象上添加静态方法use');
}
