// 说书人普拉斯离线用的 service worker
// 1. 页面本身（index.html、打包出来的 js/css、public 里的图片和演示剧本）存一份，断网也能打开
// 2. 角色图标（其他网站上的图片）第一次加载后一直留在本机，和 iPad 版 IconCache 一样先查缓存
// AI 提供商的接口不经过这里：只处理 GET，跨域的只处理图片
const SHELL_CACHE = 'st-shell-v1'
const ICON_CACHE = 'st-icons-v1'
const DEV = new URL(self.location.href).searchParams.has('dev')
const SCOPE = new URL('./', self.location.href).href
const INDEX_URL = SCOPE

// 开局要用的固定文件
const SHELL_FILES = ['', 'index.html', 'manifest.webmanifest', 'icon.jpg', 'card_back.png', 'demo-trouble-brewing.json']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (DEV) return
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await Promise.all(SHELL_FILES.map((f) => cache.add(new Request(SCOPE + f, { cache: 'reload' })).catch(() => {})))
    // 顺着首页找到打包出来的 js 和 css
    try {
      const res = await cache.match(INDEX_URL)
      const html = res ? await res.text() : ''
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => new URL(m[1], SCOPE))
        .filter((u) => u.origin === self.location.origin)
        .map((u) => u.href)
      await Promise.all(urls.map((u) => cache.add(u).catch(() => {})))
    } catch { /* 下次打开时会边用边存 */ }
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = DEV ? [ICON_CACHE] : [SHELL_CACHE, ICON_CACHE]
    for (const name of await caches.keys()) {
      if (name.startsWith('st-') && !keep.includes(name)) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

// 页面告诉我们它第一次加载时用到的文件
self.addEventListener('message', (event) => {
  const data = event.data
  if (DEV || !data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    for (const u of data.urls) {
      try {
        const url = new URL(u)
        if (url.origin !== self.location.origin || !isShellPath(url)) continue
        url.hash = ''
        if (await cache.match(url.href)) continue
        await cache.add(url.href)
      } catch { /* 跳过 */ }
    }
  })())
})

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i

function isShellPath(url) {
  // 开发服务器的内部路径不存
  return !/^\/(@vite|@id|@fs|@react-refresh|node_modules|src)\b/.test(url.pathname) && !url.pathname.endsWith('/sw.js')
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  if (url.origin !== self.location.origin) {
    // 跨域：只管图片。AI 接口、字体等一律直接走网络
    // wsrv.nl 是生成图片时取图标用的中转（见 src/ui/iconData.ts），也当图标存
    if (req.destination === 'image' || url.hostname === 'wsrv.nl' || (req.destination === '' && IMAGE_EXT.test(url.pathname))) {
      event.respondWith(iconFirst(event, req))
    }
    return
  }

  if (DEV || !isShellPath(url)) return
  // 玩家用的“说书人联机”（online/，以前叫 pro/）要联网才能用，不走缓存，也不能把它的页面存成魔典的首页
  if (['online', 'pro'].some((p) => url.href.startsWith(SCOPE + p + '/') || url.href === SCOPE + p)) return
  if (req.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(req))
  } else {
    event.respondWith(shellCacheFirst(req))
  }
})

// ---------- 角色图标：先查缓存 ----------

/** 不让读内容的网站（opaque）看不出下载成功没有，这样存下的图标每次打开 app 时再在后台刷新一次 */
const refreshed = new Set()
/** 不支持跨域读取的网站，以后直接按 no-cors 下载 */
const noCorsOrigins = new Set()

async function downloadIcon(req) {
  const url = req.url
  const origin = new URL(url).origin
  if (!noCorsOrigins.has(origin)) {
    try {
      return await fetch(new Request(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }))
    } catch {
      noCorsOrigins.add(origin)
    }
  }
  return fetch(new Request(url, { mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer' }))
}

async function storeIcon(cacheKey, res) {
  // 只存下载成功的；opaque 的看不出来，先存着，之后在后台刷新
  if (!(res.ok || res.type === 'opaque')) return
  try {
    const cache = await caches.open(ICON_CACHE)
    await cache.put(cacheKey, res)
  } catch { /* 空间满了就算了 */ }
}

async function iconFirst(event, req) {
  const key = req.url
  let cached
  try {
    const cache = await caches.open(ICON_CACHE)
    cached = await cache.match(key)
  } catch { /* 读不到缓存就直接下载 */ }
  if (cached && usable(cached, req)) {
    if (cached.type === 'opaque' && !refreshed.has(key)) {
      refreshed.add(key)
      event.waitUntil(downloadIcon(req).then((res) => storeIcon(key, res)).catch(() => {}))
    }
    return cached
  }
  try {
    const res = await downloadIcon(req)
    if (res.ok || res.type === 'opaque') {
      refreshed.add(key)
      event.waitUntil(storeIcon(key, res.clone()))
    }
    if (usable(res, req)) return res
    return fetch(req)
  } catch {
    if (cached) return cached
    return Response.error()
  }
}

/** opaque 的回应只能给 <img> 这种 no-cors 请求用 */
function usable(res, req) {
  return res.type !== 'opaque' || req.mode === 'no-cors'
}

// ---------- 页面本身 ----------

async function pageNetworkFirst(req) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const res = await withTimeout(fetch(req), 4000)
    if (res.ok) cache.put(INDEX_URL, res.clone()).catch(() => {})
    return res
  } catch {
    return (await cache.match(INDEX_URL)) || (await cache.match(SCOPE + 'index.html')) || Response.error()
  }
}

async function shellCacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(req, { ignoreSearch: false })
  // 打包出来带哈希的文件不会变，直接用缓存；其他的用缓存的同时在后台更新
  const hashed = /\/assets\//.test(new URL(req.url).pathname)
  const update = () => fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {})
    return res
  })
  if (cached) {
    if (!hashed) update().catch(() => {})
    return cached
  }
  return update().catch(() => Response.error())
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

// 说书人联机：玩家私信、回复说书人时的推送通知（玩家页面的通知在 online/sw.js）
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* 不是 JSON 就用默认的字 */ }
  event.waitUntil(self.registration.showNotification(data.title || '有玩家在找你', {
    body: data.body ?? '',
    tag: 'storyteller-host',
    renotify: true,
    icon: SCOPE + 'icon.jpg',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const page = list.find((c) => c.url.startsWith(SCOPE) && !c.url.startsWith(SCOPE + 'online/'))
    if (page) return page.focus()
    return self.clients.openWindow(SCOPE)
  })())
})
