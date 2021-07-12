/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// Vue上添加静态属性和静态方法
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  //不能直接修改 Vue.config 的全局变量
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 设置全局的 set、 delete 方法，同vm实例的 $set、 $delete 方法
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // 全局添加 observable 方法
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  // 初始化 Vue.options 的'component','directive', 'filter' 属性为空对象
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 指向自己
  Vue.options._base = Vue

  //添加keep-live组件到Vue.options.components中
  extend(Vue.options.components, builtInComponents)


  console.log('0-6','在Vue对象上添加静态方法util、set、delete、nextTick、observable，添加静态属性options');

  initUse(Vue)  // Vue.use()
  initMixin(Vue) // Vue.mixin()
  initExtend(Vue) // Vue.extend
  initAssetRegisters(Vue)  // 注册组件、指令、过滤器
}
