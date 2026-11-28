// 复盘的时间线：按开局、第几夜、第几天排的整局记录，上面一排座位。
// 说书人的复盘页（手机布局）和说书人联机玩家结束游戏后看到的是同一个
import type { GameLogEntry, GameSaveData } from '../game/types'
import { teamColor } from '../game/teams'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { CachedImage } from '../ui/CachedImage'

/** 时间线里的一段：游戏开始前、第几夜、第几天 */
interface ReviewSegment {
  id: number
  title: string
  isNight: boolean
  entries: GameLogEntry[]
}

export const ReviewBuilder = {
  segments(logs: GameLogEntry[]): ReviewSegment[] {
    let n = 0
    const result: ReviewSegment[] = [{ id: n++, title: '开局', isNight: false, entries: [] }]
    let day = 0
    let night = 0
    for (const entry of logs) {
      switch (entry.type) {
        case 8:
          continue
        case 9:
          night = 1
          result.push({ id: n++, title: '第 1 夜', isNight: true, entries: [] })
          break
        case 10:
          day += 1
          result.push({ id: n++, title: `第 ${day} 天`, isNight: false, entries: [] })
          break
        case 11:
          night += 1
          result.push({ id: n++, title: `第 ${night} 夜`, isNight: true, entries: [] })
          break
        default:
          result[result.length - 1].entries.push(entry)
      }
    }
    return result.filter((s) => s.entries.length > 0 || s.title !== '开局')
  },

  /** 一条记录的显示文字，去掉原记录里的分隔线 */
  text(entry: GameLogEntry): string {
    switch (entry.type) {
      case 2: {
        const who = entry.messager > 0 ? `${entry.messager} 号 ${entry.characterName}` : entry.characterName
        const detail = entry.message.trim()
        return detail === '' ? `${who} 被唤醒` : `${who}：${detail}`
      }
      case 3:
        return entry.message
      default:
        return entry.logText.split('\n').filter((l) => !l.startsWith('====')).join(' ').replace(/^[ \t]+|[ \t]+$/g, '')
    }
  },

  color(entry: GameLogEntry): string {
    switch (entry.type) {
      case 6: return 'var(--demonInk)'
      case 12: return 'var(--townsfolk)'
      case 4: case 5: return 'var(--ink)'
      default: return 'color-mix(in srgb, var(--ink) 75%, transparent)'
    }
  },

  isBold(entry: GameLogEntry): boolean {
    return [4, 6, 12].includes(entry.type)
  },
}


const dim = (pct: number) => `color-mix(in srgb, var(--ink) ${pct}%, transparent)`

export function ReviewTimeline({ game }: { game: GameSaveData }) {
  return (
    <>
      {/* 座位一行左右滑 */}
      <div className="scroll-hidden" style={{ overflowX: 'auto', background: 'var(--paper)', borderRadius: 14, border: '2.5px solid var(--ink)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, padding: 8, width: 'max-content' }}>
          {game.playersAssignedCharacters.map((c, i) => {
            const isAlive = i < game.playersIsAlive.length ? game.playersIsAlive[i] : true
            return (
              <div key={i} style={{ width: 52, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CachedImage url={c.imageURL} size={34} style={{ opacity: isAlive ? 1 : 0.4 }} />
                <div style={rounded(13, 900)}>{i + 1}</div>
                <div style={{
                  ...rounded(13, 600), color: teamColor(c.team), maxWidth: '100%',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.name}</div>
                {!isAlive ? (
                  <div style={{ position: 'absolute', top: 0, right: 0, color: 'var(--demonInk)' }}>
                    <SFIcon name="xmark" size={13} weight="black" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: 16, border: '3px solid var(--ink)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 13, alignItems: 'flex-start' }}>
          {ReviewBuilder.segments(game.allLogs).map((segment) => (
            <div key={segment.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', width: '100%' }}>
              <div style={{
                ...rounded(17, 900), display: 'flex', alignItems: 'center', gap: 6,
                color: segment.isNight ? 'var(--paper)' : 'var(--ink)', background: segment.isNight ? 'var(--ink)' : 'var(--paper)',
                padding: '4px 11px', borderRadius: 999, border: '2px solid var(--ink)',
              }}>
                <SFIcon name={segment.isNight ? 'moon.fill' : segment.title === '开局' ? 'flag.fill' : 'sun.max.fill'} size={17} weight="black" />
                <span>{segment.title}</span>
              </div>
              {segment.entries.length === 0 ? (
                <div style={{ ...rounded(14), color: dim(40), paddingLeft: 8 }}>没有记录</div>
              ) : null}
              {segment.entries.map((entry: GameLogEntry) => (
                <div
                  key={entry.id}
                  className="ai-select-text"
                  style={{
                    ...rounded(15, ReviewBuilder.isBold(entry) ? 700 : 400), color: ReviewBuilder.color(entry),
                    paddingLeft: 8, width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                >{ReviewBuilder.text(entry)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** 说书人点过“结束游戏”的局：标出已结束和胜利方 */
export function EndedBadge({ winner, size = 14 }: { winner?: string; size?: number }) {
  if (winner !== 'good' && winner !== 'evil') return null
  return (
    <span style={{
      ...rounded(size, 900), display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', whiteSpace: 'nowrap',
      padding: '2px 10px', borderRadius: 999, color: 'var(--goodTextBg)',
      background: winner === 'evil' ? 'var(--demon)' : 'var(--townsfolk)',
    }}>
      <SFIcon name="flag.fill" size={size - 1} weight="black" />
      {`已结束 · ${winner === 'evil' ? '邪恶' : '善良'}阵营胜利`}
    </span>
  )
}
