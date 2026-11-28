// 右栏面板的描边小工具

type Edge = 'top' | 'bottom' | 'leading' | 'trailing'

/** iPad 版的 .border(width:edges:color:) 是画在框里面的覆盖层，不占地方，这里用内阴影 */
export function edgeBorder(...specs: [number, Edge[]][]): string {
  const parts: string[] = []
  for (const [w, edges] of specs) {
    for (const e of edges) {
      if (e === 'top') parts.push(`inset 0 ${w}px 0 0 var(--ink)`)
      if (e === 'bottom') parts.push(`inset 0 -${w}px 0 0 var(--ink)`)
      if (e === 'leading') parts.push(`inset ${w}px 0 0 0 var(--ink)`)
      if (e === 'trailing') parts.push(`inset -${w}px 0 0 0 var(--ink)`)
    }
  }
  return parts.join(', ')
}

/** Circle().stroke(lineWidth: w)：描边骑在边线上，一半在里一半在外 */
export const circleStroke = (w: number, color = 'var(--ink)') =>
  `inset 0 0 0 ${w / 2}px ${color}, 0 0 0 ${w / 2}px ${color}`
