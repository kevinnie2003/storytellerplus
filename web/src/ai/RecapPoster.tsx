// AI 复盘的一图流：结构化的复盘内容画成一张 900 宽的长图，可以保存和分享。对应 iPad 版 Settings/RecapPoster.swift
// 导出的图片永远是浅色，不跟深色模式：海报根节点上把颜色变量都定死成浅色的值
import { flushSync } from 'react-dom'
import { iconDataURL } from '../ui/iconData'
import { createRoot } from 'react-dom/client'
import { toBlob } from 'html-to-image'
import type { GameSaveData } from '../game/types'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'

export interface RecapTurningPoint { when: string; text: string }
export interface RecapKeyInfo { player: string; info: string; effect: string; inferred: boolean }

export interface RecapData {
  winner: string
  headline: string
  turningPoints: RecapTurningPoint[]
  evil: string
  good: string
  /** 旧版只有一个本局最佳 */
  mvpPlayer: string
  mvpReason: string
  mvpWinPlayer: string
  mvpWinReason: string
  mvpLosePlayer: string
  mvpLoseReason: string
  keyInfo: RecapKeyInfo[]
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const obj = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

export function emptyRecap(): RecapData {
  return {
    winner: '', headline: '', turningPoints: [], evil: '', good: '', mvpPlayer: '', mvpReason: '',
    mvpWinPlayer: '', mvpWinReason: '', mvpLosePlayer: '', mvpLoseReason: '', keyInfo: [],
  }
}

/** 读存好的复盘：旧版没有 keyInfo 等字段，缺的按空值读 */
export function normalizeRecap(v: unknown): RecapData | null {
  const o = obj(v)
  if (!o) return null
  const r = emptyRecap()
  for (const k of Object.keys(r) as (keyof RecapData)[]) {
    if (k === 'turningPoints' || k === 'keyInfo') continue
    ;(r as unknown as Record<string, string>)[k] = s(o[k])
  }
  r.turningPoints = Array.isArray(o.turningPoints)
    ? o.turningPoints.map(obj).filter((x): x is Record<string, unknown> => x !== null).map((x) => ({ when: s(x.when), text: s(x.text) }))
    : []
  r.keyInfo = Array.isArray(o.keyInfo)
    ? o.keyInfo.map(obj).filter((x): x is Record<string, unknown> => x !== null)
      .map((x) => ({ player: s(x.player), info: s(x.info), effect: s(x.effect), inferred: x.inferred === true }))
    : []
  return r
}

/** 模型返回的 JSON → 复盘内容 */
export function recapFrom(object: Record<string, unknown>): RecapData {
  const r = emptyRecap()
  r.winner = s(object.winner)
  r.headline = s(object.headline)
  r.turningPoints = (Array.isArray(object.turning_points) ? object.turning_points : []).flatMap((item) => {
    const d = obj(item)
    if (!d || typeof d.text !== 'string') return []
    return [{ when: s(d.when), text: d.text }]
  })
  r.evil = s(object.evil)
  r.good = s(object.good)
  const mvp = obj(object.mvp)
  if (mvp) { r.mvpPlayer = s(mvp.player); r.mvpReason = s(mvp.reason) }
  const win = obj(object.mvp_win)
  if (win) { r.mvpWinPlayer = s(win.player); r.mvpWinReason = s(win.reason) }
  const lose = obj(object.mvp_lose)
  if (lose) { r.mvpLosePlayer = s(lose.player); r.mvpLoseReason = s(lose.reason) }
  r.keyInfo = (Array.isArray(object.key_info) ? object.key_info : []).flatMap((item) => {
    const d = obj(item)
    if (!d || typeof d.info !== 'string') return []
    const inferred = typeof d.inferred === 'boolean'
      ? d.inferred
      : typeof d.inferred === 'string' ? (d.inferred === 'true' || d.inferred.includes('推')) : true
    return [{ player: s(d.player), info: d.info, effect: s(d.effect), inferred }]
  })
  return r
}

// MARK: 海报

/** 浅色的颜色变量，和 theme.css 的 :root 一样 */
const lightVars = {
  '--mainbg': '#dedacd', '--paper': '#f6f1e2', '--ink': '#000000', '--goodTextBg': '#f6f1e2', '--evilTextBg': '#f6f1e2',
  '--townsfolk': '#0e7fcf', '--outsider': '#3988a0', '--minion': '#8f1701', '--demon': '#2b0303', '--traveler': '#670eab',
  '--fabled': '#ffa648', '--minionInk': '#8f1701', '--demonInk': '#2b0303', colorScheme: 'light',
} as React.CSSProperties

const posterTeamColor = (team: string) => {
  switch (team) {
    case 'townsfolk': return '#0e7fcf'
    case 'outsider': return '#3988a0'
    case 'minion': return '#8f1701'
    case 'demon': return '#2b0303'
    case 'traveler': return '#670eab'
    default: return '#ffa648'
  }
}

const GOOD = '#f6f1e2'
const TOWNSFOLK = '#0e7fcf'
const DEMON = '#2b0303'
const FABLED = '#ffa648'
const black = (a: number) => `rgba(0,0,0,${a})`

/** 画在海报上的图标：只用已经下载成 data URL 的，下载不到就画问号 */
function PosterIcon({ src }: { src: string | null }) {
  if (src) return <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
  return (
    <div style={{ width: '100%', height: '100%', color: black(0.3), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SFIcon name="questionmark.circle" size={58} />
    </div>
  )
}

function Block({ title, fill = GOOD, ink = '#000', children }: { title: string; fill?: string; ink?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: 20, flex: 1, minWidth: 0,
      background: fill, borderRadius: 20, border: '3px solid #000',
    }}>
      <div style={{ ...rounded(22, 900), color: ink }}>{title}</div>
      {children}
    </div>
  )
}

function MvpCard({ title, player, reason, star }: { title: string; player: string; reason: string; star: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6, padding: 20, flex: 1, minWidth: 0,
      background: GOOD, borderRadius: 20, border: '3px solid #000',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SFIcon name="star.fill" size={24} color={star} />
        <span style={{ ...rounded(18, 900), color: black(0.6) }}>{title}</span>
      </div>
      <div style={rounded(24, 900)}>{player}</div>
      <div style={{ ...rounded(17), color: black(0.7) }}>{reason}</div>
    </div>
  )
}

/** .lineLimit(1).minimumScaleFactor(0.7)：名字太长就缩小，最多缩到 0.7 倍 */
function nameSize(name: string, columns: number): number {
  const width = (900 - 64 - 32 - 8 * (columns - 1)) / columns
  const len = Array.from(name).length || 1
  return Math.max(14 * 0.7, Math.min(14, width / len))
}

const text = (size: number, weight: number | string = 400): React.CSSProperties => ({ ...rounded(size, weight), whiteSpace: 'pre-wrap', wordBreak: 'break-word' })

export function RecapPoster({ game, recap, icons }: { game: GameSaveData; recap: RecapData; icons: Record<string, string | null> }) {
  const winnerIsGood: boolean | null = recap.winner.includes('善')
    ? true
    : recap.winner.includes('邪') || recap.winner.includes('恶') ? false : null
  const dayCount = game.allLogs.filter((l) => l.type === 10).length
  const seats = game.playersAssignedCharacters
  const columns = Math.min(Math.max(seats.length, 1), 8)
  return (
    <div style={{
      ...lightVars, width: 900, padding: 32, background: '#dedacd', color: '#000',
      display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box', fontFamily: 'var(--font-rounded)',
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={text(44, 900)}>{game.playName === '' ? '无名剧本' : game.playName}</div>
          <div style={{ ...text(18, 600), color: black(0.6) }}>{`${seats.length} 人局 · ${dayCount} 天 · 存活 ${game.aliveCount} 人`}</div>
        </div>
        <div style={{
          ...rounded(24, 900), color: GOOD, padding: '12px 20px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
          background: winnerIsGood === null ? '#000' : winnerIsGood ? TOWNSFOLK : DEMON,
        }}>{winnerIsGood === null ? '胜负未定' : winnerIsGood ? '善良获胜' : '邪恶获胜'}</div>
      </div>

      {/* 一句话 */}
      <div style={{ ...text(26, 800), lineHeight: '37px' }}>{recap.headline}</div>

      {/* 座位 */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: 8, rowGap: 12,
        padding: 16, background: GOOD, borderRadius: 20, border: '3px solid #000',
      }}>
        {seats.map((c, i) => {
          const alive = i < game.playersIsAlive.length ? game.playersIsAlive[i] : true
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <div style={{
                position: 'relative', width: 58, height: 58, opacity: alive ? 1 : 0.45,
              }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: GOOD }} />
                <div style={{ position: 'absolute', inset: 0 }}><PosterIcon src={icons[c.imageURL] ?? null} /></div>
                <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: `4px solid ${posterTeamColor(c.team)}` }} />
                <div style={{
                  position: 'absolute', left: -6, top: -6, width: 24, height: 24, borderRadius: '50%', background: '#000',
                  color: GOOD, ...rounded(14, 900), display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
              </div>
              <div style={{
                ...rounded(nameSize(c.name, columns), 700), color: posterTeamColor(c.team),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{c.name}</div>
              {!alive ? <div style={{ ...rounded(11, 700), color: black(0.5) }}>死亡</div> : null}
            </div>
          )
        })}
      </div>

      {/* 关键转折 */}
      {recap.turningPoints.length > 0 ? (
        <Block title="关键转折">
          {recap.turningPoints.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                ...rounded(16, 900), color: GOOD, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                background: p.when.includes('夜') ? '#000' : TOWNSFOLK,
              }}>{p.when}</span>
              <div style={{ ...text(18), flex: 1, minWidth: 0 }}>{p.text}</div>
            </div>
          ))}
        </Block>
      ) : null}

      {/* 关键信息 */}
      {recap.keyInfo.length > 0 ? (
        <Block title="关键信息">
          {recap.keyInfo.map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={text(18, 900)}>{item.player}</span>
                {item.inferred ? (
                  <span style={{
                    ...rounded(13, 700), color: black(0.55), padding: '2px 8px', borderRadius: 999,
                    border: `1.5px solid ${black(0.4)}`, whiteSpace: 'nowrap',
                  }}>推测</span>
                ) : null}
              </div>
              <div style={text(18)}>{item.info}</div>
              {item.effect !== '' ? <div style={{ ...text(17, 600), color: TOWNSFOLK }}>{`→ ${item.effect}`}</div> : null}
            </div>
          ))}
        </Block>
      ) : null}

      {/* 双方 */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
        <Block title="邪恶方" fill={DEMON} ink={GOOD}>
          <div style={{ ...text(17), color: GOOD }}>{recap.evil}</div>
        </Block>
        <Block title="善良方" fill={TOWNSFOLK} ink={GOOD}>
          <div style={{ ...text(17), color: GOOD }}>{recap.good}</div>
        </Block>
      </div>

      {/* MVP：新版分胜方和败方，旧版只有一个本局最佳 */}
      {recap.mvpWinPlayer !== '' || recap.mvpLosePlayer !== '' ? (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
          {recap.mvpWinPlayer !== '' ? (
            <MvpCard title={winnerIsGood === null ? '善良方 MVP' : '胜方 MVP'} player={recap.mvpWinPlayer} reason={recap.mvpWinReason} star={FABLED} />
          ) : null}
          {recap.mvpLosePlayer !== '' ? (
            <MvpCard title={winnerIsGood === null ? '邪恶方 MVP' : '败方 MVP'} player={recap.mvpLosePlayer} reason={recap.mvpLoseReason} star={black(0.35)} />
          ) : null}
        </div>
      ) : recap.mvpPlayer !== '' ? (
        <MvpCard title="本局最佳" player={recap.mvpPlayer} reason={recap.mvpReason} star={FABLED} />
      ) : null}

      <div style={{ ...rounded(14, 600), color: black(0.4), textAlign: 'center' }}>说书人普拉斯 · AI 复盘</div>
    </div>
  )
}

