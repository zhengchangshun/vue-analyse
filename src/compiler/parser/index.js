/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize, hyphenate, hasOwn } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  getRawBindingAttr,
  pluckModuleFunction
} from '../helpers'

export const onRE = /^@|^v-on:/    // 匹配 @、 v-on
export const dirRE = /^v-|^@|^:|^\./  // 匹配指令  @、 :、 v-
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/  // 匹配 v-for 当中的 in 或者 of 前后的内容
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/   // 匹配 v-for 当中的 属性值中逗号后边的部分  如：,index
const stripParensRE = /^\(|\)$/g

const argRE = /:(.*)$/  //argRE正则用来匹配指令编写中的参数，并且拥有一个捕获组，用来捕获参数的名字。
export const bindRE = /^:|^\.|^v-bind:/ // 匹配以字符:或字符串 v-bind: 开头的字符串，主要用来检测一个标签的属性是否是绑定(v-bind)。
const propBindRE = /^\./  // 匹配 .
const modifierRE = /\.[^.]+/g  // 该正则用来匹配修饰符的

const lineBreakRE = /[\r\n]/  // 换行
const whitespaceRE = /\s+/g   // 多个空格

const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace
let maybeComponent

export function createASTElement (
  tag: string,
  attrs: Array<ASTAttr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1,   //  HTML 节点
    tag,  // 标签名称
    attrsList: attrs, // 属性
    attrsMap: makeAttrsMap(attrs),
    rawAttrsMap: {},
    parent, // 父节点
    children: []  // 子节点列表
  }
}

