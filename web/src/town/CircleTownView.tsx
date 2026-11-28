// 圆桌摆法：玩家按座位围成一圈，和实体魔典一样看邻座关系。对应 iPad 版 Town/CircleTownView.swift
import { useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { useSettings } from '../settings/store'
import type { Reminder } from '../game/types'
import { isPlayerTeam, teamColor, teamIdColor } from '../game/teams'
import { openCharacterSelection, openTagPicker, removePlayerReminder, requestToggleAlive } from '../game/actions'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { usePress } from '../ui/gestures'
import { rounded } from '../ui/kit'
import { FitText } from './FitText'

function SeatReminder({ index, i, reminder }: { index: number; i: number; reminder: Reminder }) {
  const hide = useSettings((s) => s.hideTeamColors)
  const press = usePress({ onDoubleTap: () => removePlayerReminder(index, i) })
  return (
    <div
      {...press}
      style={{
        ...rounded(12, 700), color: 'var(--goodTextBg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%', padding: '2px 7px', lineHeight: 1.2, borderRadius: 999, cursor: 'pointer',
        background: hide ? 'var(--neutralTeam)' : teamIdColor(reminder.team),
        transform: reminder.isReversed ? 'rotate(180deg)' : undefined,
      }}
    >{reminder.effect}</div>
  )
}

function CircleSeat({ index, width, isSelected, onSelect }: {
  index: number
  width: number
  isSelected: boolean
  onSelect: () => void
}) {
  const character = useGame((s) => s.playersAssignedCharacters[index])
  const reminders = useGame((s) => s.playersStates[index]) ?? []
  const isAlive = useGame((s) => (index < s.playersIsAlive.length ? s.playersIsAlive[index] : true))
  const hide = useSettings((s) => s.hideTeamColors)
  if (!character) return null
  const fill = hide && isPlayerTeam(character.team) ? 'var(--neutralTeam)' : character.team === '' ? 'var(--mainbg)' : teamColor(character.team)

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: isAlive ? 1 : 0.5, transition: 'opacity .3s' }}>
      <div style={{ position: 'relative', width: 58, height: 58 }}>
        <div
          onClick={() => openCharacterSelection(index)}
          style={{
            width: 58, height: 58, borderRadius: '50%', background: 'var(--goodTextBg)', cursor: 'pointer',
            outline: '2.5px solid var(--ink)', outlineOffset: -1.25,
          }}
        >
          <CachedImage url={character.imageURL} size={58} grayscale={hide} />
        </div>
        <div
          onClick={() => requestToggleAlive(index)}
          style={{
            position: 'absolute', left: -12, top: -8, width: 28, height: 28, borderRadius: '50%', background: 'var(--ink)',
            color: 'var(--paper)', ...rounded(15, 900), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          {index + 1}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isAlive ? 0 : 1, pointerEvents: 'none' }}>
            <SFIcon name="xmark" size={26} weight="black" color="var(--demon)" />
          </div>
        </div>
      </div>
      <div
        onClick={onSelect}
        style={{
          maxWidth: '100%', padding: '3px 8px', borderRadius: 999, background: fill, color: 'var(--goodTextBg)', cursor: 'pointer',
          outline: `${isSelected ? 4 : 2}px solid var(--ink)`, outlineOffset: isSelected ? -2 : -1,
          transform: isSelected ? 'scale(1.12)' : undefined, transition: 'transform .15s',
        }}
      >
        <FitText text={character.name === '' ? '未分配' : character.name} fontSize={15} minScale={0.6} style={{ ...rounded(15, 700), lineHeight: 1.2 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: '100%' }}>
        {reminders.map((r, i) => <SeatReminder key={`${i}-${r.from}-${r.effect}`} index={index} i={i} reminder={r} />)}
        <button
          onClick={() => openTagPicker(index)}
          style={{
            width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--ink)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SFIcon name="plus" size={14} weight="black" />
        </button>
      </div>
    </div>
  )
}

/** 在椭圆上按弧长等距取 n 个点，1 号在正上方，顺时针。椭圆两侧不会挤在一起。 */
function seatPositions(count: number, cx: number, cy: number, rx: number, ry: number): { x: number; y: number }[] {
  if (count <= 0) return []
  const samples = 720
  const points: { x: number; y: number }[] = []
  const lengths: number[] = [0]
  for (let i = 0; i <= samples; i++) {
    const t = (2 * Math.PI * i) / samples - Math.PI / 2
    const p = { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }
    const last = points[points.length - 1]
    if (last) lengths.push(lengths[lengths.length - 1] + Math.hypot(p.x - last.x, p.y - last.y))
    points.push(p)
  }
  const total = lengths[lengths.length - 1]
  const result: { x: number; y: number }[] = []
  let j = 0
  for (let k = 0; k < count; k++) {
    const target = (total * k) / count
    while (j < lengths.length - 1 && lengths[j + 1] < target) j++
    result.push(points[j])
  }
  return result
}

function CenterPanel({ seat, count, width, onClose }: { seat: number | null; count: number; width: number; onClose: () => void }) {
  const character = useGame((s) => (seat === null ? undefined : s.playersAssignedCharacters[seat]))
  const aliveCount = useGame((s) => s.aliveCount)
  const hide = useSettings((s) => s.hideTeamColors)
  if (seat !== null && seat < count && character) {
    return (
      <div style={{
        width, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--paper)',
        borderRadius: 16, border: '3px solid var(--ink)', animation: 'st-fade .15s ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CachedImage url={character.imageURL} size={44} grayscale={hide} />
          <FitText
            text={`${seat + 1} 号 ${character.name === '' ? '未分配' : character.name}`}
            fontSize={22}
            minScale={0.6}
            style={{ ...rounded(22, 900), lineHeight: 1.2, flex: 1 }}
          />
          <button onClick={onClose} style={{ padding: 6, color: 'var(--ink)' }}>
            <SFIcon name="xmark" size={15} weight="black" />
          </button>
        </div>
        <div className="scroll-hidden" style={{ maxHeight: 150, overflowY: 'auto' }}>
          <div style={{ ...rounded(17, 500), lineHeight: 1.25 }}>{character.ability}</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ ...rounded(54, 900), lineHeight: 1.2 }}>{aliveCount}</div>
      <div style={{ ...rounded(17, 600), opacity: 0.6 }}>人存活，共 {count} 人</div>
    </div>
  )
}

export function CircleTownView() {
  const count = useGame((s) => Math.min(s.playersAssignedCharacters.length, s.playersStates.length, s.playersIsAlive.length))
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const h = 620
  const seatWidth = count > 12 ? 96 : 116
  const rx = Math.max(w / 2 - seatWidth / 2 - 6, 120)
  const ry = Math.max(h / 2 - 66, 120)
  const positions = seatPositions(count, w / 2, h / 2 + 12, rx, ry)

  return (
    <div ref={ref} style={{ position: 'relative', height: h, marginTop: 10, width: '100%' }}>
      {w > 0 ? (
        <>
          <div style={{ position: 'absolute', left: w / 2, top: h / 2, transform: 'translate(-50%, -50%)' }}>
            <CenterPanel seat={selectedSeat} count={count} width={Math.min(2 * rx - seatWidth - 40, 400)} onClose={() => setSelectedSeat(null)} />
          </div>
          {positions.map((p, index) => (
            <div key={index} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}>
              <CircleSeat
                index={index}
                width={seatWidth}
                isSelected={selectedSeat === index}
                onSelect={() => setSelectedSeat(selectedSeat === index ? null : index)}
              />
            </div>
          ))}
        </>
      ) : null}
    </div>
  )
}
