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
import { showAlert } from '../ui/Alert'
import { useCompact } from '../ui/compact'

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
function ReminderChip({ index, reminderIndex, reminder, fontScale, compact = false }: {
  index: number
  reminderIndex: number
  reminder: Reminder
  fontScale: number
  /** 手机版的小标签 */
  compact?: boolean
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
  // 手机版：高 30，图标 26
  const h = compact ? 30 : 42
  const inner = compact ? 26 : 36
  const icon = compact ? 25 : 35
  const font = compact ? fs(14) : fs(18)
  return (
    <div
      {...press}
      style={{
        display: 'flex', alignItems: 'center', minWidth: compact ? 34 : 50, height: h, padding: compact ? '0 2px' : '0 3px', maxWidth: '100%',
        background: tagColor, borderRadius: h / 2, cursor: 'pointer',
        transform: reminder.isReversed ? 'rotate(180deg)' : undefined, transition: 'transform .3s ease-in-out',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: hasNumber ? (compact ? 2 : 3) : 0,
        marginRight: hasNumber || imageURL ? 2 : 0, background: 'var(--goodTextBg)', borderRadius: h / 2,
      }}>
        {hasNumber ? (
          <div style={{ ...rounded(font, 900), lineHeight: `${inner}px`, height: inner, minWidth: compact ? 16 : 24, textAlign: 'center', color: tagColor }}>
            {reminder.playerId + 1}
          </div>
        ) : null}
        {imageURL ? (
          <div style={{ width: icon, height: icon, borderRadius: '50%', background: 'var(--goodTextBg)' }}>
            <CachedImage url={imageURL} size={icon} grayscale={hide} />
          </div>
        ) : <div style={{ width: 0, height: inner }} />}
      </div>
      <div style={{
        ...rounded(font, 700), color: 'var(--goodTextBg)', padding: compact ? '0 4px' : '0 5px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, flex: '1 1 auto', minWidth: 0, textAlign: 'center',
      }}>{reminder.effect}</div>
    </div>
  )
}
export function PlayerCard({ index }: { index: number }) {
  const compact = useCompact()
  if (compact) return <CompactPlayerCard index={index} />
  return <FullPlayerCard index={index} />
}

/**
 * 手机版卡片：一行座位号、角色名、图标，下面是标签，能力描述不显示。
 * 点座位号切换死活，点图标换角色，点 ⊕ 加标签，和大屏一样
 */
function CompactPlayerCard({ index }: { index: number }) {
  const character = useGame((s) => s.playersAssignedCharacters[index])
  const reminders = useGame((s) => s.playersStates[index])
  const aliveKnown = useGame((s) => index < s.playersIsAlive.length)
  const alive = useGame((s) => s.playersIsAlive[index])
  const hide = useSettings((s) => s.hideTeamColors)
  const fontScale = useSettings((s) => s.cardFontScale)
  if (!character) return <div style={{ flex: 1 }} />
  const main = mainColor(character.team, hide)
  const secondary = secondaryColor(character.team)
  const first = index === 0
  const size = 36
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden' }} data-tour={first ? 'card' : undefined}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 5px', background: main,
        opacity: !aliveKnown ? 0 : alive ? 1 : 0.5, transition: 'opacity .3s ease-in-out, background .3s ease-in-out',
      }}>
        <div
          onClick={() => requestToggleAlive(index)}
          data-tour={first ? 'card.number' : undefined}
          style={{
            position: 'relative', width: size, height: size, flexShrink: 0, borderRadius: '50%',
            background: secondary, color: main, display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...rounded(19, 900), cursor: 'pointer',
          }}
        >
          {index + 1}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: !aliveKnown ? 0 : alive ? 0 : 1, transition: 'opacity .3s ease-in-out', pointerEvents: 'none',
          }}>
            <SFIcon name="xmark" size={32} weight="black" color="var(--demon)" />
          </div>
        </div>
        {/* 手机上卡片不写能力，点角色名弹出来看 */}
        <div
          data-tour={first ? 'card.name' : undefined}
          onClick={() => { if (character.name) showAlert({ title: `${index + 1}号 ${character.name}`, message: character.ability || '这个角色没有能力描述', buttons: [{ label: '知道了' }] }) }}
          style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', cursor: character.name ? 'pointer' : undefined }}
        >
          <FitText
            text={character.name}
            fontSize={Math.round(17 * fontScale)}
            minScale={0.5}
            style={{ ...rounded(Math.round(17 * fontScale), 700), color: secondary, padding: '0 2px', flex: 1, lineHeight: 1.2 }}
          />
        </div>
        {hide && isPlayerTeam(character.team) ? (
          <div style={{ ...rounded(13, 700), width: 14, flexShrink: 0, textAlign: 'center', color: secondary, opacity: 0.45 }}>
            {teamShortName(character.team)}
          </div>
        ) : null}
        <div
          onClick={() => openCharacterSelection(index)}
          data-tour={first ? 'card.icon' : undefined}
          style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', background: secondary, cursor: 'pointer' }}
        >
          <CachedImage url={character.imageURL} size={size} grayscale={hide} />
        </div>
      </div>
      <div
        data-tour={first ? 'card.tags' : undefined}
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 4px',
          background: 'var(--mainbg)', flex: 1,
        }}
      >
        {(reminders ?? []).map((r, i) => (
          <ReminderChip key={`${i}-${r.from}-${r.effect}`} index={index} reminderIndex={i} reminder={r} fontScale={fontScale} compact />
        ))}
        <button
          onClick={() => openTagPicker(index)}
          data-tour={first ? 'card.plus' : undefined}
          style={{
            width: 28, height: 28, borderRadius: '50%', border: '2.5px solid var(--ink)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <SFIcon name="plus" size={22} weight="semibold" />
        </button>
      </div>
    </div>
  )
}

function FullPlayerCard({ index }: { index: number }) {
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
