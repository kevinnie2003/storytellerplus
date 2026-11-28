// 已选的传奇角色，对应 iPad 版 SubViews/fabled/FabledListView.swift
import { useGame, setGame } from '../game/store'
import type { Character } from '../game/types'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { usePress } from '../ui/gestures'
import { rounded } from '../ui/kit'

function FabledItem({ character }: { character: Character }) {
  const press = usePress({
    onDoubleTap: () => setGame((s) => ({ selectedFabledCharacters: s.selectedFabledCharacters.filter((c) => c.id !== character.id) })),
  })
  return (
    <div {...press} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 5, cursor: 'pointer', animation: 'st-fade .3s ease-in-out' }}>
      <CachedImage url={character.imageURL} size={80} />
      <div style={{ ...rounded(20, 700), color: 'var(--ink)', lineHeight: 1.2, textAlign: 'center' }}>{character.name}</div>
    </div>
  )
}

export function FabledListView() {
  const selected = useGame((s) => s.selectedFabledCharacters)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', padding: '0 16px' }}>
      <div style={{ ...rounded(20, 700), color: 'var(--ink)', paddingTop: 20, lineHeight: 1.2, whiteSpace: 'nowrap', flexShrink: 0 }}>传奇角色</div>
      <div className="scroll-hidden" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'visible', width: 'calc(100% + 32px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {selected.map((c) => <FabledItem key={c.id} character={c} />)}
      </div>
      <button
        onClick={() => setGame({ showFabledCharactersSelection: true })}
        style={{
          width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5, marginBottom: 10,
        }}
      >
        <SFIcon name="plus" size={36} weight="bold" />
      </button>
    </div>
  )
}
