/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'
import { generateCodeFrame } from './codeframe'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

// 通过 code 创建函数，如果发生错误则收集在 errors 中
function createFunction (code, errors) {
  try {
    return new Function(code)  // 通过字符串模板创建函数
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  // 这里是 compileToFunctions 方法的具体实现
  return function compileToFunctions (
    template: string,  // 模板字符串
    options?: CompilerOptions, // 编译 options
    vm?: Component  // 当前的 vm 实例
  ): CompiledFunctionResult {
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    // csp 安全策略的测试 。检测 new Function() 是否可用
    // 如果你的策略比较严格，那么 new Function() 将会受到影响，从而不能够使用。但是将模板字符串编译成渲染函数又依赖 new Function()
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    // options.delimiters 可以默认当做 undefined来处理
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template

    // 缓存字符串模板的编译结果，防止重复编译，提升性能
    if (cache[key]) {
      return cache[key]
    }

    // compile: 这里的compiler 就是 compiler/create-compiler 文件中 createCompilerCreator方法 中传入的 compiler 方法
    // 主要方法内容其实是 compiler/index 文件中传入的 baseCompiler 方法，通过 ast 转换，其中options 为 baseOptions 与 vm.options 的合并
    // compiled 的 结构为：
    //     {
    //       ast,
    //       render: code.render,
    //       staticRenderFns: code.staticRenderFns
    //     }
    const compiled = compile(template, options)

    // check compilation errors/tips
    // 检查使用 compile 对模板进行编译的过程中是否存在错误和提示的，如果存在那么需要将其打印出来
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // turn code into functions
    // 将 ast解析之后的函数字符串，重新变为函数
    const res = {}
    const fnGenErrors = []
    // res.render 是 new Function（compiled.render）的结果， fnGenErrors对错误信息收集
    // compiled.render 是一个 函数体的字符串
    res.render = createFunction(compiled.render, fnGenErrors)
    // res.staticRenderFns 是遍历 compiled.staticRenderFns，执行 new Function（code）的结果， fnGenErrors对错误信息收集
    // staticRenderFns 的主要作用是渲染优化
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    // 编译报错
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }
    // 将编译结果存储在cache对象中，同时返回res
    return (cache[key] = res)
  }
}
