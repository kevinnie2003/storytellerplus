// AI 配版：生成抽卡堆。对应 iPad 版 AI/AISetupViews.swift 里的 AISetupSheet
import { useState } from 'react'
import type { Character } from '../game/types'
import { Sheet } from '../ui/Sheet'
import { rounded } from '../ui/kit'
import { aiErrorText, AIError } from './client'
import { setupSystem, setupUser, standardCounts, teamCN, withHouseRules } from './prompts'
import {
  AIChip, AIFlow, AIPanelHeader, AIPillButton, AIProgressLine, AITextField, aiPanelStyle, aiRequestJSON, strings, str,
} from './common'

interface AIBagPlan {
  bag: Character[]
  unknownNames: string[]
  reasoning: string
  postDraw: string[]
}

const wishChips = ['两边都有强信息位', '军团局（恶魔都是军团）', '疯子局（外来者有疯子，放两张恶魔牌）', '适合新手', '混乱一点，多些醉酒中毒']
const teams = ['townsfolk', 'outsider', 'minion', 'demon']

export function AISetupSheet({ open, onClose, playableCharacters, playerCount, onApply }: {
  open: boolean
  onClose: () => void
  playableCharacters: Character[]
  playerCount: number
  onApply: (bag: Character[], notes: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <SetupBody onClose={onClose} playableCharacters={playableCharacters} playerCount={playerCount} onApply={onApply} /> : null}
    </Sheet>
  )
}

function SetupBody({ onClose, playableCharacters, playerCount, onApply }: {
  onClose: () => void
  playableCharacters: Character[]
  playerCount: number
  onApply: (bag: Character[], notes: string) => void
}) {
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [progress, setProgress] = useState('')
  const [errorText, setErrorText] = useState('')
  const [plan, setPlan] = useState<AIBagPlan | null>(null)

  const cardsNeeded = Math.min(playerCount, 15)

  const generate = async () => {
    setBusy(true)
    setStartedAt(Date.now())
    setProgress('正在思考…')
    setErrorText('')
    setPlan(null)
    const candidates = playableCharacters.filter((c) => teams.includes(c.team))
    try {
      const object = await aiRequestJSON(
        withHouseRules(setupSystem),
        setupUser(candidates, playerCount, wish),
        '正在写出配版…',
        setProgress,
      )
      const result: AIBagPlan = { bag: [], unknownNames: [], reasoning: '', postDraw: [] }
      for (const name of strings(object.bag)) {
        const character = candidates.find((c) => c.name === name)
        if (character) result.bag.push(character)
        else result.unknownNames.push(name)
      }
      result.reasoning = str(object.reasoning)
      result.postDraw = strings(object.post_draw)
      if (result.bag.length === 0) throw new AIError('badFormat', '没有给出任何剧本里的角色')
      setPlan(result)
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    setBusy(false)
  }

  return (
    <div style={aiPanelStyle(12)}>
      <AIPanelHeader title="AI 配版" onClose={onClose} />
      <div style={rounded(16, 600)}>{`${playerCount} 名玩家，需要 ${cardsNeeded} 张牌。标准配置：${standardCounts(playerCount)}`}</div>
      <AITextField value={wish} onChange={setWish} placeholder="对这局配版的诉求（可不填）" maxLines={4} style={{ flex: 'none' }} />
      <AIFlow>
        {wishChips.map((chip) => (
          <AIChip key={chip} text={chip} onClick={() => setWish((w) => (w === '' ? chip : w + '；' + chip))} />
        ))}
      </AIFlow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AIPillButton
          text={busy ? '配版中…' : plan === null ? '生成配版' : '重新生成'}
          filled
          onClick={generate}
          disabled={busy || playerCount < 5}
        />
        {busy ? <AIProgressLine since={startedAt} text={progress} /> : null}
        {playerCount < 5 ? <span style={{ ...rounded(15), color: 'var(--ai-red)' }}>至少需要 5 名玩家</span> : null}
      </div>
      {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
      {plan !== null ? (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="ai-select-text" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              {teams.map((team) => {
                const names = plan.bag.filter((c) => c.team === team).map((c) => c.name)
                if (names.length === 0) return null
                return <div key={team} style={rounded(17, 600)}>{`${teamCN(team)} ${names.length} 张：${names.join('、')}`}</div>
              })}
              {plan.bag.length !== cardsNeeded ? (
                <div style={{ ...rounded(15, 700), color: 'var(--ai-red)' }}>
                  {`注意：AI 给了 ${plan.bag.length} 张牌，应该是 ${cardsNeeded} 张，应用后请手动调整。`}
                </div>
              ) : null}
              {plan.unknownNames.length > 0 ? (
                <div style={{ ...rounded(15, 700), color: 'var(--ai-red)' }}>
                  {`注意：这些名字不在剧本里，已忽略：${plan.unknownNames.join('、')}`}
                </div>
              ) : null}
              {plan.reasoning !== '' ? <div style={{ ...rounded(16), paddingTop: 4, whiteSpace: 'pre-wrap' }}>{plan.reasoning}</div> : null}
              {plan.postDraw.length > 0 ? (
                <>
                  <div style={{ ...rounded(16, 700), paddingTop: 4 }}>抽完卡之后要做的事：</div>
                  {plan.postDraw.map((line, i) => <div key={i} style={rounded(16)}>{`${i + 1}. ${line}`}</div>)}
                </>
              ) : null}
            </div>
          </div>
          <div>
            <AIPillButton
              text="应用到配版，去检查"
              filled
              onClick={() => {
                const notes = plan.postDraw.join('\n')
                const bag = plan.bag
                onClose()
                onApply(bag, notes)
              }}
            />
          </div>
        </>
      ) : <div style={{ flex: 1 }} />}
    </div>
  )
}
