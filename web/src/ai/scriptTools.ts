// 剧本条目的整理：补图标、合并 AI 给的改动，以及读图前缩图。对应 AIScriptImportView.swift 里的 AIScriptTools 和 aiPrepareImage
import { imageURLString } from '../game/loadScript'

export type ScriptItem = Record<string, unknown>

const s = (v: unknown) => (typeof v === 'string' ? v : '')

export function isCharacter(item: ScriptItem): boolean {
  const id = s(item.id)
  const team = s(item.team)
  return id !== '_meta' && !team.includes('jinx')
}

/** 用官方 id 补上图标链接，返回没有图标的角色名 */
export function fillIcons(items: ScriptItem[]): string[] {
  const missing: string[] = []
  for (const item of items) {
    if (!isCharacter(item)) continue
    const existing = imageURLString(item.image)
    const official = s(item.officialId).trim().toLowerCase()
    if (existing === '') {
      if (official !== '' && /^[\p{L}_]+$/u.test(official)) {
        item.image = `https://oss.gstonegames.com/data_file/clocktower/role_icon/${official}.png`
      } else {
        missing.push(s(item.name))
      }
    }
    delete item.officialId
  }
  return missing
}

function indexOf(key: string, items: ScriptItem[]): number {
  const i = items.findIndex((it) => it.id === key)
  if (i >= 0) return i
  return items.findIndex((it) => it.name === key)
}

const isObj = (v: unknown): v is ScriptItem => v !== null && typeof v === 'object' && !Array.isArray(v)

/** 把 AI 返回的改动合并进剧本，返回实际改动的条数 */
export function applyPatch(patch: ScriptItem, items: ScriptItem[]): number {
  let count = 0
  for (const change of (Array.isArray(patch.changes) ? patch.changes : []).filter(isObj)) {
    const key = typeof change.id === 'string' ? change.id : typeof change.name === 'string' ? change.name : ''
    const i = indexOf(key, items)
    const fields = change.set
    if (i < 0 || !isObj(fields)) continue
    items[i] = { ...items[i], ...fields }
    // 换了官方 id 就重新找图标
    if (fields.officialId !== undefined && fields.image === undefined) items[i].image = ''
    count += 1
  }
  for (const key of (Array.isArray(patch.remove) ? patch.remove : []).filter((k): k is string => typeof k === 'string')) {
    const i = indexOf(key, items)
    if (i >= 0 && items[i].id !== '_meta') {
      items.splice(i, 1)
      count += 1
    }
  }
  for (const item of (Array.isArray(patch.add) ? patch.add : []).filter(isObj)) {
    if (typeof item.id !== 'string' || typeof item.name !== 'string') continue
    const team = s(item.team)
    let last = -1
    items.forEach((it, j) => { if (it.team === team) last = j })
    if (last >= 0) items.splice(last + 1, 0, item)
    else items.push(item)
    count += 1
  }
  return count
}

/** 键按字母排好的 JSON（对应 JSONSerialization 的 .sortedKeys） */
function sortedJSON(v: unknown): string {
  return JSON.stringify(v, (_k, value) => {
    if (isObj(value)) {
      const out: ScriptItem = {}
      for (const k of Object.keys(value).sort()) out[k] = value[k]
      return out
    }
    return value
  })
}

/** 发给模型看的精简版 JSON（去掉图标链接这类它不需要改的字段） */
export function compactJSON(items: ScriptItem[]): string {
  const slim = items.map((item) => {
    const copy = { ...item }
    delete copy.image
    delete copy.edition
    delete copy.logo
    return copy
  })
  try { return sortedJSON(slim) } catch { return '[]' }
}

/** 把图片缩到模型能接受的大小并转成 JPEG，返回 base64（不带 data: 前缀） */
export async function aiPrepareImage(file: Blob, maxEdge = 2400): Promise<string | null> {
  let source: ImageBitmap | HTMLImageElement
  let width: number
  let height: number
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    source = bitmap
    width = bitmap.width
    height = bitmap.height
  } catch {
    const img = await loadImage(file)
    if (!img) return null
    source = img
    width = img.naturalWidth
    height = img.naturalHeight
  }
  const longest = Math.max(width, height)
  if (!longest) return null
  const ratio = longest > maxEdge ? maxEdge / longest : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // JPEG 没有透明，先铺白底（UIImage 画透明 PNG 转 JPEG 时也是这样）
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ('close' in source) source.close()
  let quality = 0.85
  let blob = await toJPEG(canvas, quality)
  while (blob && blob.size > 3_500_000 && quality > 0.4) {
    quality -= 0.15
    blob = await toJPEG(canvas, quality)
  }
  return blob ? blobToBase64(blob) : null
}

function toJPEG(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function loadImage(file: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const dataURL = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  return dataURL.slice(dataURL.indexOf(',') + 1)
}
