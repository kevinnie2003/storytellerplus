// 整局记录的列表，对应 ConversationView.swift 里的 ConversationLogView，
// 以及 SaveConversation.swift 里存长图用的 ConversationLogViewFixed（fixed = true）
import { createContext, useContext } from 'react'
import type { GameLogEntry } from '../game/types'
import { teamIdColor } from '../game/teams'
import { rounded } from '../ui/kit'
import { edgeBorder, stroke, systemGreen, systemRed } from './common'

/** 字号和圆圈大小：默认是 iPad 的，手机上整体缩小、一行放不下就换行 */
interface LogSize { font: number; circle: number; boxPad: number; boxed: number; band: number; big: number; mid: number; wrap: boolean }
const IPAD: LogSize = { font: 20, circle: 40, boxPad: 10, boxed: 50, band: 16, big: 30, mid: 25, wrap: false }
const PHONE: LogSize = { font: 16, circle: 30, boxPad: 7, boxed: 38, band: 10, big: 22, mid: 18, wrap: true }
const SizeCtx = createContext<LogSize>(IPAD)
const useSize = () => useContext(SizeCtx)

function PlayerNumberCircle({ playerNumber, playerTeam }: { playerNumber: number; playerTeam: number }) {
  const z = useSize()
  const isPlayer = playerNumber < 21
  return (
    <span style={{ padding: '0 2px', flexShrink: 0 }}>
      <span style={{
        ...rounded(z.font, 600), color: 'var(--goodTextBg)', width: z.circle, height: z.circle, borderRadius: '50%',
        background: teamIdColor(playerTeam), display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{isPlayer ? playerNumber : '说'}</span>
    </span>
  )
}

function PlayerCharacterBox({ playerCharacter, playerTeam }: { playerCharacter: string; playerTeam: number }) {
  const z = useSize()
  return (
    <span style={{ padding: '0 2px', flexShrink: 0 }}>
      <span style={{
        ...rounded(z.font, 600), color: 'var(--goodTextBg)', padding: `0 ${z.boxPad}px`, height: z.circle, borderRadius: 10,
        background: teamIdColor(playerTeam), display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
      }}>{playerCharacter}</span>
    </span>
  )
}

/** HStack + .frame(maxWidth: .infinity, alignment: ...)；手机上放不下就换行 */
const row = (z: LogSize, justify: 'flex-start' | 'center' | 'flex-end', extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: justify, gap: 8, width: '100%',
  ...(z.wrap ? { flexWrap: 'wrap', rowGap: 4 } : null), ...extra,
})

/** 带框的一段：.padding(.horizontal, 10).frame(minHeight: 50).overlay(RoundedRectangle(10).stroke(lineWidth: 2)) */
const boxed = (z: LogSize, minHeight = z.boxed): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 2, padding: z.wrap ? '4px 8px' : '0 10px', minHeight, minWidth: 0, ...stroke(2, 10),
  ...(z.wrap ? { flexWrap: 'wrap', rowGap: 4, overflowWrap: 'anywhere' } : null),
})

