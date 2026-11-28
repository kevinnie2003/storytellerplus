// 把一块界面画成长图并保存，对应 iPad 版的 ImageRenderer + UIImageWriteToSavedPhotosAlbum。
// 网页没有相册：触屏设备上能分享文件就弹分享（可以存进相册），否则直接下载。
import { toPng } from 'html-to-image'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { showAlert } from '../ui/Alert'
import { iconDataURLs } from '../ui/iconData'

const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
/** Safari 的画布最多一千六百多万像素 */
const MAX_PIXELS = 16_000_000

/** 先把图标下载成 data URL（直接取不到会走中转，见 ui/iconData.ts） */
export async function preloadImages(urls: string[]): Promise<Record<string, string>> {
  return iconDataURLs(urls)
}

/** 在屏幕外渲染 element，画成 PNG（data URL） */
export async function renderToPng(element: React.ReactNode, width: number): Promise<string> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(element))
    await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.decode().catch(() => undefined)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const node = host.firstElementChild as HTMLElement
    const w = node.offsetWidth
    const h = node.offsetHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const pixelRatio = Math.max(1, Math.min(dpr, Math.sqrt(MAX_PIXELS / Math.max(1, w * h))))
    const bg = getComputedStyle(document.body).backgroundColor
    const base = { width: w, height: h, pixelRatio, backgroundColor: bg, imagePlaceholder: BLANK, skipFonts: true }
    try {
      return await toPng(node, base)
    } catch {
      // 某张图画不进去时，去掉所有图片再画一次，至少把字存下来
      return await toPng(node, { ...base, filter: (n) => !(n instanceof HTMLImageElement) })
    }
  } finally {
    root.unmount()
    host.remove()
  }
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], name, { type: 'image/png' })
}

function download(files: File[]) {
  files.forEach((file, i) => {
    window.setTimeout(() => {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }, i * 300)
  })
}

type SaveResult = 'shared' | 'downloaded' | 'cancelled'

async function share(files: File[]): Promise<SaveResult | 'blocked'> {
  try {
    await navigator.share({ files })
    return 'shared'
  } catch (e) {
    const name = (e as Error)?.name
    if (name === 'AbortError') return 'cancelled'
    if (name === 'NotAllowedError') return 'blocked'
    return 'blocked'
  }
}

/**
 * 保存图片。触屏设备上能分享文件就弹分享（可以存进相册），否则下载。
 * 画图花了时间，浏览器可能不再认为是用户点的、不让分享，这时再弹一次提示让用户点“保存”。
 */
export async function saveImages(images: { name: string; dataUrl: string }[]): Promise<SaveResult> {
  const files = await Promise.all(images.map((i) => dataUrlToFile(i.dataUrl, i.name)))
  const touch = navigator.maxTouchPoints > 0
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    const first = await share(files)
    if (first !== 'blocked') return first
    return new Promise<SaveResult>((resolve) => {
      showAlert({
        title: '长图画好了',
        message: files.length > 1 ? `一共 ${files.length} 张。` : undefined,
        buttons: [
          { label: '取消', role: 'cancel', action: () => resolve('cancelled') },
          {
            label: '保存',
            action: () => {
              share(files).then((r) => {
                if (r === 'blocked') { download(files); resolve('downloaded') } else resolve(r)
              })
            },
          },
        ],
      })
    })
  }
  download(files)
  return 'downloaded'
}

export function timestampName(prefix: string, suffix = '') {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${suffix}.png`
}
