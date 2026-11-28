// 离线支持：注册 service worker（public/sw.js），挂上 manifest。
// 角色图标存在 Cache Storage 里，对应 iPad 版的 IconCache，设置页的“图标缓存”读写的就是这一份
export const ICON_CACHE = 'st-icons-v1'

const base = import.meta.env.BASE_URL

function addHeadLink(rel: string, href: string) {
  if (document.head.querySelector(`link[rel="${rel}"]`)) return
  const link = document.createElement('link')
  link.rel = rel
  link.href = href
  document.head.appendChild(link)
}

let started = false

/** 开始页调用一次 */
export function setupPWA() {
  if (started || typeof window === 'undefined') return
  started = true
  addHeadLink('manifest', `${base}manifest.webmanifest`)
  addHeadLink('apple-touch-icon', `${base}icon.jpg`)
  if (!('serviceWorker' in navigator)) return
  // 开发服务器上只缓存图标，不缓存页面本身，免得改了代码看不到
  const url = `${base}sw.js${import.meta.env.DEV ? '?dev=1' : ''}`
  const register = () => {
    navigator.serviceWorker.register(url, { scope: base }).then(async (reg) => {
      await navigator.serviceWorker.ready
      if (import.meta.env.DEV) return
      // 第一次打开时页面已经在 service worker 接管之前加载完了，把已经用到的文件告诉它，一起存起来
      const same = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin))
      ;(reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'cache-urls', urls: [location.href, ...same] })
    }).catch(() => { /* 不支持或者被禁了就算了，只是不能离线 */ })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

/** 本机图标缓存的个数和字节数。跨域又不允许读的图标（opaque）读不到大小，只算个数 */
export async function iconCacheUsage(): Promise<{ bytes: number; count: number }> {
  if (typeof caches === 'undefined') return { bytes: 0, count: 0 }
  try {
    if (!(await caches.has(ICON_CACHE))) return { bytes: 0, count: 0 }
    const cache = await caches.open(ICON_CACHE)
    const keys = await cache.keys()
    let bytes = 0
    for (const req of keys) {
      const res = await cache.match(req)
      if (!res) continue
      const len = Number(res.headers.get('content-length'))
      if (len > 0) { bytes += len; continue }
      if (res.type !== 'opaque') {
        try { bytes += (await res.blob()).size } catch { /* 读不到就不算 */ }
      }
    }
    return { bytes, count: keys.length }
  } catch {
    return { bytes: 0, count: 0 }
  }
}

/** 清空本机图标缓存（页面上已经显示的不受影响，下次有网时会重新下载） */
export async function clearIconCache() {
  if (typeof caches === 'undefined') return
  try { await caches.delete(ICON_CACHE) } catch { /* 删不掉就算了 */ }
}
