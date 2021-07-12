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
  // 这是baseCompile的具体实现 ，options 为 baseOptions 与  vm.options  合并之后的结果
  const ast = parse(template.trim(), options)  // 将template解析为ast树
  if (options.optimize !== false) {
    optimize(ast, options)   // 对ast优化
  }
  const code = generate(ast, options)  // 根据ast生成render、staticRenderFns
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
