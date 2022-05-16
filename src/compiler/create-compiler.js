/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from "web/util/compat"

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    // 这里是 compile 方法的具体实现
    function compile (
      template: string,   // 模板字符串
      /* compileToFunctions 方法执行时的 options
      {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,  // 浏览器情况下 false
        shouldDecodeNewlinesForHref, // 浏览器情况下 false
        delimiters: options.delimiters, // Vue 的 options 属性，一般为 undefined
        comments: options.comments  // Vue 的 options 属性，一般为 undefined 。 为 true 时，将会保留html的注释
      }
    */
      options?: CompilerOptions

    ): CompiledResult {
       // ./index 中传递的 baseOptions 参数
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      if (options) {
        // 非生产环境
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules
        // 合并 baseOptions.modules 与  options.modules，并赋值到 finalOptions.modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 合并 baseOptions.directives 与  options.directives，并赋值到 finalOptions.directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        // 拷贝 options 中的其他属性到 finalOptions 中
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

      // baseCompile 返回结构：{ast, render,staticRenderFns}
      const compiled = baseCompile(template.trim(), finalOptions)
      // 对 ast 转换过程的错误收集
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      // 添加编译过程的 errors 、tips 信息
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
