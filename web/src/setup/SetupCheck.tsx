// 检查配版：四个阵营的牌全部翻开，点一下选中或去掉，还能加重复角色，对应 SetupCheck.swift
import { useState } from 'react'
import { useGame } from '../game/store'
import { teamCounts } from '../game/builtins'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { cardColorOf, CardFront, CardGrid, HFlow, PlusCircleFill, usePresence } from './cards'
import { ExtraRepeatedCharacterSelection } from './ExtraRepeatedCharacterSelection'
import { ExtraSetupForSetup } from './ExtraSetupForSetup'
import { setFlow, setSelectionState, teamNames, useSetupFlow } from './flowState'
import { barButton, phoneHint, phoneScroll } from './mobileStyles'

const sections: [string, string, string, number][] = [
  // 恶魔那行 iPad 版就是“恶魔， 应选”，逗号后面多一个空格
  ['demon', 'var(--demon)', '恶魔， 应选', 1],
  ['minion', 'var(--minion)', '爪牙，应选', 2],
  ['outsider', 'var(--outsider)', '外来者，应选', 3],
  ['townsfolk', 'var(--townsfolk)', '镇民，应选', 4],
]

const cardWrap = (selected: boolean): React.CSSProperties => ({
  // 透明度交给 CardFront 每层分别加（和 SwiftUI 的 .opacity 一样）
  transform: `scale(${selected ? 1.05 : 0.95})`,
  transition: 'transform .3s ease-in-out', cursor: 'pointer',
})

const heading: React.CSSProperties = { ...rounded(40, 700), padding: '15px 0', alignSelf: 'flex-start' }

