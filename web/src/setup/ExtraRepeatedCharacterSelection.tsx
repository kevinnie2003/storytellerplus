// 检查页点 ⊕ 弹出来的角色表，选一个加成重复角色，对应 ExtraRepeatedCharacterSelectionView.swift
import { useGame } from '../game/store'
import { usePress } from '../ui/gestures'
import type { Character } from '../game/types'
import { MobilePage } from '../mobile/MobilePage'
import { useCompact } from '../ui/compact'
import { CardFront, CardGrid, HFlow } from './cards'
import { setFlow, useSetupFlow } from './flowState'
import { phoneHint } from './mobileStyles'

const order: [string, string][] = [
  ['demon', 'var(--demon)'], ['minion', 'var(--minion)'], ['outsider', 'var(--outsider)'], ['townsfolk', 'var(--townsfolk)'],
]

export function ExtraRepeatedCharacterSelection({ shown, onClose }: { shown: boolean; onClose: () => void }) {
  const playableCharacters = useGame((s) => s.playableCharacters)
  const backdrop = usePress({ onDoubleTap: onClose })
  const add = (c: Character) => {
    const f = useSetupFlow.getState()
    setFlow({
      extraRepeatedCardSelected: [...f.extraRepeatedCardSelected, true],
      extraRepeatedCharacters: [...f.extraRepeatedCharacters, c],
    })
    onClose()
  }
  const compact = useCompact()
  if (compact) {
    // 手机：盖在配版页上的全屏页，✕ 关掉
    if (!shown) return null
    return (
      <MobilePage title="添加重复角色" onClose={onClose} zIndex={118} bodyStyle={{ padding: '14px 12px calc(24px + env(safe-area-inset-bottom))', gap: 12 }}>
        <div style={phoneHint}>点一个角色，把它再加一张进抽卡堆</div>
        <CardGrid target={79} style={{ padding: 2 }}>
          {order.map(([team, color]) => playableCharacters.map((c, index) => c.team === team ? (
            <div key={`${team}-${index}`} onClick={() => add(c)} style={{ width: 200, height: 300, cursor: 'pointer' }}>
              <CardFront character={c} cardColor={color} />
            </div>
          ) : null))}
        </CardGrid>
      </MobilePage>
    )
  }
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: shown ? 1 : 0, transition: 'opacity .3s ease-in-out', pointerEvents: shown ? 'auto' : 'none',
    }}>
      <div {...backdrop} style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--mainbg) 30%, transparent)' }} />
      <div className="scroll-hidden" style={{
        position: 'relative', width: 800, maxHeight: 800, height: 'calc(100% - 100px)',
        overflowY: 'auto', background: 'var(--mainbg)', borderRadius: 20, outline: '3px solid var(--ink)', outlineOffset: -1.5,
      }}>
        <HFlow style={{ padding: '20px 10px' }}>
          {order.map(([team, color]) => playableCharacters.map((c, index) => c.team === team ? (
            <div key={`${team}-${index}`} style={{ padding: 15 }} onClick={() => add(c)}>
              <div style={{ position: 'relative', width: 100, height: 150, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', left: -50, top: -75, transform: 'scale(.5)' }}>
                  <CardFront character={c} cardColor={color} />
                </div>
              </div>
            </div>
          ) : null))}
        </HFlow>
      </div>
    </div>
  )
}
