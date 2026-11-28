// 恶魔伪装：三个不在场的善良角色，点格子选角色。对应 iPad 版 SubViews/FakeCover.swift
import { useGame } from '../game/store'
import { defaultCharacter } from '../game/types'
import { openCharacterSelection } from '../game/actions'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'

export function FakeCover() {
  const bluffs = useGame((s) => s.notPresentedGoodCharacters)
  const assigned = useGame((s) => s.playersAssignedCharacters)
  const names = new Set(assigned.map((c) => c.name))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ ...rounded(20, 700), color: 'var(--ink)', lineHeight: 1.2 }}>恶魔伪装</div>
      {[0, 1, 2].map((index) => {
        const character = index < bluffs.length ? bluffs[index] : defaultCharacter
        return (
          <div key={index} style={{ alignSelf: 'stretch', padding: '0 5px' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 5, borderRadius: 10,
              outline: names.has(character.name) ? '3px solid var(--warningRed)' : 'none', outlineOffset: -1.5,
            }}>
              <div onClick={() => openCharacterSelection(index + 21)} style={{ cursor: 'pointer' }}>
                <CachedImage url={character.imageURL} size={50} />
              </div>
              <div style={{
                ...rounded(14, 700), color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{character.name || '\u200b' /* SwiftUI 的空 Text 也占一行高 */}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
