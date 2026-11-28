// 选角色，对应 SubViews/characterSelection/CharacterSelectionView.swift
// currentSelectedPlayerID 小于座位数是给座位换角色，大于 20 是恶魔伪装（第 currentSelectedPlayerID - 21 个）
import { useState } from 'react'
import type { Character } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { makeLog } from '../game/log'
import { registerUndo } from '../game/undo'
import { team2Int } from '../game/loadScript'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { MobilePage } from '../mobile/MobilePage'
import { OverlayLayer, panelHeight, stroke } from './common'

const sameCharacter = (a: Character, b: Character) =>
  (Object.keys(a) as (keyof Character)[]).every((k) => a[k] === b[k])

/** 换角色并写记录，登记撤销（恢复原来的角色，去掉这次的记录） */
function assignWithUndo(character: Character) {
  const s = game()
  const slot = s.currentSelectedPlayerID
  const previous: Character | null = slot < s.playersAssignedCharacters.length
    ? s.playersAssignedCharacters[slot]
    : (slot > 20 && slot - 21 < s.notPresentedGoodCharacters.length ? s.notPresentedGoodCharacters[slot - 21] : null)

  // assignCharacter
  const players = [...s.playersAssignedCharacters]
  const bluffs = [...s.notPresentedGoodCharacters]
  if (slot < players.length) players[slot] = character
  if (slot > 20) bluffs[slot - 21] = character

  // 不是配版阶段才记录
  let added: string | null = null
  const logs = [...s.allLogs]
  if (s.gameState !== 0) {
    const entry = slot <= 20
      ? makeLog({ message: `获得角色：${character.name}`, messager: slot + 1, source: '说书人', type: 0, playerCharacters: [character.name], playerTeams: [team2Int(character.team)] })
      : makeLog({ message: '', messager: 0, source: '说书人', type: 13, playerCharacters: [character.name], playerTeams: [team2Int(character.team)] })
    logs.push(entry)
    added = entry.id
  }
  setGame({ playersAssignedCharacters: players, notPresentedGoodCharacters: bluffs, allLogs: logs, selectNewCharacter: false })

  if (!previous || sameCharacter(previous, character)) return
  const old = previous
  const label = slot > 20 ? '恶魔伪装' : `${slot + 1} 号`
  registerUndo(`已把${label}换成${character.name}`, () => {
    setGame((st) => {
      const next: Partial<typeof st> = {}
      if (slot < st.playersAssignedCharacters.length) {
        const p = [...st.playersAssignedCharacters]
        p[slot] = old
        next.playersAssignedCharacters = p
      } else if (slot > 20 && slot - 21 < st.notPresentedGoodCharacters.length) {
        const b = [...st.notPresentedGoodCharacters]
        b[slot - 21] = old
        next.notPresentedGoodCharacters = b
      }
      if (added) next.allLogs = st.allLogs.filter((l) => l.id !== added)
      return next
    })
  })
}

export function CharacterSelection() {
  const show = useGame((s) => s.selectNewCharacter)
  return show ? <CharacterSelectionView /> : null
}

function CharacterSelectionView() {
  const compact = useCompact()
  // 和 iPad 版一样，打开时算一次
  const [lists] = useState(() => {
    const s = game()
    const playable = s.playableCharacters
    const travelersName = s.travelers.map((c) => c.name)
    return {
      sections: [
        ['镇民', playable.filter((c) => c.team === 'townsfolk')],
        ['外来者', playable.filter((c) => c.team === 'outsider')],
        ['爪牙', playable.filter((c) => c.team === 'minion')],
        ['恶魔', playable.filter((c) => c.team === 'demon')],
        ['剧本旅行者', s.travelers],
        ['官方旅行者', playable.filter((c) => c.team === 'traveler' && !travelersName.includes(c.name))],
      ] as [string, Character[]][],
      selectedNames: s.playersAssignedCharacters.map((c) => c.name),
    }
  })

  if (compact) return <PhoneCharacterSelection sections={lists.sections} selectedNames={lists.selectedNames} />

  return (
    <OverlayLayer
      zIndex={11}
      background="color-mix(in srgb, var(--mainbg) 30%, transparent)"
      onDoubleTapBackground={() => setGame({ selectNewCharacter: false })}
    >
      <div style={{
        position: 'relative', width: 800, height: panelHeight, background: 'var(--mainbg)',
        overflowY: 'auto', overflowX: 'hidden', ...stroke(3, 20),
      }}>
        {/* ScrollView 里的标题和网格之间都隔着默认的 8 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lists.sections.map(([title, chars]) => (
          <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...rounded(30, 700), padding: '16px 36px', display: 'flex' }}>{title}</div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', columnGap: 10, rowGap: 20,
              padding: 16,
            }}>
              {chars.map((c) => (
                <CharacterCell key={c.id} character={c} selected={lists.selectedNames.includes(c.name)} />
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>
    </OverlayLayer>
  )
}

function CharacterCell({ character, selected }: { character: Character; selected: boolean }) {
  return (
    <div
      onClick={() => assignWithUndo(character)}
      style={{
        justifySelf: 'center', alignSelf: 'center', maxWidth: '100%', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
        background: 'rgba(255,255,255,0.2)', borderRadius: 10,
        outline: selected ? '3px solid var(--ink)' : 'none', outlineOffset: -1.5,
      }}
    >
      <CachedImage url={character.imageURL} size={60} style={{ borderRadius: '50%', overflow: 'hidden' }} />
      <div style={{ ...rounded(15, 700), color: 'var(--ink)', textAlign: 'center', wordBreak: 'break-word' }}>{character.name}</div>
    </div>
  )
}

// 手机版：全屏一页，每类角色一组，一行四个左右
const sectionColors = ['var(--townsfolk)', 'var(--outsider)', 'var(--minion)', 'var(--demon)', 'var(--traveler)', 'var(--traveler)']

function PhoneCharacterSelection({ sections, selectedNames }: { sections: [string, Character[]][]; selectedNames: string[] }) {
  const slot = useGame((s) => s.currentSelectedPlayerID)
  const title = slot > 20 ? `恶魔伪装 ${slot - 20}` : `为${slot + 1}号选角色`
  return (
    <MobilePage
      title={title}
      zIndex={111}
      onClose={() => setGame({ selectNewCharacter: false })}
      bodyStyle={{ padding: '6px 12px calc(20px + env(safe-area-inset-bottom))', gap: 6 }}
    >
      {sections.map(([name, chars], i) => (chars.length === 0 ? null : (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...rounded(19, 900), color: sectionColors[i], padding: '10px 4px 0', lineHeight: 1.2 }}>{name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
            {chars.map((c) => (
              <button
                key={c.id}
                onClick={() => assignWithUndo(c)}
                style={{
                  minWidth: 0, minHeight: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                  gap: 4, padding: '8px 4px', borderRadius: 12, color: 'var(--ink)',
                  background: `color-mix(in srgb, ${sectionColors[i]} 14%, transparent)`,
                  outline: selectedNames.includes(c.name) ? '3px solid var(--ink)' : 'none', outlineOffset: -1.5,
                }}
              >
                <CachedImage url={c.imageURL} size={50} style={{ borderRadius: '50%', overflow: 'hidden' }} />
                <span style={{ ...rounded(13, 700), lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )))}
    </MobilePage>
  )
}
