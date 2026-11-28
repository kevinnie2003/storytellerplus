// 选传奇角色，对应 SubViews/fabled/FabledSelectionView.swift
import { useState } from 'react'
import type { Character } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { CachedImage } from '../ui/CachedImage'
import { mono, rounded } from '../ui/kit'
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
