// 抽卡前给某个座位提前定好角色（例如照顾新手），对应 SpecialCare.swift
import { useState } from 'react'
import type { Character } from '../game/types'
import { teamColor } from '../game/teams'
import { CachedImage } from '../ui/CachedImage'
import { MobilePage } from '../mobile/MobilePage'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { MobileBar } from './MobileBar'
import { barButton, phoneHint } from './mobileStyles'

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

  const list = ['townsfolk', 'outsider', 'minion', 'demon'].map((team) => merged.map((c, index) => c.team === team ? (
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
  ) : null))

  const compact = useCompact()
  if (compact) {
    // 手机：全屏一页，底下确认/返回
    if (!shown) return null
    return (
      <MobilePage
        title={`为${currentSelectingPlayerIndex + 1}号提前选角色`}
        onClose={onClose}
        zIndex={118}
        scroll={false}
        bodyStyle={{ paddingBottom: 0 }}
      >
        <div className="scroll-hidden" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 4px 20px' }}>
          <div style={{ ...phoneHint, padding: '0 10px 6px' }}>点一张牌定给这个座位，再点一下取消。变淡的牌已经被抽走或定给别人了</div>
          {list}
        </div>
        <MobileBar>
          <button style={barButton()} onClick={onClose}>返回</button>
          <button style={barButton(true)} onClick={onClose}>确认</button>
        </MobileBar>
      </MobilePage>
    )
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
          {list}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <button style={btn} onClick={onClose}>确认</button>
          <button style={btn} onClick={onClose}>返回</button>
        </div>
      </div>
    </div>
  )
}
