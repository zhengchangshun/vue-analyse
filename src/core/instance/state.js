/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 后续所有的的 target 的 get、set操作，都将操作的是 this[sourceKey]上的对应 key
// 直接通过 this 就能获取 data 和 props 上属性。
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 处理props  => 响应式处理,props的属性挂载到vm，且get、set操作实际为this._props
  if (opts.props) initProps(vm, opts.props)
  // 处理methods = > //将methods的方法设置到vm实例上，并将this指向当前的vm实例
  if (opts.methods) initMethods(vm, opts.methods)
  // 处理data  => 响应式处理,props的属性挂载到vm，且get、set操作实际为this._data
  if (opts.data) {
    initData(vm)
  } else {
    // 观察_data的变化
    observe(vm._data = {}, true /* asRootData */)
  }
  // 处理computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 处理watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// propsOptions 传递进来的就是初始化props，在_init方法中的mergeOptions方法中，统一将props转换成对象：{key: {type:''}}的形式
// props的类型校验，设置到 vm 实例上，响应式处理
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}  //创建实例时传递 props。主要作用是方便测试。
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    // props的校验,并返回props的值,
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */

    // 数据做响应式处理
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)   // 驼峰（camelCase）转成连线（kebab-case）
      // props是否是以下保留字：key,ref,slot,slot-scope,is
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        // 非生产环境下，修改props的值，报错
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)  //转换成响应式
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.

    // 此处props的操作如同data的处理方法，props的属性直接映射到vm上。后续的get、set操作实际操作的是this._props
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

//校验
//遍历data的属性，并将data中的属性直接设置到vm实例上。
//设置代理后后续所有的关于data的（this.dataKey）读取操作，都实际操作的是this._data中的数据
function initData (vm: Component) {
  let data = vm.$options.data
  // 在 _init方法中，data返回一个高阶函数
  //判断data是否是函数，如果是则执行并返回结果，否则直接赋值。并设置同时_data的值
  //通过proxy代理后，后续data的 get、set方法实际都作用到了this._data上
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

    //data必须是一个纯对象,否则会提示
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // 如果data中的属性和 methods中的属性相同，则抛出警告
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }

    // 如果data中的属性和 props中的属性相同，则抛出警告
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      //遍历data的属性，并都直接设置到vm实例上。设置代理后set、get方法时，实际作用在this._data上
      proxy(vm, `_data`, key)
    }
  }
  // observe data

  //将data做响应式的处理
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // Vue在初始化时，还没有进行渲染，不需要做依赖收集，pushTarget 传入空，就是设置 Dep.target = undefined；
  // 依赖收集的时候会根据 Dep.target 存在时，才做以来收集
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

// 默认computed计算的时候，优先取缓存
const computedWatcherOptions = { lazy: true }

// computed的初始化，劫持 get 方法
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // 判断computed的值是 function。还是含有get属性的对象
    const getter = typeof userDef === 'function' ? userDef : userDef.get

    // computed的元素必须存在handler （Getter）
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建computed的watcher，根据依赖的数据计算结果
      // watcher的操作分别在get、set方法中 （发布 - 订阅）模式 。
      // 这些watcher都根据key存放在vm._computedWatchers中,在后续get、set方法中用到
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // computed的数据不在vm的实例上 （vm未定义相同的key）, userDef 当前的 computed函数
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // computed的元素不能重复出现在data、props里
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 当前computed被代理到vm实例上，在web端，通过Object.defineProperty 劫持，get方法设置为 createComputedGetter
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()   //服务端渲染，web端是shouldCache=true

  // shouldCache = true ： web
  // computed是函数，则默认只有get方法
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    // computed是对象，含有set、get方法
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }

  // 对象的形式设置computed时，set如果没有设置，则重写set，执行set方法时，跑出warning
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // 将computed的key直接设置到vm实例上（target），且重写get、set方法
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// computed 的 getter方法的具体实现。真正执行 computed计算的是在这里。
// 因为 computed 初始化时，watcher 传入的是 {lazy：true}，如果 computed 没有被调用，则 computedGetter 不会执行，则 computed的值为 undefined
function createComputedGetter (key) {
  return function computedGetter () {
    // 根据vm._computedWatchers中的key找到对应的computed
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 脏值检测 : 默认是ture, 也即第一次都需要计算，之后 设置 dirty 为 false ，利用缓存
      if (watcher.dirty) {
        watcher.evaluate()   // 调用 get 方法，并设置 dirty 为 false， 设置缓存
      }
      // 收集 对当前 computed 的依赖
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 不需要缓存，每次都直接执行
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

//将methods的方法设置到vm实例上，并将this指向当前的vm实例
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    //将methods的方法绑定到vm上
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 循环遍历处理watcher
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    // 这里主要处理mixin等合并watch后的结果。[]的数据
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 处理 { immediate,deep,handler } 等对象形式的 watcher
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 处理 'getList' 等字符串（函数句柄）形式的 watcher ： 这也是为什么 initMethod 要在 initWatch 前执行
  if (typeof handler === 'string') {
    handler = vm[handler]
  }

  // $watch方法定义当前页面的 stateMixin 方法中
  // expOrFn 为 监听的属性
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 在原型上添加$set、$delete方法
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 在原型上添加$watch方法
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // watch 是对象的形式
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true   // watcher 中设置 user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    //立即执行 watch
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 解绑watch
    return function unwatchFn () {
      watcher.teardown()
    }
  }

  console.log('0-2', '在Vue.prototype添加$data、$props、$set、$delete、$watch等实例方法');
}
