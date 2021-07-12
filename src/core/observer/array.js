/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

/*
Vue对数组的处理：
    length是数组的一个很重要的属性，无论数组增加元素或者删除元素（通过splice，push等方法操作）length的值必定会更新，
    为什么不直接操作监听length呢？而需要拦截splice，push等方法进行数组的状态更新？
原因是：
    在数组length属性上用defineProperty拦截的时候，会报错

Object.getOwnPropertyDescriptor(arr, 'length') 显示：
{ configurable: false enumerable: false value: 0 writable: true } configurable为false
*/

// 重写数组一下的方法，使得vue对数组做响应式处理
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * aop 重写数组方法，执行Array原型中的数值方法，并做特殊处理
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]  // 原始的数组方法
  // 重新定义数组的中的方法
  def(arrayMethods, method, function mutator (...args) {
    // 执行原方法
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 数组中添加新的元素，所以需要重新观察每个子元素
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 数组变化时，触发更新
    ob.dep.notify()
    return result
  })
})
