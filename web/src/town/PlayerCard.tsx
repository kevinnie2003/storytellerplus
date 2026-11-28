// 玩家卡片，对应 iPad 版 SubViews/playersView/PlayersCard.swift
import { useGame } from '../game/store'
import { useSettings } from '../settings/store'
import type { Reminder } from '../game/types'
import { isPlayerTeam, teamIdColor, teamShortName } from '../game/teams'
import { getImageURL, openCharacterSelection, openTagPicker, removePlayerReminder, requestToggleAlive, reversePlayerReminder } from '../game/actions'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { usePress } from '../ui/gestures'
import { rounded } from '../ui/kit'
import { FitText } from './FitText'

const mainColor = (team: string, hide: boolean) => {
  if (hide && isPlayerTeam(team)) return 'var(--neutralTeam)'
  switch (team) {
    case 'minion': return 'var(--minion)'
    case 'demon': return 'var(--demon)'
    case 'townsfolk': return 'var(--townsfolk)'
    case 'outsider': return 'var(--outsider)'
    case 'traveler': return 'var(--traveler)'
    default: return 'var(--mainbg)'
  }
}

const secondaryColor = (team: string) => {
  switch (team) {
    case 'minion': case 'demon': return 'var(--evilTextBg)'
    case 'townsfolk': case 'outsider': case 'traveler': return 'var(--goodTextBg)'
    default: return 'var(--ink)'
  }
}

/** 卡片下方的一个标签：双击删除，长按 1 秒倒置 */
function ReminderChip({ index, reminderIndex, reminder, fontScale }: {
  index: number
  reminderIndex: number
  reminder: Reminder
  fontScale: number
}) {
  const characters = useGame((s) => s.characters)
  const hide = useSettings((s) => s.hideTeamColors)
  const fs = (b: number) => Math.round(b * fontScale)
  const tagColor = hide ? 'var(--neutralTeam)' : teamIdColor(reminder.team)
  const imageURL = getImageURL(reminder.from, characters)
  const press = usePress({
    onDoubleTap: () => removePlayerReminder(index, reminderIndex),
    onLongPress: () => reversePlayerReminder(index, reminderIndex),
    longPressSeconds: 1,
  })
  const hasNumber = reminder.playerId >= 0
  return (
    <div
      {...press}
      style={{
        display: 'flex', alignItems: 'center', minWidth: 50, height: 42, padding: '0 3px', maxWidth: '100%',
        background: tagColor, borderRadius: 20, cursor: 'pointer',
        transform: reminder.isReversed ? 'rotate(180deg)' : undefined, transition: 'transform .3s ease-in-out',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: hasNumber ? 3 : 0,
        marginRight: hasNumber || imageURL ? 2 : 0, background: 'var(--goodTextBg)', borderRadius: 20,
      }}>
        {hasNumber ? (
          <div style={{ ...rounded(fs(18), 900), lineHeight: '36px', height: 36, minWidth: 24, textAlign: 'center', color: tagColor }}>
            {reminder.playerId + 1}
          </div>
        ) : null}
        {imageURL ? (
          <div style={{ width: 35, height: 35, borderRadius: '50%', background: 'var(--goodTextBg)' }}>
            <CachedImage url={imageURL} size={35} grayscale={hide} />
          </div>
        ) : <div style={{ width: 0, height: 36 }} />}
      </div>
      <div style={{
        ...rounded(fs(18), 700), color: 'var(--goodTextBg)', padding: '0 5px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, flex: '1 1 auto', minWidth: 0, textAlign: 'center',
      }}>{reminder.effect}</div>
    </div>
  )
}

export function PlayerCard({ index }: { index: number }) {
  const character = useGame((s) => s.playersAssignedCharacters[index])
  const reminders = useGame((s) => s.playersStates[index])
  const aliveKnown = useGame((s) => index < s.playersIsAlive.length)
  const alive = useGame((s) => s.playersIsAlive[index])
  const hide = useSettings((s) => s.hideTeamColors)
  const cardsPerRow = useSettings((s) => s.cardsPerRow)
  const fontScale = useSettings((s) => s.cardFontScale)
  if (!character) return <div style={{ flex: 1 }} />
  const fs = (b: number) => Math.round(b * fontScale)
  const main = mainColor(character.team, hide)
  const secondary = secondaryColor(character.team)
  const small = cardsPerRow >= 4
  const iconSize = small ? 40 : 50
  const first = index === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }} data-tour={first ? 'card' : undefined}>
      {/* 同一行的卡片一样高，多出来的高度给能力那块 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8, background: main, borderRadius: '20px 20px 0 0', flex: '1 0 auto',
        opacity: !aliveKnown ? 0 : alive ? 1 : 0.5, transition: 'opacity .3s ease-in-out, background .3s ease-in-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
          <div
            onClick={() => requestToggleAlive(index)}
            data-tour={first ? 'card.number' : undefined}
            style={{
              position: 'relative', marginLeft: 5, width: iconSize, height: iconSize, flexShrink: 0, borderRadius: '50%',
              background: secondary, color: main, display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...rounded(fs(25), 900), cursor: 'pointer',
            }}
          >
            {index + 1}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: !aliveKnown ? 0 : alive ? 0 : 1, transition: 'opacity .3s ease-in-out', pointerEvents: 'none',
            }}>
              <SFIcon name="xmark" size={45} weight="black" color="var(--demon)" />
            </div>
          </div>
          <FitText
            text={character.name}
            fontSize={fs(22)}
            minScale={0.5}
            style={{ ...rounded(fs(22), 700), color: secondary, padding: '0 5px', flex: 1, lineHeight: 1.2 }}
          />
          {hide && isPlayerTeam(character.team) ? (
            <div style={{ ...rounded(15, 700), width: 18, flexShrink: 0, textAlign: 'center', color: secondary, opacity: 0.45 }}>
              {teamShortName(character.team)}
            </div>
          ) : null}
          <div
            onClick={() => openCharacterSelection(index)}
            data-tour={first ? 'card.icon' : undefined}
            style={{ width: iconSize, height: iconSize, marginRight: 5, flexShrink: 0, borderRadius: '50%', background: secondary, cursor: 'pointer' }}
          >
            <CachedImage url={character.imageURL} size={iconSize} grayscale={hide} />
          </div>
        </div>
        <div style={{
          ...rounded(fs(18), 600), color: secondary, padding: '5px 5px 20px', lineHeight: 1.2,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{character.ability || <div style={{ height: 15 }} /> /* 没分角色时 iPad 上这一块还占 15 高（模拟器量的） */}</div>
      </div>
      <div
        data-tour={first ? 'card.tags' : undefined}
        style={{
          // HFlow 默认居中，标签和 ⊕ 在卡片底部居中排
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 5px',
          background: 'var(--mainbg)', borderRadius: '0 0 20px 20px',
        }}
      >
        {(reminders ?? []).map((r, i) => (
          <ReminderChip key={`${i}-${r.from}-${r.effect}`} index={index} reminderIndex={i} reminder={r} fontScale={fontScale} />
        ))}
        <button
          onClick={() => openTagPicker(index)}
          data-tour={first ? 'card.plus' : undefined}
          style={{
            width: 35, height: 35, borderRadius: '50%', border: '3px solid var(--ink)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <SFIcon name="plus" size={32} weight="semibold" />
        </button>
      </div>
    </div>
  )
}
