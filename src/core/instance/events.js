/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

// 事件初始化
export function initEvents (vm: Component) {
  vm._events = Object.create(null)   //存储事件
  vm._hasHookEvent = false
  // init parent attached events
  // 初始化父类的事件（可以忽略）
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 对多个事件同事绑定一个事件时
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 以事件名称为 key, 存储在 vm._events
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // 用户绑定的事件是 fn: vm.$once('eventName',fn), 而 $once 处理后，在 vm._events 存储的 {'eventName': [on]}
  // 如果用户在 $emit 之前，解绑事件时： vm.$off('eventName',fn), 会导致在  vm._events 中找不到对应的事件
  //  on.fn = fn  就是为了解决上述问题。
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 执行时，先解绑事件，然后执行 callback
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 如果没有提供参数，则移除所有的事件监听器；
    if (!arguments.length) {
      vm._events = Object.create(null)   // 清空event
      return vm
    }
    // array of events
    // 如果提供了多个事件名称，则清除这些事件绑定
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    // 没有 callback
    if (!cbs) {
      return vm
    }
    // 如果只提供了事件，则移除该事件所有的监听器
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    // 如果同时提供了事件与回调，则只移除这个回调的监听器。
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      // cb.fn === fn 就是为了解决 $once 中对 fn处理后（变为 on），vm._events中存储事件不一致的问题
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 对事件名称的规范： 不要使用驼峰命名事件，用小写连字符命名事件
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)  // 获取第一个入参（事件名）之后的 入参。
      const info = `event handler for "${event}"`
      // 依次执行event 对应的回调，并将参数 args 传入回调函数
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }

  console.log('0-3', '在Vue.prototype添加$on、$once、$off、$emit等方法');
}
