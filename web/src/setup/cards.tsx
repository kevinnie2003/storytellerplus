// 配版用的卡牌正反面（CardFront.swift / CardBack.swift）和几个共用的小东西
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Character } from '../game/types'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'

/**
 * 卡牌的框：200×300 的底色，上面叠两圈圆角描边（SwiftUI 的 stroke 骑在边线上，一半在外一半在里）：
 * 14 宽的底色描边、4 宽的白色描边，圆角都是 10。
 *
 * dim：SwiftUI 的 .opacity 不会先把整张牌合成再变透明，而是每一层各自变透明再叠起来。
 * 所以变淡的牌上，白圈里面那一圈（底色 + 底色描边叠了两层）会更深，外面那半圈描边更浅。这里每层分别加透明度来还原
 */
const layer = (dim: number): React.CSSProperties => ({ opacity: dim, transition: 'opacity .3s ease-in-out' })

function CardFrame({ color, children, dim = 1 }: { color: string; children: React.ReactNode; dim?: number }) {
  return (
    <div style={{ position: 'relative', width: 200, height: 300, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: color, ...layer(dim) }} />
      {children}
      <div style={{ position: 'absolute', inset: -7, border: `14px solid ${color}`, borderRadius: 17, pointerEvents: 'none', ...layer(dim) }} />
      <div style={{ position: 'absolute', inset: -2, border: '4px solid #fff', borderRadius: 12, pointerEvents: 'none', ...layer(dim) }} />
    </div>
  )
}

export function CardFront({ character, cardColor, dim = 1 }: { character: Character; cardColor: string; dim?: number }) {
  return (
    <CardFrame color={cardColor} dim={dim}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ position: 'relative', marginTop: 20, width: 140, height: 140, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--goodTextBg)', ...layer(dim) }} />
          <div style={{ position: 'relative', ...layer(dim) }}><CachedImage url={character.imageURL} size={140} /></div>
        </div>
        <div style={{
          flex: 1, alignSelf: 'stretch', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 0,
        }}>
          <div style={{ ...rounded(35, 700), color: 'var(--goodTextBg)', textAlign: 'center', ...layer(dim) }}>{character.name}</div>
        </div>
      </div>
    </CardFrame>
  )
}

const cardBackURL = `${import.meta.env.BASE_URL}card_back.png`

/** 卡背：问号图当遮罩，涂成 goodTextBg（.renderingMode(.template)），底色是阵营色 */
export function CardBack({ cardColor, dim = 1 }: { cardColor: string; dim?: number }) {
  return (
    <CardFrame color={cardColor} dim={dim}>
      <div style={{
        position: 'absolute', inset: 0, background: 'var(--goodTextBg)',
        WebkitMaskImage: `url(${cardBackURL})`, maskImage: `url(${cardBackURL})`,
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        ...layer(dim),
      }} />
    </CardFrame>
  )
}

/** 阵营色，配版页里重复角色、抽卡页都这样取 */
export const cardColorOf = (team: string, fallback = 'var(--townsfolk)') =>
  team === 'demon' ? 'var(--demon)' : team === 'minion' ? 'var(--minion)' : team === 'outsider' ? 'var(--outsider)'
    : team === 'townsfolk' ? 'var(--townsfolk)' : fallback

/**
 * SwiftUI-Flow 的 HFlow：一行排满换行，间距用系统默认的 8。
 * center：每一行各自居中（horizontalAlignment: .center）。
 * 默认（.leading）时，HFlow 的宽度只包住最宽的那一行，放在居中的 VStack 里整块居中、行内靠左。
 * CSS 的换行 flex 做不到“包住内容”，所以量一下子元素的宽度自己算
 */
export function HFlow({ center, children, style, ...rest }: {
  center?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const [hugWidth, setHugWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (center) return
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const avail = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingLeft) - parseFloat(getComputedStyle(parent).paddingRight) - padX
      let row = 0
      let widest = 0
      for (const c of Array.from(el.children) as HTMLElement[]) {
        const w = c.offsetWidth
        const next = row === 0 ? w : row + 8 + w
        if (next > avail && row > 0) { widest = Math.max(widest, row); row = w } else row = next
      }
      widest = Math.max(widest, row)
      setHugWidth(widest > 0 ? Math.ceil(widest + padX) : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [center])
  return (
    <div
      {...rest}
      ref={ref}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: center ? 'flex-start' : 'center',
        justifyContent: center ? 'center' : 'flex-start',
        width: center || hugWidth === null ? '100%' : hugWidth, maxWidth: '100%', alignSelf: 'center',
        marginLeft: 'auto', marginRight: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * 配版页的方角描边按钮：mainbg 底、圆角 10。
 * SwiftUI 的描边骑在边线上不占地方，CSS 的 border 占地方，所以内边距减掉半条线，外框大小和 iPad 一样
 */
export const boxButton = (size: number, padH: number, padV: number, line: number): React.CSSProperties => ({
  ...rounded(size, 700), color: 'var(--ink)', padding: `${padV - line / 2}px ${padH - line / 2}px`, background: 'var(--mainbg)',
  border: `${line}px solid var(--ink)`, borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
})

/** SF Symbol plus.circle.fill：实心圆，中间的加号是镂空的 */
export function PlusCircleFill({ size, color = 'var(--ink)' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <defs>
        <mask id="st-plus-hole">
          <rect width="100" height="100" fill="#fff" />
          <path d="M50 27 V73 M27 50 H73" stroke="#000" strokeWidth="8.5" strokeLinecap="round" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="50" fill={color} mask="url(#st-plus-hole)" />
    </svg>
  )
}

/** 出现时淡入、消失时淡出再卸载（SwiftUI 的 if + 动画），返回要不要渲染、现在是不是显示 */
export function usePresence(open: boolean, ms: number) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      let r2 = 0
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)) })
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }
    setShown(false)
    const t = window.setTimeout(() => setMounted(false), ms)
    return () => window.clearTimeout(t)
  }, [open, ms])
  return { mounted: mounted || open, shown: open && shown }
}
