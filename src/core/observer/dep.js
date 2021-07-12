/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 通过发布-订阅模式，将Watcher类型的数据添加到订阅列表中
 * notify时，循环执行订阅列表中的监听，本质是运行watcher的update方法。
 * 收集依赖
 */
export default class Dep {
  static target: ?Watcher;   //静态属性，Watcher类型
  id: number;
  subs: Array<Watcher>;   //数组类型，数组元素为Watcher类型

  constructor () {
    this.id = uid++  //唯一值
    this.subs = []
  }

  //添加到监听列表中
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  //从监听列表中移除
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  //触发监听执行
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 根据id排序
      subs.sort((a, b) => a.id - b.id)
    }

    //执行的是watcher的update方法
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
// 全局watcher
const targetStack = []

//将 watcher入栈到 targetStack中，并设置 Dep.target属于为当前 watcher
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

//执行 targetStack 的出栈操作，并将出栈元素赋值给Dep.target
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