/**
 * Convert HTML string to AST.
 */
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  warn = options.warn || baseWarn

  platformIsPreTag = options.isPreTag || no
  platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no
  const isReservedTag = options.isReservedTag || no
  maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag)

  transforms = pluckModuleFunction(options.modules, 'transformNode')   // 获取 modules 中 transformNode 方法的集合
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode') // 获取 modules 中 preTransformNode 方法的集合
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode') // 获取 modules 中 postTransformNode 方法的集合

  delimiters = options.delimiters   //插值的符号，默认 {{ }}

  const stack = []  // 用于存储 ASTNode 结构
  const preserveWhitespace = options.preserveWhitespace !== false
  const whitespaceOption = options.whitespace
  let root
  let currentParent  // 用于存放当前字节的的父节点，该变量维护元素描述对象之间的父子关系
  let inVPre = false
  let inPre = false
  let warned = false

  // 只提示一次
  function warnOnce (msg, range) {
    if (!warned) {
      warned = true
      warn(msg, range)
    }
  }

  // 匹配到闭合标签时，通过 currentParent 构造父子节点关系
  function closeElement (element) {
    // 忽略
    if (!inVPre && !element.processed) {
      element = processElement(element, options)
    }
    // tree management
    // 当前存储标签的堆栈不为空，且不是 根节点
    if (!stack.length && element !== root) {
      // allow root elements with v-if, v-else-if and v-else
      // 如果定义多个根元素，只能够保证最终只渲染其中一个元素，那就是在多个根元素之间使用 v-if 或 v-else-if 或 v-else 
      if (root.if && (element.elseif || element.else)) {
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(element)
        }
        addIfCondition(root, {
          exp: element.elseif,
          block: element
        })
      } else if (process.env.NODE_ENV !== 'production') {
        warnOnce(
          `Component template should contain exactly one root element. ` +
          `If you are using v-if on multiple elements, ` +
          `use v-else-if to chain them instead.`,
          { start: element.start }
        )
      }
    }
    if (currentParent && !element.forbidden) {
      // 如果当前的节点中村 v-else 、 v-else-if, 则需要需要父节点的children（已经收集的子节点） 中存在 v-if
      if (element.elseif || element.else) {
        processIfConditions(element, currentParent)
      } else if (element.slotScope) { // scoped slot
        const name = element.slotTarget || '"default"'
        ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
      } else {
        // 这里是关键。stack 中的最有一个元素（currentParent）作为父节点 存储 element 元素
        currentParent.children.push(element) //  父元素的 children 中 存储字节点
        element.parent = currentParent // 字节的 parent 属性设置为父节点
      }
    }
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  // 对根节点的校验
  function checkRootConstraints (el) {
    // 不能使用 slot 、template 作为根组件
    if (el.tag === 'slot' || el.tag === 'template') {
      warnOnce(
        `Cannot use <${el.tag}> as component root element because it may ` +
        'contain multiple nodes.',
        { start: el.start }
      )
    }
    // 不能将 v-for 作用于根组件
    if (hasOwn(el.attrsMap, 'v-for')) {
      warnOnce(
        'Cannot use v-for on stateful component root element because ' +
        'it renders multiple elements.',
        el.rawAttrsMap['v-for']
      )
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    outputSourceRange: options.outputSourceRange,

    // 处理各种指令。创建 ASTNode 节点关系
    start (tag, attrs, unary, start) {
      // check namespace.
      // inherit parent ns if there is one
      // 标签的命名空间，
      // 如果当前元素存在父级并且父级元素存在命名空间，则使用父级的命名空间作为当前元素的命名空间。
      // 或者通过 platformGetTagNamespace 获取命名空间， platformGetTagNamespace只会获取 svg 和 math 这两个标签的命名空间。
      // 因此 ns 可以认为 undefined
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug 
      /* istanbul ignore if */
      // 忽略:处理 svg 在 ie 下的bug：http://osgeo-org.1560.x6.nabble.com/WFS-and-IE-11-td5090636.html
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      // 通过 tagName 、attrs 构建 ASTNode
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      // 忽略 outputSourceRange :undefined
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.start = start
        element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
          cumulated[attr.name] = attr
          return cumulated
        }, {})
      }

      // 忽略: isForbiddenTag: <style>  <script type="text/javascript"> 不被允许
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.',
          { start: element.start }
        )
      }

      // apply pre-transforms
      // 处理各种指令、 v-model、v-if、v-for等
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
      }

      // 设置第一个元素为根元素
      if (!root) {
        root = element  // root 节点不存在，将当前节点设置为root节点
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(root)
        }
      }
      // 非闭合标签，存储当前标签名。用于构造父子关系使用
      if (!unary) {
        currentParent = element // 非闭合标签，则存在子节点，将当前节点设置为父节点
        stack.push(element) // 将当前节点入栈
      } else {
        // 针对自闭合标签的处理
        closeElement(element)  
      }
    },

    /*
    HTML结构：
     <div> 
       <div>
        <h1>1111</h1>
        <h2>1111</h2>
       </div>
     </div>

      实际上stack中存储的时 ASTNode 节点， 此处用 tagName 说明
      1、匹配到 <h1> 标签时, start 方法被调用， 此时 stack = ['div', 'div', 'h1'] 
      2、匹配到结束标签 </h1> 时，此时 element 为 h1、  stack 设置为 [ 'div', 'div'] , currentParent 设置为 'div'
      3、继续匹配到 <h2>，通过 start 方法， stack 变为 ['div', 'div', 'h2'],
      4、匹配到结束标签 </h2> 时，此时 element 为 h2、  stack 设置为 [ 'div', 'div'] , currentParent 设置为 'div'
      5、匹配到结束标签 </div> 时，此时 element 为 div、  stack 设置为 [ 'div'] , currentParent 设置为 'div'
      6、匹配到结束标签 </div> 时，此时 element 为 div、  stack 设置为 [ ] , currentParent 设置为 undefined, 则当前节点为根节点。
     */
    // 确定父子节点关系
    end (tag, start, end) {
      const element = stack[stack.length - 1]  // 获取 stack 中最后一个 AST节点
      if (!inPre) {
        // remove trailing whitespace node
        const lastNode = element.children[element.children.length - 1]
        // 去除空白节点
        if (lastNode && lastNode.type === 3 && lastNode.text === ' ') {
          element.children.pop()
        }
      }
      // pop stack
      stack.length -= 1 // 因为element已经被匹配到，故从 stack 中移除 element，作用域还原给了上层节点
      currentParent = stack[stack.length - 1]    // 获取 stack 中 倒数第二个节点，作为当前节点的 父节点。 
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)  // 匹配到类似于 </div> 这种结束标签
    },
    // 对文本部分的处理
    chars (text: string, start: number, end: number) {
      if (!currentParent) {
        // 模板必须要有根元素、根元素外的文本将会被忽略
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.',
              { start }
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`,
              { start }
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      // 忽略
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }

      const children = currentParent.children // 获取当前节点的父节点中的children属性，目的是将当前文本添加到 children中
      
      // 以下是对 text 的处理
      if (inPre || text.trim()) {
        text = isTextTag(currentParent) ? text : decodeHTMLCached(text)
      } else if (!children.length) {
        // remove the whitespace-only node right after an opening tag
        text = ''
      } else if (whitespaceOption) {
        if (whitespaceOption === 'condense') {
          // in condense mode, remove the whitespace node if it contains
          // line break, otherwise condense to a single space
          text = lineBreakRE.test(text) ? '' : ' '
        } else {
          text = ' '
        }
      } else {
        text = preserveWhitespace ? ' ' : ''
      }
      if (text) {
        if (whitespaceOption === 'condense') {
          // condense consecutive whitespaces into single space
          text = text.replace(whitespaceRE, ' ')
        }
        let res
        let child: ?ASTNode
        // 创建当前文件的 ASTNode，添加到父节点的 children 中

        // 解析含有 {{}}的字面量表达式： < div > hello: { { message } } </div > 
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          child = {
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          }
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          // 纯文本节点
          child = {
            type: 3,
            text
          }
        }
        if (child) {
          if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
            child.start = start
            child.end = end
          }
          children.push(child)  // 添加到父节点的 children 属性中
        }
      }
    },
    // 对注释的处理
    comment (text: string, start, end) {
      const child: ASTText = {
        type: 3,
        text,
        isComment: true  // 标注为 注释节点
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        child.start = start
        child.end = end
      }
      // 存储注释
      currentParent.children.push(child)
    }
  })

  // 根节点，包含所有 AST 关系（ASTElement）, 即最终返回的结果
  return root
}

//处理 v-pre 指令： 找到 v-pre属性, 并删除该属性，并在当前 ASTNode 上添加 pre 属性
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

//处理属性：  从 attrsList 生成 attrs, 对 value转换成字符串
function processRawAttrs (el) {
  const list = el.attrsList
  const len = list.length
  if (len) {
    const attrs: Array<ASTAttr> = el.attrs = new Array(len)
    for (let i = 0; i < len; i++) {
      attrs[i] = {
        name: list[i].name,
        value: JSON.stringify(list[i].value)
      }
      if (list[i].start != null) {
        attrs[i].start = list[i].start
        attrs[i].end = list[i].end
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

export function processElement (
  element: ASTElement,
  options: CompilerOptions
) {
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain = (
    !element.key &&
    !element.scopedSlots &&
    !element.attrsList.length
  )

  processRef(element)
  processSlot(element)
  processComponent(element)
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
  return element
}

//处理 key：特定标签上不能使用key；将 ASTNode 的 key 属性赋值为 key 的内容，并从 attrsList 中删除 key
function processKey (el) {
  const exp = getBindingAttr(el, 'key')  // 获取绑定在 key 上的内容
  if (exp) {
    if (process.env.NODE_ENV !== 'production') {
      // key 不能作用在 template 标签上
      if (el.tag === 'template') {
        warn(
          `<template> cannot be keyed. Place the key on real elements instead.`,
          getRawBindingAttr(el, 'key')
        )
      }
      // v-for 中对 index 的处理
      if (el.for) {
        const iterator = el.iterator2 || el.iterator1  // 对应 index 参数
        const parent = el.parent
        if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {
          warn(
            `Do not use v-for index as key on <transition-group> children, ` +
            `this is the same as not using keys.`,
            getRawBindingAttr(el, 'key'),
            true /* tip */
          )
        }
      }
    }
    el.key = exp
  }
}

//处理 ref：将 ASTNode 的 ref 属性赋值为 ref 的内容，并从 attrsList 中删除 key
function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)  // 确定 ref 是否处理 v-for 中
  }
}

//处理 v-for： 解析 v-for 对应的变量，以及循环的参数，添加到 ASTNode 属性 中 ，并 v-for 属性从 attrsList 中删除
export function processFor (el: ASTElement) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const res = parseFor(exp)
    if (res) {
      extend(el, res)   // 将 res 对象 {for,alias,iterator1,iterator2}复制到el（ASTNode）的属性中。
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid v-for expression: ${exp}`,
        el.rawAttrsMap['v-for']
      )
    }
  }
}

