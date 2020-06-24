import Vue from './instance/index'   //Vue的构造函数
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

initGlobalAPI(Vue)  //在Vue上挂载的静态方法，直接通过Vue对象调用

//服务端渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})
//服务端渲染
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

//服务端渲染
// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
