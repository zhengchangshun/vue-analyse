/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeLetters } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
// 正则表达式，用于匹配属性，标签 、注释等
/**
 *  匹配属性，包含 "id"="1" 、'id'='1' 、 id = 1、 checked 等形式的属性
 * ^ : 匹配开始
 * \s*: 空格0次或者多次
 * ([^\s"'<>\/=]+) ： 第一个捕获组，不能 空格、"、'、<、>、/、 =  这个几个字符： 用于匹配属性名
 * (?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))? : 非捕获组，0-1，其中 0 次是永远匹配没有 "checked" 这种属性；
 *     \s*(=)\s* : 用于匹配等号，等号前后允许若干空格；
 *      以下作为多选分支，用于匹配属性值。
 *        "([^"]*)"+ : 第三个捕获组，用于匹配双引号属性； "id"="1"
 *        '([^']*)'+ ：第四个捕获组， 用于匹配单引号属性  'id'='1' 
 *        ([^\s"'=<>`]+)：第五个捕获组，用于匹配没有引号的属性，id = 1
 */
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 匹配 <my-component>这种
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeLetters}]*` // 合法的 xml标签

// 匹配 <my:component>这种
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)  // 开始标签 <div
const startTagClose = /^\s*(\/?)>/  // 自闭合标签 <div/>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`) // 结束标签 </div>
const doctype = /^<!DOCTYPE [^>]+>/i  // <!DOCTYPE> 声明标签
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/  //注释
const conditionalComment = /^<!\[/  // 匹配条件

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []  // 用于存储最终的解析结果
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  // 来检测一个标签是否是可以省略闭合标签的非一元标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0  // 记录当前编译字符串的位置
  let last, // 存储剩余还未编译的 html 字符串
    lastTag // 始终存储着位于 stack 栈顶的元素
  // 开启一个 while 循环,循环的终止条件是 html 字符串为空，即html 字符串全部编译完毕。
  while (html) {
    last = html  // 每次遍历开始，将last设置为 html，之后对html不断截取。
    // Make sure we're not in a plaintext content element like script/style
    // 确保即将 parse 的内容不是标签 (script,style,textarea)
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      // 匹配到开始标签， 处理之后，continue 执行下一次
      if (textEnd === 0) {
        // Comment:
        // 对注释的处理
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 是否保留注释
            if (options.shouldKeepComment) {
              // 截取注释部分，并保留注释的起始位置、结束位置
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)  //  +3  是指 "-->" 结束的位置
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 对匹配条件的处理：直接忽视，进行下一次编译 (advance)
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')   // 获取条件注释的结束位置

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:对  <!DOCTYPE> 的处理，直接忽视，进行下一次编译 (advance)
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)  // 根据匹配长度继续截取
          continue
        }

        // End tag: 匹配到结束标签，形如 </div> <  />
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)  // endTagMatch[0] 匹配的内容是 </div> ，继续截取字符串。
          // endTagMatch[1] 匹配的标签名称：div
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      // 在标签前还有文本内容
      if (textEnd >= 0) {
        rest = html.slice(textEnd)  // 不含标签前的内容
        // 处理文中有字符串'<<<<<<<<<<<<<'的情形，循环直至找到最后一个非标签的 <
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }

        // 截取前边文本部分
        text = html.substring(0, textEnd)
      }

      // 纯文本的形式
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)  // 截取。继续执行
      }

      // 对文本部分单独处理
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 存在lastTag，或则是 (script,style,textarea) 标签
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        // 不在标签里 (script,style,textarea)
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // // 极端情况下的处理: 如果两者相等，则说明html 在经历循环体的代码之后没有任何改变。
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  // 此时 parseEndTag 中的 pos = 0  stack.length = 0 ，清空 stack 数组
  parseEndTag()

  // 剔除已经编译的html内容,同时将index设置为最新值
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  // 针对html标签匹配的 解析tagName、attrs
  function parseStartTag () {
    const start = html.match(startTagOpen)  // startTagOpen 形如 <div
    if (start) {
      const match = {
        tagName: start[1],  // 捕获组第一个内容，即标签名称，如 div
        attrs: [],  // 用来存储 属性
        start: index // 匹配的位置
      }
      advance(start[0].length)  // 继续向后截取
      let end, attr
      // 获取 html 元素的属性。当没有匹配结束标签（ > 或者 />）且存在属性时。
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        attr.start = index  // 当前属性的匹配开始位置
        advance(attr[0].length) // 属性匹配的长度，继续截取，同时更改index
        attr.end = index  // 当前匹配的结束位置
        match.attrs.push(attr)  // 将属性存储到 match 中
      }
      // 属性匹配结束, end 为 开始标签的结束部分
      if (end) {
        match.unarySlash = end[1]  // end[1]不为undefined，那么说明该标签是自闭合标签。
        advance(end[0].length)  // 继续截取
        match.end = index
        return match
      }
    }
  }

  // 对Html标签的属性 继续处理，构造成 {name、 value }格式
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    // expectHTML 默认为true
    // isNonPhrasingTag、canBeLeftOpenTag 针对特殊标签的处理
    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 判断是否是自闭合标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    // 处理 attrs，构造  name - value的对象
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''  // 通过捕获组（ 正则表达式 attribute 中 ）获取属性值
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref  // false
        : options.shouldDecodeNewlines // false
      attrs[i] = {
        name: args[1], // 属性名
        value: decodeAttr(value, shouldDecodeNewlines)  // 属性值
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 用于判断是否是自闭合标签。非自闭合标签还需判断是否有子节点。即push到stack数组中，并将lastTag的值设置为该标签名
    if (!unary) {
      // 将解析后的结果 存在在 stack 中
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName  // 并设置 lastTag 为当前 标签名。用户后续标签判断结束 和 子标签内容的设置。
    }

    if (options.start) {
      // 创建 ASTNode
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
 /*
 1、检测是否缺少闭合标签
 2、处理 stack 栈中剩余的标签
 3、解析</br> 与标签，与浏览器的行为相同

 */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 在 stack 中 查找是否有当前标签对应标签名
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }
    // 如果当前标签对应标签名出现的位置 pos > 0 , 则说明从从  pos  - stack.length 的标签没有设置结束标签，则html结构存在问题
    // pos = 0 , 说明当前的stack 最后一个元素与当前的标签匹配，符合html结构
    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos  // 移除没有闭合的非法标签。
      lastTag = pos && stack[pos - 1].tag  // 将 lastTag 设置为 stack 的最后一个元素
    } else if (lowerCasedTagName === 'br') {  // 对 </br> 的处理 , 此时 stack 中没有 br 的标记
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') { // 对 </p> 标签的处理,  此时 stack 中没有 p 的标记
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
