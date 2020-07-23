/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

const { compile, compileToFunctions } = createCompiler(baseOptions)  // 返回高阶函数的执行

export { compile, compileToFunctions }