/** 上下两条线的一行：.padding().frame(maxWidth: .infinity).border(top, bottom).padding(.vertical, v) */
function Banded({ children, line, inner, outer, wrap }: {
  children: React.ReactNode
  line: number
  inner: string | number
  outer: number
  wrap?: boolean
}) {
  const z = useSize()
  // 手机上一律可以换行
  const w = wrap || z.wrap
  return (
    <div style={{ padding: `${outer}px 0`, width: '100%' }}>
      <div style={{ padding: inner, boxShadow: edgeBorder(line, ['top', 'bottom']), display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: w ? 'inline-flex' : 'flex', flexWrap: w ? 'wrap' : 'nowrap', alignItems: 'center',
          justifyContent: z.wrap ? 'center' : undefined, columnGap: w ? 2 : 4, rowGap: 8, maxWidth: '100%', minWidth: 0,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Word({ text, weight = 700, color = 'var(--ink)' }: { text: string; weight?: number; color?: string }) {
  const z = useSize()
  return <span style={{ ...rounded(z.font, weight), color, padding: z.wrap ? 3 : 5, whiteSpace: 'pre' /* 保留结尾的空格，和 SwiftUI 的 Text 一样 */ }}>{text}</span>
}
const word = (text: string, weight = 700, color = 'var(--ink)'): React.ReactNode => <Word text={text} weight={weight} color={color} />

/** "获得标签: " + 标签（来源阵营色）+ "，来源为：" */
function TagText({ prefix, message, team }: { prefix: string; message: string; team: number }) {
  const z = useSize()
  return (
    <span style={{ ...rounded(z.font, 600), color: 'var(--ink)' }}>
      {prefix}<span style={{ color: teamIdColor(team) }}>{message}</span>，来源为：
    </span>
  )
}

function Entry({ entry, index, allLogs, playerCount, fixed }: {
  entry: GameLogEntry
  index: number
  allLogs: GameLogEntry[]
  playerCount: number
  fixed: boolean
}) {
  const z = useSize()
  const t20 = (weight: number, color = 'var(--ink)'): React.CSSProperties => ({ ...rounded(z.font, weight), color })
  const teams = entry.playerTeams ?? []
  const chars = entry.playerCharacters ?? []
  const nums = entry.playerNumbers ?? []
  const team0 = teams[0] ?? 5
  const team1 = teams[1] ?? 5
  const char0 = chars[0] ?? ''
  const char1 = chars[1] ?? ''

  switch (entry.type) {
    case 0:
      return (
        <div style={row(z, 'flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <div style={boxed(z)}>
            <span style={{ ...t20(600), whiteSpace: 'pre' }}>获得角色: </span>
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          </div>
        </div>
      )
    case 1:
      return (
        <div style={row(z, 'flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          <div style={boxed(z)}>
            <TagText prefix="获得标签: " message={entry.message} team={team1} />
            {nums.length > 0 && nums[0] >= 0 ? <PlayerNumberCircle playerNumber={nums[0] + 1} playerTeam={team1} /> : null}
            <PlayerCharacterBox playerCharacter={char1} playerTeam={team1} />
          </div>
        </div>
      )
    case 2:
      return (
        <Banded line={2} inner={z.band} outer={entry.messager < 0 ? 5 : 10}>
          {entry.messager < 0 ? null : <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />}
          <PlayerCharacterBox playerCharacter={entry.characterName} playerTeam={team0} />
          {word('被唤醒了')}
        </Banded>
      )
    case 3: {
      const isPlayer = fixed ? entry.messager < playerCount : entry.messager <= playerCount
      const bubble = (
        <span style={{ ...t20(600), ...boxed(z), display: 'flex' }}>{entry.message}</span>
      )
      // 说话这一行不换行，让气泡自己变窄折行
      return isPlayer ? (
        <div style={row(z, 'flex-start', { padding: '3px 0', flexWrap: 'nowrap' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          {bubble}
        </div>
      ) : (
        <div style={row(z, 'flex-end', { padding: '3px 0', flexWrap: 'nowrap' })}>
          {bubble}
          <PlayerNumberCircle playerNumber={21} playerTeam={5} />
        </div>
      )
    }
    case 4:
      return (
        <Banded line={2} inner={z.band} outer={5} wrap>
          {entry.messager < 21 ? (
            <>
              <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
              {word('号玩家')}
            </>
          ) : null}
          <PlayerCharacterBox playerCharacter={entry.characterName} playerTeam={team0} />
          {word('提名了')}
          {team1 !== 5 ? (
            <>
              <PlayerNumberCircle playerNumber={nums[1] ?? 0} playerTeam={team1} />
              {word('号玩家')}
            </>
          ) : null}
          <PlayerCharacterBox playerCharacter={char1} playerTeam={team1} />
        </Banded>
      )
    case 5:
      return (
        <Banded line={2} inner={z.band} outer={5} wrap>
          {word('投票结果: ')}
          {nums.map((n, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {n < 21 ? <PlayerNumberCircle playerNumber={n} playerTeam={teams[i] ?? 5} /> : null}
              <PlayerCharacterBox playerCharacter={chars[i] ?? ''} playerTeam={teams[i] ?? 5} />
              {i < nums.length - 1 ? word(', ') : null}
            </span>
          ))}
        </Banded>
      )
    case 6:
    case 12:
      return (
        <Banded line={2} inner={z.band} outer={5}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlayerNumberCircle playerNumber={nums[0] ?? 0} playerTeam={team0} />
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
            {entry.type === 6 ? word('死亡', 700, systemRed) : word('复活', 700, systemGreen)}
          </span>
        </Banded>
      )
    case 7:
      return (
        <div style={row(z, 'flex-start', { padding: '5px 0' })}>
          <span style={{ padding: '0 2px' }}>
            <span style={{
              ...t20(600), width: z.circle, height: z.circle, display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...stroke(2, 20),
            }}>{nums[0] ?? ''}</span>
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            <span style={{ ...t20(700), ...boxed(z, z.circle), display: 'flex' }}>进入游戏</span>
          </div>
        </div>
      )
    case 8:
    case 9:
    case 10:
    case 11: {
      let text = '游戏开始'
      if (entry.type === 9) text = '进入第1个夜晚'
      if (entry.type === 10) text = `进入第${allLogs.slice(0, index + 1).filter((l) => l.type === 10).length}个白天`
      if (entry.type === 11) text = `进入第${allLogs.slice(0, index + 1).filter((l) => l.type === 11).length + 1}个夜晚`
      return (
        <Banded line={3} inner={0} outer={15}>
          <span style={{ ...rounded(z.big, 900), padding: '10px 2px' }}>{text}</span>
        </Banded>
      )
    }
    case 13:
      return (
        <Banded line={3} inner={0} outer={10}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ ...rounded(z.mid, 700), padding: '10px 2px', whiteSpace: 'pre' }}>恶魔得知伪装: </span>
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          </span>
        </Banded>
      )
    case 14:
    case 15:
      return (
        <div style={row(z, 'flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          <div style={boxed(z)}>
            <TagText prefix={entry.type === 14 ? '失去标签: ' : '倒置标签: '} message={entry.message} team={team1} />
            <PlayerCharacterBox playerCharacter={char1} playerTeam={team1} />
          </div>
        </div>
      )
    case 16:
    case 17:
    case 18: {
      // 存长图的版本没有画全局标签
      if (fixed) return null
      const prefix = entry.type === 16 ? '全局获得标签: ' : entry.type === 17 ? '全局失去标签: ' : '全局倒置标签: '
      return (
        <Banded line={3} inner="5px 0" outer={15}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, ...(z.wrap ? { flexWrap: 'wrap', justifyContent: 'center' } : null) }}>
            <TagText prefix={prefix} message={entry.message} team={team0} />
            {nums.length > 0 && nums[0] >= 0 ? <PlayerNumberCircle playerNumber={nums[0] + 1} playerTeam={team0} /> : null}
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          </span>
        </Banded>
      )
    }
    default:
      return null
  }
}

export function ConversationLogView({ allLogs, playerCount, start = 0, end, fixed = false, compact = false }: {
  allLogs: GameLogEntry[]
  playerCount: number
  start?: number
  end?: number
  fixed?: boolean
  /** 手机版：字小一号，放不下就换行 */
  compact?: boolean
}) {
  const last = end ?? allLogs.length - 1
  const items: React.ReactNode[] = []
  for (let i = start; i <= last && i < allLogs.length; i++) {
    if (fixed && allLogs[i].type >= 16) continue
    items.push(
      <div key={allLogs[i].id ?? i} data-log-index={i} style={{ width: '100%' }}>
        <Entry entry={allLogs[i]} index={i} allLogs={allLogs} playerCount={playerCount} fixed={fixed} />
      </div>,
    )
  }
  const list = <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>{items}</div>
  return compact ? <SizeCtx.Provider value={PHONE}>{list}</SizeCtx.Provider> : list
}
