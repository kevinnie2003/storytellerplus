// 全局标签 + 玩家卡片网格（或圆桌），对应 iPad 版 SubViews/playersView/PlayersView.swift
import { useGame } from '../game/store'
import { useSettings } from '../settings/store'
import type { Reminder } from '../game/types'
import { teamIdColor } from '../game/teams'
import { getImageURL, openTagPicker, removeGlobalReminder, reverseGlobalReminder } from '../game/actions'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { usePress } from '../ui/gestures'
import { mono, rounded } from '../ui/kit'
import { PlayerCard } from './PlayerCard'
import { CircleTownView } from './CircleTownView'
import { useCompact } from '../ui/compact'

function GlobalChip({ reminder, reminderIndex, compact = false }: { reminder: Reminder; reminderIndex: number; compact?: boolean }) {
  const characters = useGame((s) => s.characters)
  const hide = useSettings((s) => s.hideTeamColors)
  const tagColor = hide ? 'var(--neutralTeam)' : teamIdColor(reminder.team)
  const imageURL = getImageURL(reminder.from, characters)
  const hasNumber = reminder.playerId >= 0
  const press = usePress({
    onDoubleTap: () => removeGlobalReminder(reminderIndex),
    onLongPress: () => reverseGlobalReminder(reminderIndex),
    longPressSeconds: 1,
  })
  // 手机版小一号：高 38，图标 34
  const h = compact ? 38 : 54
  const icon = compact ? 34 : 48
  const font = compact ? 17 : 24
  return (
    <div
      {...press}
      style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: compact ? 38 : 50, height: h, padding: compact ? '0 2px' : '0 3px',
        background: tagColor, borderRadius: h / 2, cursor: 'pointer',
        transform: reminder.isReversed ? 'rotate(180deg)' : undefined, transition: 'transform .3s ease-in-out',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', paddingLeft: hasNumber ? 3 : 0, marginRight: hasNumber || imageURL ? 2 : 0,
        background: 'var(--goodTextBg)', borderRadius: h / 2,
      }}>
        {hasNumber ? (
          <div style={{ ...rounded(compact ? 18 : 25, 900), minWidth: compact ? 18 : 25, height: icon + 2, lineHeight: `${icon + 2}px`, textAlign: 'center', color: tagColor }}>
            {reminder.playerId + 1}
          </div>
        ) : null}
        {imageURL ? (
          <div style={{ width: icon, height: icon, borderRadius: '50%', background: 'var(--goodTextBg)' }}>
            <CachedImage url={imageURL} size={icon} grayscale={hide} />
          </div>
        ) : <div style={{ width: 0, height: icon }} />}
      </div>
      <div style={{ ...rounded(font, 700), color: 'var(--goodTextBg)', padding: compact ? '0 7px' : '0 10px', whiteSpace: 'nowrap', lineHeight: 1.2, flex: 1, textAlign: 'center' }}>
        {reminder.effect}
      </div>
    </div>
  )
}

function GlobalTags() {
  const globalStates = useGame((s) => s.globalStates)
  const compact = useCompact()
  return (
    <div
      data-tour="globalTags"
      className="scroll-hidden"
      style={{
        overflowX: 'auto', overflowY: 'hidden', background: 'var(--mainbg)', borderRadius: 50,
        border: `${compact ? 3 : 4}px solid var(--ink)`, flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, padding: compact ? '6px 12px' : '11px 26px', width: 'max-content', minWidth: '100%' }}>
        {compact ? (
          <div style={{ ...mono(15, 900), lineHeight: 1.1, flexShrink: 0, width: 32, textAlign: 'center' }}>全局标签</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginRight: 10, flexShrink: 0 }}>
            <div style={{ ...mono(25, 900), lineHeight: 1.2, marginBottom: -5 }}>全局</div>
            <div style={{ ...mono(25, 900), lineHeight: 1.2 }}>标签</div>
          </div>
        )}
        <div style={{ width: compact ? 3 : 4, alignSelf: 'stretch', background: 'var(--ink)', margin: compact ? '0 4px' : '0 10px', flexShrink: 0 }} />
        {globalStates.map((r, i) => (
          <GlobalChip key={`${i}-${r.from}-${r.effect}`} reminder={r} reminderIndex={i} compact={compact} />
        ))}
        <button
          onClick={() => openTagPicker(-2)}
          style={{
            width: compact ? 36 : 50, height: compact ? 36 : 50, borderRadius: '50%', border: `${compact ? 2.5 : 3}px solid var(--ink)`, color: 'var(--ink)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SFIcon name="plus" size={compact ? 30 : 44} weight="semibold" />
        </button>
      </div>
    </div>
  )
}

export function PlayersView({ numCols, forceGrid = false }: { numCols: number; forceGrid?: boolean }) {
  const count = useGame((s) => Math.min(s.playersAssignedCharacters.length, s.playersStates.length, s.playersIsAlive.length))
  const total = useGame((s) => s.playersAssignedCharacters.length)
  const circleLayout = useSettings((s) => s.circleLayout)
  const compact = useCompact()
  // 手机版：圆桌照常；网格固定两列，间距小一些
  if (compact && !(circleLayout && !forceGrid)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <GlobalTags />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {Array.from({ length: count }, (_, index) => (
            <div key={index} style={{ display: 'flex', minWidth: 0 }}><PlayerCard index={index} /></div>
          ))}
        </div>
      </div>
    )
  }
  const rows = Math.ceil(total / numCols)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <GlobalTags />
      {circleLayout && !forceGrid ? (
        <CircleTownView />
      ) : (
        Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            {Array.from({ length: numCols }, (_, colIndex) => {
              const index = rowIndex * numCols + colIndex
              return index < count ? (
                <div key={colIndex} style={{ flex: '1 1 0', minWidth: 0, padding: '15px 5px', display: 'flex' }}>
                  <PlayerCard index={index} />
                </div>
              ) : (
                <div key={colIndex} style={{ flex: '1 1 0', minWidth: 0 }} />
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