type ForParseResult = {
  for: string;
  alias: string;
  iterator1?: string;
  iterator2?: string;
};

// 解析 v-for：获取 v-for 作用的变量（array 或者 object），以及记录v-for当中的各个参数。
export function parseFor (exp: string): ?ForParseResult {
  // forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/ , 匹配 v-for 中 in或者of 前后的内容 ，分别捕获
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  const res = {}
  res.for = inMatch[2].trim()  // v-for 操作的 array 或者 object
  // stripParensRE = /^\(|\)$/g 匹配 v-for 中的 in 或者 of 之前的 ( 或者 )
  const alias = inMatch[1].trim().replace(stripParensRE, '')  // 匹配 v-for 中 ( item, index ) 部分，并去除括号，结果为： item 或者 item,index  等
  const iteratorMatch = alias.match(forIteratorRE)
  // forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/ 匹配:  ,index 等，确定当前 v-for 是否只含有一个参数
  if (iteratorMatch) {
    // 存在多个参数
    res.alias = alias.replace(forIteratorRE, '').trim()  // 将逗号后的内容替换为空，则结果为 v-for 中的 item （第一个参数）
    res.iterator1 = iteratorMatch[1].trim()  // v-for 中第二个参数
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim()  // v-for 中第三个参数
    }
  } else {
    res.alias = alias  //  v-for 只有一个参数，则直接 alias 几位
  }
  return res
}

