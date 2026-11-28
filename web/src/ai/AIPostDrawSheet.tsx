// 玩家抽完卡之后，让 AI 决定谁是酒鬼、提线木偶、疯子等，并选恶魔伪装。
// 对应 iPad 版 AI/AISetupViews.swift 里的 AIPostDrawSheet，以及 StoryTellerView.applyAIPostDraw
import { useState } from 'react'
import type { Character } from '../game/types'
import { makeReminder } from '../game/types'
import { useGame } from '../game/store'
import { team2Int } from '../game/loadScript'
import { Sheet } from '../ui/Sheet'
import { rounded } from '../ui/kit'
import { aiErrorText } from './client'
import { makeAIContext } from './context'
import { postDrawSystem, postDrawUser, withHouseRules } from './prompts'
import {
  AIPanelHeader, AIPillButton, AIProgressLine, AITextField, AIToggle, aiPanelStyle, aiRequestJSON, isObject, str, strings,
} from './common'
import { uuid } from '../game/uuid'

export interface AIPostDrawTag {
  id: string
  playerIndex: number
  from: string
  effect: string
  reason: string
  enabled: boolean
}

interface AIPostDrawPlan {
  tags: AIPostDrawTag[]
  bluffs: Character[]
  bluffsReason: string
  notes: string
}

/** 把 AI 建议的开局标记和恶魔伪装写进魔典（StoryTellerView.applyAIPostDraw） */
export function applyAIPostDraw(tags: AIPostDrawTag[], bluffs: Character[]) {
  const s = useGame.getState()
  const playersStates = s.playersStates.map((list) => [...list])
  for (const tag of tags) {
    if (tag.playerIndex < 0 || tag.playerIndex >= playersStates.length) continue
    const template = s.allReminders.find((r) => r.from === tag.from && r.effect === tag.effect)
    const sourceTeam = s.characters.find((c) => c.name === tag.from)?.team ?? ''
    const sourcePlayer = s.playersAssignedCharacters.findIndex((c) => c.name === tag.from)
    const reminder = makeReminder(tag.from, tag.effect, template?.team ?? team2Int(sourceTeam), template?.isGlobal ?? false, sourcePlayer)
    if (!playersStates[tag.playerIndex].some((r) => r.from === reminder.from && r.effect === reminder.effect)) {
      playersStates[tag.playerIndex].push(reminder)
    }
  }
  const patch: Partial<ReturnType<typeof useGame.getState>> = { playersStates }
  if (bluffs.length === 3) patch.notPresentedGoodCharacters = bluffs
  s.set(patch)
}

export function AIPostDrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <PostDrawBody onClose={onClose} /> : null}
    </Sheet>
  )
}

