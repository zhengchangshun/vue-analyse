/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        // 校验组件名称的合法性
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          // 因为 Vue.options._base = Vue ,则 extend 方法即 Vue.extend()
          // 注册组件，传入一个选项对象 (自动调用 Vue.extend)
          definition = this.options._base.extend(definition)
        }
        // 如果指令是 function，则将指令的什么周期 bind、bind 同时设置为当前函数
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 按照 components、filters、directives分别存储格式的对象。
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })

  console.log('0-10','在Vue对象上添加静态方法component、directive、filter');
}
