// 配版时右下的“设置调整”：剧本里会改配版的角色，对应 iPad 版 SubViews/setup/ExtraSetup.swift
import { useGame } from '../game/store'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'
import { ScrollColumn } from './common'

export function ExtraSetup() {
  const playableCharacters = useGame((s) => s.playableCharacters)
  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const assignedCharacterNames = playersAssignedCharacters.map((c) => c.name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', lineHeight: 1.2 }}>
      <ScrollColumn>
        <div style={{ ...rounded(25, 700), paddingTop: 10 }}>设置调整</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', paddingBottom: 20 }}>
          {playableCharacters.filter((c) => c.setup).map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: 10,
              opacity: assignedCharacterNames.includes(c.name) ? 1 : 0.5,
            }}>
              <CachedImage url={c.imageURL} size={50} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={rounded(20, 700)}>{c.name}</div>
                <div style={rounded(15, 600)}>{c.ability}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollColumn>
    </div>
  )
}