function PostDrawBody({ onClose }: { onClose: () => void }) {
  // 用到的状态变了就重画（和 Swift 里每次 body 都调 makeContext 一样）
  const players = useGame((s) => s.playersAssignedCharacters)
  const setupNotes = useGame((s) => s.aiSetupNotes)
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [progress, setProgress] = useState('')
  const [errorText, setErrorText] = useState('')
  const [plan, setPlan] = useState<AIPostDrawPlan | null>(null)
  const [applyBluffs, setApplyBluffs] = useState(true)

  const generate = async () => {
    const ctx = makeAIContext()
    if (ctx.players.length === 0 || ctx.players.some((c) => c.name === '')) {
      setErrorText('还有玩家没有角色，请先让所有玩家抽完卡。')
      return
    }
    setBusy(true)
    setStartedAt(Date.now())
    setProgress('正在思考…')
    setErrorText('')
    setPlan(null)
    try {
      const object = await aiRequestJSON(
        withHouseRules(postDrawSystem),
        postDrawUser(ctx, wish),
        '正在写出结果…',
        setProgress,
      )
      const result: AIPostDrawPlan = { tags: [], bluffs: [], bluffsReason: '', notes: '' }
      const items = Array.isArray(object.tags) ? object.tags.filter(isObject) : []
      for (const item of items) {
        const player = typeof item.player === 'number' && Number.isInteger(item.player)
          ? item.player
          : (typeof item.player === 'string' && /^[+-]?\d+$/.test(item.player) ? parseInt(item.player, 10) : 0)
        const from = str(item.from)
        const effect = str(item.effect)
        if (player >= 1 && player <= ctx.players.length && effect !== '') {
          result.tags.push({ id: uuid(), playerIndex: player - 1, from, effect, reason: str(item.reason), enabled: true })
        }
      }
      const inPlay = new Set(ctx.players.map((c) => c.name))
      for (const name of strings(object.bluffs)) {
        const character = ctx.playableCharacters.find((c) => c.name === name && (c.team === 'townsfolk' || c.team === 'outsider'))
        if (character && !inPlay.has(name) && !result.bluffs.some((b) => sameCharacter(b, character))) {
          result.bluffs.push(character)
        }
      }
      result.bluffsReason = str(object.bluffs_reason)
      result.notes = str(object.notes)
      setPlan(result)
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    setBusy(false)
  }

  const setTagEnabled = (i: number, on: boolean) =>
    setPlan((p) => (p ? { ...p, tags: p.tags.map((t, j) => (j === i ? { ...t, enabled: on } : t)) } : p))

  return (
    <div style={aiPanelStyle(12)}>
      <AIPanelHeader title="AI 补完配版" onClose={onClose} />
      <div style={rounded(16)}>
        玩家抽完卡之后，让 AI 定下首夜之前必须决定的事：谁是酒鬼、提线木偶、疯子，占卜师的干扰项，首夜信息指向谁，以及三个恶魔伪装。之后才触发的能力不会提前打标记。结果要你确认后才会应用。
      </div>
      {setupNotes !== '' ? (
        <div style={{ ...rounded(15), color: 'var(--ai-secondary)', whiteSpace: 'pre-wrap' }}>{`配版时留下的待办：\n${setupNotes}`}</div>
      ) : null}
      <AITextField value={wish} onChange={setWish} placeholder="额外诉求（可不填），比如：酒鬼不要给占卜师" maxLines={3} style={{ flex: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AIPillButton text={busy ? '思考中…' : plan === null ? '开始' : '重新生成'} filled onClick={generate} disabled={busy} />
        {busy ? <AIProgressLine since={startedAt} text={progress} /> : null}
      </div>
      {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
      {plan !== null ? (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {plan.tags.length === 0 ? <div style={rounded(16)}>没有需要挂的开局标记。</div> : null}
              {plan.tags.map((tag, i) => {
                const character = tag.playerIndex < players.length ? players[tag.playerIndex].name : ''
                return (
                  <AIToggle key={tag.id} on={tag.enabled} onChange={(v) => setTagEnabled(i, v)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={rounded(17, 700)}>{`${tag.playerIndex + 1}号 ${character}：${tag.from}·${tag.effect}`}</div>
                      {tag.reason !== '' ? <div style={{ ...rounded(15), color: 'var(--ai-secondary)' }}>{tag.reason}</div> : null}
                    </div>
                  </AIToggle>
                )
              })}
              {plan.bluffs.length === 3 ? (
                <AIToggle on={applyBluffs} onChange={setApplyBluffs}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={rounded(17, 700)}>{`恶魔伪装：${plan.bluffs.map((c) => c.name).join('、')}`}</div>
                    {plan.bluffsReason !== '' ? <div style={{ ...rounded(15), color: 'var(--ai-secondary)' }}>{plan.bluffsReason}</div> : null}
                  </div>
                </AIToggle>
              ) : null}
              {plan.notes !== '' ? <div style={{ ...rounded(15), whiteSpace: 'pre-wrap' }}>{plan.notes}</div> : null}
            </div>
          </div>
          <div>
            <AIPillButton
              text="应用到魔典"
              filled
              onClick={() => {
                const tags = plan.tags.filter((t) => t.enabled)
                const bluffs = applyBluffs && plan.bluffs.length === 3 ? plan.bluffs : []
                onClose()
                applyAIPostDraw(tags, bluffs)
              }}
            />
          </div>
        </>
      ) : <div style={{ flex: 1 }} />}
    </div>
  )
}

/** Swift 里 Character 是值类型，contains 按全部字段比较 */
function sameCharacter(a: Character, b: Character): boolean {
  return a.id === b.id && a.name === b.name && a.team === b.team && a.ability === b.ability && a.imageURL === b.imageURL
}
