/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

// 递归遍历
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }

  // __ob__表示这个对象是响应式对象
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    // 循环引用不会递归遍历
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }

  // 深度遍历，对每一个属性递归处理，添加到 seen 中
  // 其中 val[i]、val[keys[i]] 会触发 getter 操作，触发依赖收集，会把当前的 watcher 添加到 Dep 中
  // 当 val[i]、val[keys[i]] 更新时，触发 watcher 的 update 方法
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
