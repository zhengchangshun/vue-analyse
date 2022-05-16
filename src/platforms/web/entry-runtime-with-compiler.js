/* @flow */
// 打包入口文件
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'  //调试工具中使用

import Vue from './runtime/index'
import { query } from './util/index'
//用来生成 render 的工具方法
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

//原有的$mount platforms/web/runtime/index
const mount = Vue.prototype.$mount

// 重新改写$mount方法, 并执行原有的 $mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  // 不能将 vue 挂载到 body、document上
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 不存在render方法的时候
  if (!options.render) {
    let template = options.template
    // 通过template或者el获取Vue实例挂载的节点（内容）
    if (template) {
      if (typeof template === 'string') {
         // template 是 #id的方式
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
        // dom元素
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
      // el 是 #id的方式
    } else if (el) {
      template = getOuterHTML(el)
    }
    // 存在模板时
    if (template) {
      /* istanbul ignore if */
      // 如果开启了performance,则记录编译开始
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 将模板字符串解析出来render方法 、 staticRenderFns用来存放静态内容
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,  // 浏览器情况下 false
        shouldDecodeNewlinesForHref, // 浏览器情况下 false
        delimiters: options.delimiters, // Vue 的 options 属性，一般为 undefined
        comments: options.comments  // Vue 的 options 属性，一般为 undefined 。 为 true 时，将会保留html的注释
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      // 如果开启了performance,则记录编译结束
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用原来的$mount方法 ：platforms/web/runtime/index
  return mount.call(this, el, hydrating)
}

console.log('0-16','在Vue.prototype上重写$mount方法，在重写方法中执行之前定义的$mount方法');

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

// Vue上添加静态方法compile
Vue.compile = compileToFunctions

console.log('0-17','在Vue上定义静态方法compile');

// 返回最终的Vue构造函数
export default Vue
