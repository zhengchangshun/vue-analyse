/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 定义 Watcher 类
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function; // new Vue时传入的watch
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;  //计算属性、watch的不要立即执行
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    // 设置渲染 watcher
    if (isRenderWatcher) {
      vm._watcher = this
    }

    // 在 vm 的 _watcher 中添加当前的 watch 实例
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy // 为 computed 设计的
      this.sync = !!options.sync // 为 watch 设计的
      this.before = options.before // 为 watch 设计的，在 schedule 中调用
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
         process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    //是否立即调用，
    // computed 不会立即调用
    // watch 、render watcher 的时候，执行 get方法，也即执行了 getter，进行了依赖收集，当监听的属性发生变化时，set 方法中触发了 watch.update()方法
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 把当前 watcher放入全局的 watcher
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)  //执行回调
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 针对 watch 的 deep 处理，对监听对象的内部属性的变化。
      if (this.deep) {
        traverse(value)
      }
      // 把当前watcher从全局的watcher中移除
      popTarget()
      this.cleanupDeps()  // 清空关联的 deps数据
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)  //让 watcher关联 dep
      if (!this.depIds.has(id)) {
        dep.addSub(this)  //让 dep关联 watcher
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * data 中的属性发生变化，调用 set 方法。 - computed 时，lazy变为true
   * 通常情况下，执行 queueWatcher 方法 ，本质执行 run 方法更新了 value 值
   */
  update () {
    /* istanbul ignore else */
    // computed时: 因为第一次dirty为ture，lazy被设置为true。当computed对应的依赖更新时，则将dirty重新设置为true
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {  // 同步，主要用于服务端渲染 SSR
      this.run()
    } else {
      // 一般浏览器中的异步运行， 本质上就是异步执行 run
      queueWatcher(this)  // 在scheduler.js中，异步调用run方法
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 新旧值不同时，触发 cb
   */
  // 要不渲染、要么求值
  run () {
    if (this.active) {
      const value = this.get() //重新获取当前getter的值
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 通常情况下。user为 false， cb 为 noop。 watch才会执行下边逻辑
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)  //执行回调
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false   //脏数据检测
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
