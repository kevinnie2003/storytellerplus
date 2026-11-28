// 右上角的局势信息：剧本名、应有、实有、存活。对应 iPad 版 SubViews/infos/*.swift
import { useGame } from '../game/store'
import { teamCounts } from '../game/builtins'
import { mono, rounded } from '../ui/kit'

const label: React.CSSProperties = { ...rounded(15, 600), lineHeight: 1.2 }
const n = (v: number | string) => <span style={mono(15, 700)}>{v}</span>
const t = (text: string, color: string) => <span style={{ ...rounded(15, 600), color }}>{text}</span>

function Counts({ c }: { c: number[] }) {
  return (
    <span style={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}>
      {n(c[0])}{t(' 民 ', 'var(--townsfolk)')}
      {n(c[1])}{t(' 外 ', 'var(--outsider)')}
      {n(c[2])}{t(' 爪 ', 'var(--minionInk)')}
      {n(c[3])}{t(' 恶' + (c[4] > 0 ? ' ' : ''), 'var(--demonInk)')}
      {c[4] > 0 ? n(c[4]) : null}{c[4] > 0 ? t(' 旅', 'var(--traveler)') : null}
    </span>
  )
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', whiteSpace: 'pre' }

export function PlayInfo() {
  const playName = useGame((s) => s.playName)
  const playAuthor = useGame((s) => s.playAuthor)
  return (
    <div style={{ ...rounded(20, 700), lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', width: '100%' }}>
      {playName}
      <span style={{ fontWeight: 600, opacity: 0.8 }}> by </span>
      {playAuthor}
    </div>
  )
}

export function TeamInfo() {
  const playerCount = useGame((s) => s.playerCount)
  if (playerCount < 5) {
    return <div style={{ ...mono(15, 600), lineHeight: 1.2, textAlign: 'right', width: '100%' }}>人数太少，当前有{playerCount}名玩家</div>
  }
  if (playerCount > 20) return <div />
  const c = teamCounts[playerCount] ?? [0, 0, 0, 0, 0]
  return (
    <div style={row}>
      <span style={label}>应有： </span>
      <div style={{ flex: 1 }} />
      <Counts c={c} />
    </div>
  )
}

export function TeamActualInfo() {
  const players = useGame((s) => s.playersAssignedCharacters)
  if (players.length < 5) return <div />
  const count = (team: string) => players.filter((p) => p.team === team).length
  return (
    <div style={row}>
      <span style={label}>实有： </span>
      <div style={{ flex: 1 }} />
      <Counts c={[count('townsfolk'), count('outsider'), count('minion'), count('demon'), count('traveler')]} />
    </div>
  )
}

export function SurvivorInfo() {
  const playerCount = useGame((s) => s.playerCount)
  const aliveCount = useGame((s) => s.aliveCount)
  if (playerCount < 5) return <div />
  return (
    <div style={{ ...row, ...mono(15, 600), lineHeight: 1.2 }}>
      <span>玩家: {playerCount}</span>
      <div style={{ flex: 1 }} />
      <span>存活: {aliveCount}</span>
    </div>
  )
}
