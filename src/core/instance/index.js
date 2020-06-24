import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue的构造函数
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)   //判断是否是通过new Vue的方法调用的
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)   //初始化方法
}

//原型链上添加方法
initMixin(Vue)  //添加 _init方法
stateMixin(Vue) //添加 data、props、set、delete、watch等状态处理的方法
eventsMixin(Vue) //添加on 、off、once、emit等时间处理的方法
lifecycleMixin(Vue) //添加生命周期方法
renderMixin(Vue) // 添加渲染相关的方法

export default Vue
