// 把一块界面画成图片（html-to-image）。
// iPad / Mac 的 Safari 有个老问题：第一次画的时候，里面的图片往往还没解码好，画出来是空的。
// 办法是同一块界面连画几次，用最后一次的结果。其他浏览器画一次就够了。
import { toBlob, toPng } from 'html-to-image'

type Options = NonNullable<Parameters<typeof toPng>[1]>

const isWebKit = typeof navigator !== 'undefined'
  && /AppleWebKit/.test(navigator.userAgent)
  && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent)

/** Safari 要画几次：图片越多越容易漏，多画几次（3 张图 3 次，15 张图 6 次） */
const passes = (node: HTMLElement) => {
  const images = node.querySelectorAll('img').length
  if (!isWebKit || images === 0) return 1
  return Math.min(2 + Math.ceil(images / 4), 6)
}

export async function snapshotPng(node: HTMLElement, options: Options): Promise<string> {
  let result = ''
  for (let i = 0; i < passes(node); i++) result = await toPng(node, options)
  return result
}

export async function snapshotBlob(node: HTMLElement, options: Options): Promise<Blob | null> {
  let result: Blob | null = null
  for (let i = 0; i < passes(node); i++) result = await toBlob(node, options)
  return result
}
