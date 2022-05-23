/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 这是 baseCompile的具体实现 ，options 为 finalOptions ( baseOptions 与  compileToFunctions 方法执行时的 options 合并的结果)
  // parse 会用正则等方式解析 template 模板中的指令、class、style等数据，形成AST
  const ast = parse(template.trim(), options)  // 将template解析为ast树
  console.log('AST', ast)
  // 这是 Vue 在编译过程中的一处优化，后面当 update 更新界面时，会有一个 patch 的过程， diff 算法会直接跳过静态节点，从而减少了比较的过程，优化了 patch 的性能
  if (options.optimize !== false) {
    optimize(ast, options)   // 对ast优化
  }
  // 将 AST 转化成 render function 字符串的过程，得到结果是 render 的字符串以及 staticRenderFns 字符串。
  const code = generate(ast, options)
  console.log('ast code', code)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
