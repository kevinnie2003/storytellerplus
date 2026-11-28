// 手机上的通知：玩家这边是说书人找你，说书人这边是玩家私信、回复你；切到别的 app 时系统弹一条提醒
// iPhone 要先“添加到主屏幕”、从主屏幕打开才能收；安卓和电脑的浏览器直接就能收
import { relayURL } from './relay'
import type { PushSub } from './protocol'

export type PushState =
  /** 这个浏览器不支持 */
  | 'unsupported'
  /** iPhone 的 Safari：要先添加到主屏幕 */
  | 'ios-install'
  /** 还没问过 */
  | 'default'
  | 'granted'
  | 'denied'

export function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function pushState(): PushState {
  if (!supported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
}

/** 玩家页面用 online/sw.js；说书人的魔典用主程序的 sw.js（pwa.ts 已经注册好了） */
async function registration(): Promise<ServiceWorkerRegistration> {
  const scope = `${import.meta.env.BASE_URL}online/`
  if (location.pathname.startsWith(scope)) await navigator.serviceWorker.register(`${scope}sw.js`, { scope })
  return navigator.serviceWorker.ready
}

let keyCache: Uint8Array | null = null
async function publicKey(): Promise<Uint8Array> {
  if (keyCache) return keyCache
  const res = await fetch(`${relayURL()}/push-key`)
  if (!res.ok) throw new Error('联机服务没有开通知功能')
  const { key } = await res.json() as { key: string }
  const bin = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((key.length + 3) % 4))
  keyCache = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return keyCache
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i])

/** 拿到推送订阅：没有就订一个（服务器换了公钥也重新订） */
export async function getSubscription(): Promise<PushSub | null> {
  if (pushState() !== 'granted') return null
  const reg = await registration()
  const key = await publicKey()
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })
  return sub.toJSON() as PushSub
}

/** 玩家点“开启通知”：先问权限（必须在点击里直接问），再订阅 */
export async function askPermission(): Promise<PushState> {
  if (!supported()) return pushState()
  await Notification.requestPermission()
  return pushState()
}
