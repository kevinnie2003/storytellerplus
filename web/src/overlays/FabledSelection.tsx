// 选传奇角色，对应 SubViews/fabled/FabledSelectionView.swift
import { useState } from 'react'
import type { Character } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { CachedImage } from '../ui/CachedImage'
import { mono, rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { MobilePage } from '../mobile/MobilePage'
import { SFIcon } from '../ui/SFIcon'
import { OverlayLayer, panelHeight, stroke } from './common'

export function FabledSelection() {
  const show = useGame((s) => s.showFabledCharactersSelection)
  return show ? <FabledSelectionView /> : null
}

function FabledCharacterCard({ character }: { character: Character }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <CachedImage url={character.imageURL} size={60} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...mono(25, 700), padding: '10px 5px' }}>{character.name}</div>
        <div style={{ ...rounded(23, 600), padding: '0 5px 10px' }}>{character.ability}</div>
      </div>
    </div>
  )
}

function FabledSelectionView() {
  const compact = useCompact()
  const fabledInPlay = useGame((s) => s.fabled)
  const [{ selectedNames, official }] = useState(() => {
    const s = game()
    const inPlayNames = s.fabled.map((c) => c.name)
    return {
      selectedNames: s.selectedFabledCharacters.map((c) => c.name),
      official: s.characters.filter((c) => c.team === 'fabled' && !inPlayNames.includes(c.name)),
    }
  })

  const pick = (c: Character) => {
    if (selectedNames.includes(c.name)) return
    setGame((s) => ({ selectedFabledCharacters: [...s.selectedFabledCharacters, c], showFabledCharactersSelection: false }))
  }

  if (compact) return <PhoneFabledSelection fabledInPlay={fabledInPlay} official={official} selectedNames={selectedNames} pick={pick} />

  const header = (text: string) => (
    <div style={{ ...mono(25, 700), width: '100%', paddingLeft: 20, paddingTop: 20, paddingBottom: 5 }}>{text}</div>
  )
  const card = (c: Character) => (
    <div
      key={c.id}
      onClick={() => pick(c)}
      style={{ width: '100%', padding: '10px 20px', opacity: selectedNames.includes(c.name) ? 1 : 0.5, cursor: 'pointer' }}
    >
      <FabledCharacterCard character={c} />
    </div>
  )

  return (
    <OverlayLayer
      zIndex={16}
      background="color-mix(in srgb, var(--mainbg) 30%, transparent)"
      onDoubleTapBackground={() => setGame({ showFabledCharactersSelection: false })}
    >
      <div style={{
        position: 'relative', width: 800, height: panelHeight, background: 'var(--mainbg)',
        overflowY: 'auto', overflowX: 'hidden', ...stroke(3, 20),
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ ...mono(30, 700), paddingTop: 20 }}>选择传说角色</div>
          {header('剧本传奇角色')}
          {fabledInPlay.map(card)}
          {header('官方传奇角色')}
          {official.map(card)}
        </div>
      </div>
    </OverlayLayer>
  )
}

// 手机版：全屏一页，一行一个传奇角色，已经加上的打勾、不能再点
function PhoneFabledSelection({ fabledInPlay, official, selectedNames, pick }: {
  fabledInPlay: Character[]
  official: Character[]
  selectedNames: string[]
  pick: (c: Character) => void
}) {
  const header = (text: string) => (
    <div style={{ ...mono(18, 700), padding: '14px 4px 4px' }}>{text}</div>
  )
  const card = (c: Character) => {
    const added = selectedNames.includes(c.name)
    return (
      <button
        key={c.id}
        onClick={() => pick(c)}
        disabled={added}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', textAlign: 'left',
          color: 'var(--ink)', borderRadius: 14, background: 'color-mix(in srgb, var(--fabled) 14%, transparent)',
          outline: added ? '3px solid var(--ink)' : 'none', outlineOffset: -1.5,
        }}
      >
        <CachedImage url={c.imageURL} size={48} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...mono(17, 700), flex: 1, minWidth: 0 }}>{c.name}</span>
            {added ? (
              <span style={{ ...rounded(13, 800), display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <SFIcon name="checkmark" size={14} weight="bold" />已加
              </span>
            ) : null}
          </span>
          <span style={{ ...rounded(14, 600), lineHeight: 1.4 }}>{c.ability}</span>
        </span>
      </button>
    )
  }
  return (
    <MobilePage
      title="选择传说角色"
      zIndex={116}
      onClose={() => setGame({ showFabledCharactersSelection: false })}
      bodyStyle={{ padding: '4px 12px calc(20px + env(safe-area-inset-bottom))', gap: 8 }}
    >
      {header('剧本传奇角色')}
      {fabledInPlay.length === 0 ? <div style={{ ...rounded(14, 600), opacity: 0.55, padding: '0 4px' }}>这个剧本没有传奇角色</div> : null}
      {fabledInPlay.map(card)}
      {header('官方传奇角色')}
      {official.map(card)}
    </MobilePage>
  )
}
