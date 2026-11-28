// 抽卡前给某个座位提前定好角色（例如照顾新手），对应 SpecialCare.swift
import { useState } from 'react'
import type { Character } from '../game/types'
import { teamColor } from '../game/teams'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'

function SpecialCareCharacterCard({ character }: { character: Character }) {
  return (
    <div style={{ padding: '5px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', background: 'var(--goodTextBg)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <CachedImage url={character.imageURL} size={60} />
        </div>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, background: teamColor(character.team), color: 'var(--goodTextBg)',
        }}>
          <div style={{ ...rounded(20, 700), padding: '10px 20px' }}>{character.name}</div>
          <div style={{ ...rounded(15, 600), padding: '0 20px 10px' }}>{character.ability}</div>
        </div>
      </div>
    </div>
  )
}

const spring = 'transform .35s cubic-bezier(.25,.9,.35,1), opacity .35s cubic-bezier(.25,.9,.35,1)'

export function SpecialCare({ shown, merged, selectedCardIndices, specialCarePlayerChoices, setSpecialCarePlayerChoices, currentSelectingPlayerIndex, onClose }: {
  shown: boolean
  merged: Character[]
  selectedCardIndices: Set<number>
  specialCarePlayerChoices: Map<number, number>
  setSpecialCarePlayerChoices: (m: Map<number, number>) => void
  currentSelectingPlayerIndex: number
  onClose: () => void
}) {
  // onAppear：这个座位之前定过就先选中
  const [preSelectedIndex, setPreSelectedIndex] = useState(() => specialCarePlayerChoices.get(currentSelectingPlayerIndex) ?? -1)
  const values = new Set(specialCarePlayerChoices.values())

  const tap = (index: number) => {
    const next = new Map(specialCarePlayerChoices)
    const cur = currentSelectingPlayerIndex
    if (preSelectedIndex === index) {
      next.set(cur, -1)
      setSpecialCarePlayerChoices(next)
      setPreSelectedIndex(-1)
    } else {
      if (selectedCardIndices.has(index) || values.has(index)) return
      setPreSelectedIndex(index)
      if (next.has(cur)) {
        const previouslySelectedIndex = next.get(cur)!
        next.set(cur, previouslySelectedIndex === index ? -1 : index)
      } else {
        next.set(cur, index)
      }
      setSpecialCarePlayerChoices(next)
    }
  }

  const btn: React.CSSProperties = {
    ...rounded(20, 700), color: 'var(--ink)', padding: '7px 19px', border: '2px solid var(--ink)', borderRadius: 20, // 描边不占位置，减掉 1
    margin: '20px 30px', whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 2, display: 'flex', justifyContent: 'center',
      opacity: shown ? 1 : 0, transition: 'opacity .35s cubic-bezier(.25,.9,.35,1)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--mainbg) 30%, transparent)' }} />
      <div style={{
        position: 'relative', width: 600, margin: '50px 0', display: 'flex', flexDirection: 'column',
        // 描边是 overlay，不占里面的位置
        background: 'var(--mainbg)', borderRadius: 20, outline: '3px solid var(--ink)', outlineOffset: -1.5, overflow: 'hidden',
      }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...rounded(25, 700), padding: '25px 0', textAlign: 'center', flexShrink: 0 }}>为{currentSelectingPlayerIndex + 1}号玩家提前选择角色</div>
          {['townsfolk', 'outsider', 'minion', 'demon'].map((team) => merged.map((c, index) => c.team === team ? (
            <div
              key={`${team}-${index}`}
              onClick={() => tap(index)}
              style={{
                transform: `scale(${preSelectedIndex === index ? 1 : 0.95})`,
                opacity: selectedCardIndices.has(index) || values.has(index) ? 0.5 : 1,
                transition: spring, cursor: 'pointer', flexShrink: 0,
              }}
            >
              <SpecialCareCharacterCard character={c} />
            </div>
          ) : null))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <button style={btn} onClick={onClose}>确认</button>
          <button style={btn} onClick={onClose}>返回</button>
        </div>
      </div>
    </div>
  )
}
