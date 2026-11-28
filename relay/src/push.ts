// Web Push：给玩家手机推一条通知（RFC 8291 加密 + RFC 8292 VAPID），只用 WebCrypto
import type { PushSub } from '../../web/src/net/protocol'

const enc = new TextEncoder()

/** 只往这几家浏览器的推送服务发，别的地址一律不发 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function pushAllowed(sub: PushSub): boolean {
  try {
    const url = new URL(sub.endpoint)
    if (url.protocol !== 'https:' || sub.endpoint.length > 1000) return false
    if (!PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) return false
    return typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string'
      && sub.keys.p256dh.length < 200 && sub.keys.auth.length < 100
  } catch {
    return false
  }
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64u(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parts) { out.set(p, i); i += p.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** aes128gcm 加密（RFC 8291） */
export async function encryptPayload(sub: PushSub, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = unb64u(sub.keys.p256dh)
  const auth = unb64u(sub.keys.auth)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, local.privateKey, 256))
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))))
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

async function vapid(endpoint: string, publicKey: string, privateJwk: string): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'https://kevinnie2003.github.io/storytellerplus/',
  })))
  const key = await crypto.subtle.importKey('jwk', JSON.parse(privateJwk) as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`))
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`
}

/** 发一条推送。返回 true 表示这个订阅已经失效（该删了） */
export async function sendPush(sub: PushSub, message: { title: string; body: string }, publicKey: string, privateJwk: string): Promise<boolean> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)))
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapid(sub.endpoint, publicKey, privateJwk),
      TTL: '600',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body,
  })
  if (!res.ok) console.log('push status', res.status, await res.text().catch(() => ''))
  return res.status === 404 || res.status === 410
}
