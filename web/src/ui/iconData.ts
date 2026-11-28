// 生成图片（整局记录长图、AI 复盘图）时要把角色图标画进去。
// 浏览器只允许把“对方网站允许跨站读取”的图片画进图片里，而集石等图标网站都不允许，
// 所以直接取不到时，改走 wsrv.nl（开源的公共图片中转，会加上允许跨站读取的头）。
// 取到的结果记在内存里，service worker 也会把中转的结果存起来，之后断网也能用。

const memo = new Map<string, Promise<string | null>>()

export const proxiedIconURL = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}`

async function fetchDataURL(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.type && !blob.type.startsWith('image/')) return null
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** 图标的 data URL：先直接跨站取，取不到再走中转 */
export function iconDataURL(url: string, timeoutMs = 10000): Promise<string | null> {
  if (!url) return Promise.resolve(null)
  if (url.startsWith('data:')) return Promise.resolve(url)
  let p = memo.get(url)
  if (!p) {
    p = (async () => (await fetchDataURL(url, timeoutMs)) ?? (await fetchDataURL(proxiedIconURL(url), timeoutMs)))()
    memo.set(url, p)
    // 失败的不记住，下次再试
    void p.then((v) => { if (v === null) memo.delete(url) })
  }
  return p
}

/** 一批图标 */
export async function iconDataURLs(urls: string[], timeoutMs = 10000): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all([...new Set(urls.filter(Boolean))].map(async (u) => {
    const d = await iconDataURL(u, timeoutMs)
    if (d) out[u] = d
  }))
  return out
}

/** 进小镇时在后台先取一遍，生成图片时就不用等，之后断网也画得出来 */
export function warmIcons(urls: string[]) {
  void iconDataURLs(urls, 15000)
}
