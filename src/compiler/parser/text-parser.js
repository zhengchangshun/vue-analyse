/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g  // 匹配 {{}} 中间的内容  
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

// vue 的 {{}} 字面量解析
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // 纯文本 ，没有 {{}}
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []  // 用于存放字符串
  let lastIndex = tagRE.lastIndex = 0  // 用于记录匹配的最后位置
  let match, index, tokenValue

  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    // 说明 {{}} 之前存在文本
    if (index > lastIndex) {
      rawTokens.push(tokenValue = text.slice(lastIndex, index)) // 将纯文本内容记录在 rawTokens 中
      tokens.push(JSON.stringify(tokenValue))  // 将 纯文本同时记录在 tokens 中
    }
    // tag token
    const exp = parseFilters(match[1].trim())   // 解析到 {{xxx}} 直接的内容：xxx
    tokens.push(`_s(${exp})`)  // 提供 _s()方法， 计算 {{xxx}} 中具体值
    rawTokens.push({ '@binding': exp })  // 用于记录还有双向绑定的内容
    lastIndex = index + match[0].length  // 改变lastIndex 位置
  }

  // 说明 最后一个 {{}} 之后还有文本内容，将这部分继续存放到 tokens、rawTokens 中
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),   // 返回字符串，包含双向绑定的解析
    tokens: rawTokens // 返回数组
  }
}
