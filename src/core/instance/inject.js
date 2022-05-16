/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

// provider的处理，如果是函数则执行，并且结果挂载在 _provider上
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}


//获取inject的值，并添加到当前实例vm上
export function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)  //响应式标志位设置为false
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        // 处理为响应式数据
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)  //响应式标志位设置为false
  }
}

export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      // 如果是响应式则不处理
      if (key === '__ob__') continue
      const provideKey = inject[key].from   //通过from属性查找，inject初始化时，统一了数据格式为object且含有from属性
      let source = vm
      //递归查找组件的provider
      while (source) {
        //判断inject注入的key是否在组件接受到的provider中。
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]  // 获取provider中提供的key-value
          break
        }
        source = source.$parent
      }

      //一直递归到根节点还没有找到 provider，则source为 undefined
      if (!source) {
        // from 属性找不到，降级查找default
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
