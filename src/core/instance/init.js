/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  // options 即调用new Vue(options)时传入的参数
  console.log('0-1' , '在Vue.prototype添加_init的实例方法');

  Vue.prototype._init = function (options?: Object) {
    console.log('1-2','Vue实例初始化');
    const vm: Component = this  //当前实例
    // a uid
    vm._uid = uid++  //唯一标识

    // 测试性能使用
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 一般初始化new Vue(options)，是不会设置_isComponent属性的
    if (options && options._isComponent) {
      // 判断是否是组件
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      //合并 options
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),  // 获取全局的options。即注册的全局组件、mixin等 Vue.options
        options || {},
        vm
      )
    }

    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    // 组件的创建
    vm._self = vm
    initLifecycle(vm)   //初始化生命周期
    initEvents(vm)      //初始化事件
    initRender(vm)      //初始化渲染，
    callHook(vm, 'beforeCreate')   //调用生命周期 beforeCreate
    initInjections(vm) // resolve injections before data/props  //初始化注入器
    // 这里执行 =》 也说明在 beforeCreate 是拿不到 data 等
    initState(vm)  // 初始化状态数据。处理data、props、methods、computed、watch等。
    initProvide(vm) // resolve provide after data/props  // 将 provider的设置到 vm 实例中
    callHook(vm, 'created') // 调用生命周期 created

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 当 el存在时，自动调用 $mount方法
    // $mount方法定义在 platforms/web/runtime/index中，组件的挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 其中Ctor为 vm.constructor ，也是Vue。
  // Vue上全局设置的Options ，在core/index中的initGlobalAPI中设置
  // 分别为 'components', 'directives','filters'、_base

  let options = Ctor.options
  // 存在super，也即Ctor从Vue中继承过来的类，一般不会这样设置。如果是这样的话，则递归处理
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }

  //正常情况下直接返回Vue的options对象
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