export function SetupCheck() {
  const playerCount = useGame((s) => s.playerCount)
  const deck = useSetupFlow((s) => s.playableCharactersShuffled)
  const cardSelected = useSetupFlow((s) => s.cardSelected)
  const extraRepeatedCharacters = useSetupFlow((s) => s.extraRepeatedCharacters)
  const extraRepeatedCardSelected = useSetupFlow((s) => s.extraRepeatedCardSelected)
  const [showExtraCharacterSelection, setShowExtraCharacterSelection] = useState(false)
  const extra = usePresence(showExtraCharacterSelection, 300)
  const teamCount = [...(teamCounts[playerCount] ?? [0, 0, 0, 0, 0])].reverse()
  const total = cardSelected.filter(Boolean).length + extraRepeatedCardSelected.filter(Boolean).length

  const toggle = (index: number) => {
    const sel = [...useSetupFlow.getState().cardSelected]
    sel[index] = !sel[index]
    setFlow({ cardSelected: sel })
  }
  const toggleExtra = (index: number) => {
    const sel = [...useSetupFlow.getState().extraRepeatedCardSelected]
    sel[index] = !sel[index]
    setFlow({ extraRepeatedCardSelected: sel })
  }

  const compact = useCompact()
  if (compact) {
    // 手机：四个阵营一段一段往下排，一行 4 张；数量和“玩家开抽”在底部操作条
    const phoneHeading = (color: string, title: string, right?: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: color, border: '2.5px solid var(--ink)', flexShrink: 0 }} />
        <span style={{ ...rounded(19, 900), flex: 1, minWidth: 0 }}>{title}</span>
        {right}
      </div>
    )
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {extra.mounted ? (
          <ExtraRepeatedCharacterSelection shown={extra.shown} onClose={() => setShowExtraCharacterSelection(false)} />
        ) : null}
        <div data-tour="setup.check" className="scroll-hidden" style={phoneScroll}>
          <div style={phoneHint}>点牌选中，再点一下去掉。按每个阵营的应选张数选够，再点右下角“玩家开抽”</div>
          {sections.map(([team, color, , countIndex], i) => {
            const picked = deck.filter((c, index) => c.team === team && cardSelected[index]).length
            return (
              <div key={team} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {phoneHeading(color, `${teamNames[i]}，应选 ${teamCount[countIndex]} 张`, (
                  <span style={{ ...rounded(14, 800), opacity: 0.65, flexShrink: 0 }}>已选 {picked}</span>
                ))}
                <CardGrid target={79} style={{ padding: 2 }}>
                  {deck.map((c, index) => c.team === team ? (
                    <div key={index} onClick={() => toggle(index)} style={{ width: 200, height: 300, ...cardWrap(cardSelected[index]) }}>
                      <CardFront character={c} cardColor={color} dim={cardSelected[index] ? 1 : 0.7} />
                    </div>
                  ) : null)}
                </CardGrid>
              </div>
            )
          })}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {phoneHeading('var(--ink)', '添加重复角色')}
            <CardGrid target={79} style={{ padding: 2 }}>
              {extraRepeatedCharacters.map((c, index) => (
                <div key={index} onClick={() => toggleExtra(index)} style={{ width: 200, height: 300, ...cardWrap(extraRepeatedCardSelected[index]) }}>
                  <CardFront character={c} cardColor={cardColorOf(c.team, 'var(--ink)')} dim={extraRepeatedCardSelected[index] ? 1 : 0.7} />
                </div>
              ))}
              <button
                key="add"
                aria-label="添加重复角色"
                onClick={() => setShowExtraCharacterSelection(true)}
                style={{
                  width: 200, height: 300, borderRadius: 24, border: '8px dashed var(--ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <PlusCircleFill size={100} />
              </button>
            </CardGrid>
          </div>
        </div>
        <ExtraSetupForSetup
          status={`已选 ${total} / ${playerCount} 张`}
          extra={<button data-tour="setup.deal" style={barButton(true)} onClick={() => setSelectionState(12)}>玩家开抽</button>}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%' }}>
      {extra.mounted ? (
        <ExtraRepeatedCharacterSelection shown={extra.shown} onClose={() => setShowExtraCharacterSelection(false)} />
      ) : null}
      <div data-tour="setup.check" style={{ height: '100%', padding: '0 10px' }}>
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ ...rounded(50, 700), padding: '20px 0', flexShrink: 0 }}>请检查配置，已选 {total} 张</div>
          {sections.map(([team, color, title, countIndex]) => (
            <div key={team} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', flexShrink: 0,
              paddingBottom: team === 'townsfolk' ? 0 : 20,
            }}>
              <div style={heading}>{title} {teamCount[countIndex]} 张</div>
              <HFlow>
                {deck.map((c, index) => c.team === team ? (
                  <div key={index} style={{ padding: '20px 25px' }} onClick={() => toggle(index)}>
                    <div style={cardWrap(cardSelected[index])}>
                      <CardFront character={c} cardColor={color} dim={cardSelected[index] ? 1 : 0.7} />
                    </div>
                  </div>
                ) : null)}
              </HFlow>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', flexShrink: 0, paddingBottom: 20 }}>
            <div style={heading}>添加重复角色</div>
            <HFlow>
              {extraRepeatedCharacters.map((c, index) => (
                <div key={index} style={{ padding: '20px 25px' }} onClick={() => toggleExtra(index)}>
                  <div style={cardWrap(extraRepeatedCardSelected[index])}>
                    <CardFront character={c} cardColor={cardColorOf(c.team, 'var(--ink)')} dim={extraRepeatedCardSelected[index] ? 1 : 0.7} />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowExtraCharacterSelection(true)}
                style={{ padding: '20px 25px', borderRadius: '50%' }}
              >
                <div style={{ width: 200, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlusCircleFill size={100} />
                </div>
              </button>
            </HFlow>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flexShrink: 0 }}>
            <button
              data-tour="setup.deal"
              onClick={() => setSelectionState(12)}
              style={{
                ...rounded(20, 700), color: 'var(--ink)', padding: '17.5px 0', width: 153, marginTop: 30,
                background: 'var(--mainbg)', borderRadius: 30, border: '3px solid var(--ink)', whiteSpace: 'nowrap',
              }}
            >玩家开抽</button>
          </div>
        </div>
      </div>
    </div>
  )
}
