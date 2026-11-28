// 整局记录的列表，对应 ConversationView.swift 里的 ConversationLogView，
// 以及 SaveConversation.swift 里存长图用的 ConversationLogViewFixed（fixed = true）
import type { GameLogEntry } from '../game/types'
import { teamIdColor } from '../game/teams'
import { rounded } from '../ui/kit'
import { edgeBorder, stroke, systemGreen, systemRed } from './common'

function PlayerNumberCircle({ playerNumber, playerTeam }: { playerNumber: number; playerTeam: number }) {
  const isPlayer = playerNumber < 21
  return (
    <span style={{ padding: '0 2px', flexShrink: 0 }}>
      <span style={{
        ...rounded(20, 600), color: 'var(--goodTextBg)', width: 40, height: 40, borderRadius: '50%',
        background: teamIdColor(playerTeam), display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{isPlayer ? playerNumber : '说'}</span>
    </span>
  )
}

function PlayerCharacterBox({ playerCharacter, playerTeam }: { playerCharacter: string; playerTeam: number }) {
  return (
    <span style={{ padding: '0 2px', flexShrink: 0 }}>
      <span style={{
        ...rounded(20, 600), color: 'var(--goodTextBg)', padding: '0 10px', height: 40, borderRadius: 10,
        background: teamIdColor(playerTeam), display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
      }}>{playerCharacter}</span>
    </span>
  )
}

const t20 = (weight: number, color = 'var(--ink)'): React.CSSProperties => ({ ...rounded(20, weight), color })

/** HStack + .frame(maxWidth: .infinity, alignment: ...) */
const row = (justify: 'flex-start' | 'center' | 'flex-end', extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: justify, gap: 8, width: '100%', ...extra,
})

/** 带框的一段：.padding(.horizontal, 10).frame(minHeight: 50).overlay(RoundedRectangle(10).stroke(lineWidth: 2)) */
const boxed = (minHeight = 50): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px', minHeight, minWidth: 0, ...stroke(2, 10),
})

/** 上下两条线的一行：.padding().frame(maxWidth: .infinity).border(top, bottom).padding(.vertical, v) */
function Banded({ children, line, inner, outer, wrap }: {
  children: React.ReactNode
  line: number
  inner: string | number
  outer: number
  wrap?: boolean
}) {
  return (
    <div style={{ padding: `${outer}px 0`, width: '100%' }}>
      <div style={{ padding: inner, boxShadow: edgeBorder(line, ['top', 'bottom']), display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: wrap ? 'inline-flex' : 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center',
          columnGap: wrap ? 2 : 4, rowGap: 8, maxWidth: '100%', minWidth: 0,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const word = (text: string, weight = 700, color = 'var(--ink)'): React.ReactNode => (
  <span style={{ ...rounded(20, weight), color, padding: 5, whiteSpace: 'pre' /* 保留结尾的空格，和 SwiftUI 的 Text 一样 */ }}>{text}</span>
)

/** "获得标签: " + 标签（来源阵营色）+ "，来源为：" */
function TagText({ prefix, message, team }: { prefix: string; message: string; team: number }) {
  return (
    <span style={t20(600)}>
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
        <div style={row('flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <div style={boxed()}>
            <span style={{ ...t20(600), whiteSpace: 'pre' }}>获得角色: </span>
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          </div>
        </div>
      )
    case 1:
      return (
        <div style={row('flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          <div style={boxed()}>
            <TagText prefix="获得标签: " message={entry.message} team={team1} />
            {nums.length > 0 && nums[0] >= 0 ? <PlayerNumberCircle playerNumber={nums[0] + 1} playerTeam={team1} /> : null}
            <PlayerCharacterBox playerCharacter={char1} playerTeam={team1} />
          </div>
        </div>
      )
    case 2:
      return (
        <Banded line={2} inner={16} outer={entry.messager < 0 ? 5 : 10}>
          {entry.messager < 0 ? null : <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />}
          <PlayerCharacterBox playerCharacter={entry.characterName} playerTeam={team0} />
          {word('被唤醒了')}
        </Banded>
      )
    case 3: {
      const isPlayer = fixed ? entry.messager < playerCount : entry.messager <= playerCount
      const bubble = (
        <span style={{ ...t20(600), ...boxed(), display: 'flex' }}>{entry.message}</span>
      )
      return isPlayer ? (
        <div style={row('flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          {bubble}
        </div>
      ) : (
        <div style={row('flex-end', { padding: '3px 0' })}>
          {bubble}
          <PlayerNumberCircle playerNumber={21} playerTeam={5} />
        </div>
      )
    }
    case 4:
      return (
        <Banded line={2} inner={16} outer={5} wrap>
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
        <Banded line={2} inner={16} outer={5} wrap>
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
        <Banded line={2} inner={16} outer={5}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlayerNumberCircle playerNumber={nums[0] ?? 0} playerTeam={team0} />
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
            {entry.type === 6 ? word('死亡', 700, systemRed) : word('复活', 700, systemGreen)}
          </span>
        </Banded>
      )
    case 7:
      return (
        <div style={row('flex-start', { padding: '5px 0' })}>
          <span style={{ padding: '0 2px' }}>
            <span style={{
              ...t20(600), width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...stroke(2, 20),
            }}>{nums[0] ?? ''}</span>
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            <span style={{ ...t20(700), ...boxed(40), display: 'flex' }}>进入游戏</span>
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
          <span style={{ ...rounded(30, 900), padding: '10px 2px' }}>{text}</span>
        </Banded>
      )
    }
    case 13:
      return (
        <Banded line={3} inner={0} outer={10}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ ...rounded(25, 700), padding: '10px 2px', whiteSpace: 'pre' }}>恶魔得知伪装: </span>
            <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          </span>
        </Banded>
      )
    case 14:
    case 15:
      return (
        <div style={row('flex-start', { padding: '3px 0' })}>
          <PlayerNumberCircle playerNumber={entry.messager} playerTeam={team0} />
          <PlayerCharacterBox playerCharacter={char0} playerTeam={team0} />
          <div style={boxed()}>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

export function ConversationLogView({ allLogs, playerCount, start = 0, end, fixed = false }: {
  allLogs: GameLogEntry[]
  playerCount: number
  start?: number
  end?: number
  fixed?: boolean
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
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>{items}</div>
}
