/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeLetters } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 * el、propsData 属性的合并策略：默认策略 - 以child中为主，没有则返回parent
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 *  经过递归处理后，from中的数据都被拷贝得到to中对应的key下（对应key的数据合并）
 */
function mergeData(to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  // 获取from对象（Vue的data）的key
  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    // __ob__ 响应式标记，不处理
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    // 如果Vue中数据在实例中不存在，则调用set方法，将改值添加到实例中（并添加响应处理）
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if ( // 如果实例中和Vue初始数据中存在相同key，且Vue都是 纯对象时，递归合并
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
      // 如果Vue的data中对应的key在子组件中存在，且value的都是对象时，则递归处理
    ) {
      mergeData(toVal, fromVal)
    }
  }
  // 如果 Vue的 data 和 实例中的 data 存在相同key，且值类型不是纯对象时，以 实例中data为主
  return to
}

/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn() {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // data 的实际合并策略，返回一个高阶函数
    return function mergedInstanceDataFn() {
      // instance merge
      // 调用vm实例的data方法，获取返回值，实例的data
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal

      // 调用Vue的data方法，获取返回值。默认的data
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal

      // 实例存在data则与Vue中的data合并，不存在则直接返回Vue的data
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// data的合并策略
// 经过递归处理后，from中的数据都被拷贝得到to中对应的key下（对应key的数据合并）,如果属性名相同，以to为主
/*Vue.data  ={
  a:1,
  b:{b1:1,b3:6}
}
vm.data = {
   a:1,
   b:{b1:3,b2:5}
}
==>
data = {
  a:1,
  b:{b1:3,b2:5,b3:6}
}*/
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // Vue.mixin() 方法会执行该部分代码
    // data必须是一个function
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 * 生命周期按照对应的hooks各自合并为一个数组
 */
function mergeHook(
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  // mixin 等通过调用 mergeOptions 合并到 parent 上时，第一次调用返回 [hooks] 的数组类型
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks(hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

// 生命周期的合并策略: 按照生命周期的名称，归类为一个数组
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * 合并到同一对象中（extend方法），如果有同名属性，则后边覆盖前边，以 childVal中的属性为准
 */
function mergeAssets(
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}


// 组件、指令、过滤器的合并策略
// 对象merge，同名属性以实例中熟悉为准，
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * watch方法的合并策略：将同名的watch合并到一个数组中。parent中的在前，child的在后
 * 最终输出一个key - value（Array） 的对象，key为watch的值，value为watch的处理（数组形式）
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // 兼容性处理
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  // 类型检测，纯对象类型
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent ? parent.concat(child) : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 * props、methods、inject、computed的合并策略：合并到同一对象，有相同属性，去实例的自定义属性childVal
 */
strats.props =
  strats.methods =
    strats.inject =
      strats.computed = function (
        parentVal: ?Object,
        childVal: ?Object,
        vm?: Component,
        key: string
      ): ?Object {
        // key 当前合并的字段， 即为 'props'、'methods'、'inject'、'computed'中的一种
        //  类型检测 ： Object 类型
        if (childVal && process.env.NODE_ENV !== 'production') {
          assertObjectType(key, childVal, vm)
        }
        if (!parentVal) return childVal
        const ret = Object.create(null)
        extend(ret, parentVal)
        if (childVal) extend(ret, childVal)
        return ret
      }

// provide的合并策略
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 默认策略： childVal 存在返回childVal
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

// 以上不同类型字段合并的策略

/**
 * Validate component names
 * Vue初始化时，new Vue({components})中components定义是name的合法性校验。
 */
function checkComponents(options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName(name: string) {
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeLetters}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // slot,component 不能作为组件名称
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * options是否存在props属性，如果不存在，直接返回
 * 如果存在props
 *  (1)、以数组形式时，则必须要求数组元素为字符串，且倒序处理每一个key：kebab-case 转成 camelCase
 *  (2)、以对象形式时，如果值是对象直接处理，如果不是对象则作为类型值（type），同样key做如上转换
 * 最终：将props转换成key-value的对象形式，并对key值做转换 （kebab-case 转成 camelCase）
 */
function normalizeProps(options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // props 是数组的形式传入， props: ['title', 'likes', 'isPublished', 'commentIds', 'author']
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]

      //数组传入的key必须是字符串
      if (typeof val === 'string') {
        name = camelize(val)    // kebab-case 转成 camelCase
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
    // props是以对象的形式传入
    // {
    //   propA: Number,
    //     // 多个可能的类型
    //   propB: [String, Number],
    //   // 必填的字符串
    //   propC: {
    //   type: String,
    //     required: true
    // },
    //   // 带有默认值的数字
    //   propD: {
    //     type: Number,
    //   default:
    //     100
    //   } ,
    // };
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      // 如果prop对于的value是对象，则直接将该对象复制到res中的name属性（key值转换），如果不是对象，则传入的是类型值，赋值给{type}
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * 对inject的处理，数据格式的统一
 * inject：Array<string> | { [key: string]: string | Symbol | Object }
 */
function normalizeInject(options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  // inject是数组时，转换成 {key:{from:key}}的形式
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
    // 如果inject是对象，则返回一个对象，并且添加from属性
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 * 如果知道是一个函数，则默认钩子函数 bind、update指向该函数
 */
function normalizeDirectives(options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

// 判断value是否是纯对象
function assertObjectType(name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions(
  parent: Object,
  child: Object,
  vm?: Component
): Object {


  // component name的合法性校验
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }

  normalizeProps(child, vm)    //对props传入形式的处理,统一格式
  normalizeInject(child, vm)   //对inject传入处理，统一格式
  normalizeDirectives(child)   // 对directive的处理

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.

  // 对extends和mixin的处理。只有合并的对象才有_base属性。将extends和 mixin 的属性合并到parent上。
  // 通过 mergeField 方法，再与实例中的属性合并操作 ( 根据合并策略 )
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    // mixin存在多个的情况
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options = {}

  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }

  // 根据不同的策略合并options - el、data、props、watch、computed、methods、hooks等
  // parent中的 data、props、computed、hook等来源于mixins 、 extends
  function mergeField(key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }

  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