// MARK: 下载图标、画图

/** 下载过的图标（data URL），null 表示下载失败（多半是图标站不允许跨域） */
const iconCache = new Map<string, string | null>()

export function cachedIcons(urls: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const u of urls) out[u] = iconCache.get(u) ?? null
  return out
}

export const iconIsCached = (url: string) => typeof iconCache.get(url) === 'string'

/** 把图标下载成 data URL，最多等 timeoutMs。先直接跨域取，取不到再试 <img crossOrigin> 画到画布上 */
export async function fetchIcons(urls: string[], timeoutMs = 8000): Promise<void> {
  const todo = urls.filter((u) => !iconIsCached(u))
  if (todo.length === 0) return
  const all = Promise.all(todo.map(async (u) => {
    const data = await iconDataURL(u, timeoutMs) ?? await imageAsDataURL(u)
    iconCache.set(u, data)
  }))
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))])
}

function imageAsDataURL(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d')?.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 把海报画成 PNG（2 倍） */
export async function renderRecapPoster(game: GameSaveData, recap: RecapData): Promise<Blob | null> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const urls = [...new Set(game.playersAssignedCharacters.map((c) => c.imageURL).filter((u) => u !== ''))]
    flushSync(() => root.render(<RecapPoster game={game} recap={recap} icons={cachedIcons(urls)} />))
    const node = host.firstElementChild as HTMLElement | null
    if (!node) return null
    await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => {})))
    if (document.fonts?.ready) await document.fonts.ready
    return await toBlob(node, { pixelRatio: 2, width: 900, backgroundColor: '#dedacd', skipFonts: true, cacheBust: false })
  } catch {
    return null
  } finally {
    root.unmount()
    host.remove()
  }
}
