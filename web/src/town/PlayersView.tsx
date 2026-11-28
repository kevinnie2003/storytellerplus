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

function GlobalChip({ reminder, reminderIndex }: { reminder: Reminder; reminderIndex: number }) {
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
  return (
    <div
      {...press}
      style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 50, height: 54, padding: '0 3px',
        background: tagColor, borderRadius: 27, cursor: 'pointer',
        transform: reminder.isReversed ? 'rotate(180deg)' : undefined, transition: 'transform .3s ease-in-out',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', paddingLeft: hasNumber ? 3 : 0, marginRight: hasNumber || imageURL ? 2 : 0,
        background: 'var(--goodTextBg)', borderRadius: 24,
      }}>
        {hasNumber ? (
          <div style={{ ...rounded(25, 900), minWidth: 25, height: 50, lineHeight: '50px', textAlign: 'center', color: tagColor }}>
            {reminder.playerId + 1}
          </div>
        ) : null}
        {imageURL ? (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--goodTextBg)' }}>
            <CachedImage url={imageURL} size={48} grayscale={hide} />
          </div>
        ) : <div style={{ width: 0, height: 48 }} />}
      </div>
      <div style={{ ...rounded(24, 700), color: 'var(--goodTextBg)', padding: '0 10px', whiteSpace: 'nowrap', lineHeight: 1.2, flex: 1, textAlign: 'center' }}>
        {reminder.effect}
      </div>
    </div>
  )
}

function GlobalTags() {
  const globalStates = useGame((s) => s.globalStates)
  return (
    <div
      data-tour="globalTags"
      className="scroll-hidden"
      style={{
        overflowX: 'auto', overflowY: 'hidden', background: 'var(--mainbg)', borderRadius: 50,
        border: '4px solid var(--ink)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 26px', width: 'max-content', minWidth: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginRight: 10, flexShrink: 0 }}>
          <div style={{ ...mono(25, 900), lineHeight: 1.2, marginBottom: -5 }}>全局</div>
          <div style={{ ...mono(25, 900), lineHeight: 1.2 }}>标签</div>
        </div>
        <div style={{ width: 4, alignSelf: 'stretch', background: 'var(--ink)', margin: '0 10px', flexShrink: 0 }} />
        {globalStates.map((r, i) => (
          <GlobalChip key={`${i}-${r.from}-${r.effect}`} reminder={r} reminderIndex={i} />
        ))}
        <button
          onClick={() => openTagPicker(-2)}
          style={{
            width: 50, height: 50, borderRadius: '50%', border: '3px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SFIcon name="plus" size={44} weight="semibold" />
        </button>
      </div>
    </div>
  )
}

export function PlayersView({ numCols, forceGrid = false }: { numCols: number; forceGrid?: boolean }) {
  const count = useGame((s) => Math.min(s.playersAssignedCharacters.length, s.playersStates.length, s.playersIsAlive.length))
  const total = useGame((s) => s.playersAssignedCharacters.length)
  const circleLayout = useSettings((s) => s.circleLayout)
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