//处理 v-if 等：解析 v-if 的内容，并添加到 ASTNode 的 ifConditions 属性中，同时并、从 attrsList 中删除 v-if
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if') // 获取 v-if 的内容，并从 attrsList 中删除
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

// 确保 v-else、 v-else-if 之前存在 v-if
function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    // 不能单独使用 v-else 或者 v-else-if
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
    )
  }
}

// 找到第一个 type=1 的字节点 （node 节点）
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {   //  node 节点
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        // 处于 v-if 和  v-else 之前的文本内容会被忽略
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`,
          children[i]
        )
      }
      children.pop()
    }
  }
}

// 向 ASTNode 的 ifConditions 属性中添加内容
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

//处理 v-once：获取 v-once 的内容 添加到 ASTNode 的once 属性中，并从 attrList 中删除 v-once
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

//处理 slot：包含 <slot>  、 v-slot、slot-scope 的处理
function processSlot (el) {
  if (el.tag === 'slot') {
    // 针对 <slot name="user"> 的处理，:key 不能作用于 slot 标签
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, 'key')
      )
    }
  } else {
    let slotScope
    if (el.tag === 'template') {
      slotScope = getAndRemoveAttr(el, 'scope')
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
          `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
          el.rawAttrsMap['scope'],
          true
        )
      }
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
        warn(
          `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
          el.rawAttrsMap['slot-scope'],
          true
        )
      }
      el.slotScope = slotScope
      if (process.env.NODE_ENV !== 'production' && nodeHas$Slot(el)) {
        warn('Unepxected mixed usage of `slot-scope` and `$slot`.', el)
      }
    } else {
      // 2.6 $slot support
      // Context: https://github.com/vuejs/vue/issues/9180
      // Ideally, all slots should be compiled as functions (this is what we
      // are doing in 3.x), but for 2.x e want to preserve complete backwards
      // compatibility, and maintain the exact same compilation output for any
      // code that does not use the new syntax.

      // recursively check component children for presence of `$slot` in all
      // expressions until running into a nested child component.
      if (maybeComponent(el) && childrenHas$Slot(el)) {
        processScopedSlots(el)
      }
    }
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      if (el.tag !== 'template' && !el.slotScope && !nodeHas$Slot(el)) {
        addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'))
      }
    }
  }
}

function childrenHas$Slot (el): boolean {
  return el.children ? el.children.some(nodeHas$Slot) : false
}

const $slotRE = /(^|[^\w_$])\$slot($|[^\w_$])/
function nodeHas$Slot (node): boolean {
  // caching
  if (hasOwn(node, 'has$Slot')) {
    return (node.has$Slot: any)
  }
  if (node.type === 1) { // element
    for (const key in node.attrsMap) {
      if (dirRE.test(key) && $slotRE.test(node.attrsMap[key])) {
        return (node.has$Slot = true)
      }
    }
    return (node.has$Slot = childrenHas$Slot(node))
  } else if (node.type === 2) { // expression
    // TODO more robust logic for checking $slot usage
    return (node.has$Slot = $slotRE.test(node.expression))
  }
  return false
}

//处理 slot：
function processScopedSlots (el) {
  // 1. group children by slot target
  const groups: any = {}
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i]
    const target = child.slotTarget || '"default"'
    if (!groups[target]) {
      groups[target] = []
    }
    groups[target].push(child)
  }
  // 2. for each slot group, check if the group contains $slot
  for (const name in groups) {
    const group = groups[name]
    if (group.some(nodeHas$Slot)) {
      // 3. if a group contains $slot, all nodes in that group gets assigned
      // as a scoped slot to el and removed from children
      el.plain = false
      const slots = el.scopedSlots || (el.scopedSlots = {})
      const slotContainer = slots[name] = createASTElement('template', [], el)
      slotContainer.children = group
      slotContainer.slotScope = '$slot'
      el.children = el.children.filter(c => group.indexOf(c) === -1)
    }
  }
}

//处理 is：动态组件
function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

//处理 属性：
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp, syncGen
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name.replace(dirRE, ''))  // 处理事件的修饰符
      // support .foo shorthand syntax for the .prop modifier
      if (propBindRE.test(name)) {
        (modifiers || (modifiers = {})).prop = true
        name = `.` + name.slice(1).replace(modifierRE, '')
      } else if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind
        name = name.replace(bindRE, '')
        value = parseFilters(value)
        isProp = false
        if (
          process.env.NODE_ENV !== 'production' &&
          value.trim().length === 0
        ) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          )
        }
        if (modifiers) {
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel) {
            name = camelize(name)
          }
          if (modifiers.sync) {
            syncGen = genAssignmentCode(value, `$event`)
            addHandler(
              el,
              `update:${camelize(name)}`,
              syncGen,
              null,
              false,
              warn,
              list[i]
            )
            if (hyphenate(name) !== camelize(name)) {
              addHandler(
                el,
                `update:${hyphenate(name)}`,
                syncGen,
                null,
                false,
                warn,
                list[i]
              )
            }
          }
        }
        if (isProp || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          addProp(el, name, value, list[i])
        } else {
          addAttr(el, name, value, list[i])
        }
      } else if (onRE.test(name)) { // v-on
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false, warn, list[i])
      } else { // normal directives
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        addDirective(el, name, rawName, value, arg, modifiers, list[i])
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          )
        }
      }
      addAttr(el, name, JSON.stringify(value), list[i])
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true', list[i])
      }
    }
  }
}

// 向父节点递归查询，确定当前节点是否处于父节点的 v-for 当中。
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

// 解析修饰符：并在修饰符存于对象
function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)  // 匹配修饰符
  if (match) {
    const ret = {}
    // 将多个修饰符解析后，存入一个数组。例如  v-on:keyup.alt.67 （Alt + C）  ===》 ret = {'.alt':true, '67': true}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

// 将 Attr 的由数组转化成 object，重复 Key 会覆盖
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name, attrs[i])
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
// 标签名是否为 script、style
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`,
        el.rawAttrsMap['v-model']
      )
    }
    _el = _el.parent
  }
}
