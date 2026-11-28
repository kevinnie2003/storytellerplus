// 说书人联机（玩家端）的 service worker：只负责收推送、弹通知、点通知回到页面。不缓存页面（要联网才能玩）
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* 不是 JSON 就用默认的字 */ }
  // 标题就是“说书人拍了拍你”，没有正文（iOS 会自己加一行“from 说书人联机”）
  event.waitUntil(self.registration.showNotification(data.title || '说书人拍了拍你', {
    body: data.body ?? '',
    tag: 'storyteller',
    renotify: true,
    icon: new URL('../icon.jpg', self.registration.scope).href,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const page = list.find((c) => c.url.startsWith(self.registration.scope))
    if (page) return page.focus()
    return self.clients.openWindow(self.registration.scope)
  })())
})
