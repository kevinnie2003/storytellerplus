// 夜晚顺序每一行下面的联机按钮：发信息、让他选，首夜的爪牙信息和恶魔信息预先写好、改完再发
import { useState } from 'react'
import { useGame } from '../game/store'
import type { OrderInfo } from '../game/types'
import { rounded, STChoice, STPageHeader } from '../ui/kit'
import { Sheet } from '../ui/Sheet'
import { useCompact } from '../ui/compact'
import { alertInputValue, showAlert } from '../ui/Alert'
import { lastMessageFor, replyTo, sendAsk, sendChoose, sendTexts, useHost } from '../net/host'

const chip: React.CSSProperties = {
  ...rounded(14, 800), padding: '5px 11px', borderRadius: 999, border: '2px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
}

/** 看提示里写的“两名玩家”之类，猜要选几个人 */
function guessCount(reminder: string): number {
  if (/三名|3名/.test(reminder)) return 3
  if (/两名|2名|二名/.test(reminder)) return 2
  return 1
}

interface Draft {
  title: string
  notes: string[]
  items: { seat: number; text: string }[]
}

export function OrderActions({ info }: { info: OrderInfo }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const online = useHost((s) => s.status === 'online')
  const room = useHost((s) => s.room)
  const messages = useHost((s) => s.messages)
  const players = useGame((s) => s.playersAssignedCharacters)
  const states = useGame((s) => s.playersStates)
  const bluffs = useGame((s) => s.notPresentedGoodCharacters)
  if (!online) return null
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation()

  // 首夜：爪牙信息、恶魔信息
  if (info.playerID === -2 || info.playerID === -3) {
    // 认知覆盖：提线木偶以为自己是好人，不收爪牙信息，但恶魔知道他；疯子以为自己是恶魔，不算真恶魔，他的假信息说书人自己发。
    // 两种记法都认：座位上直接是这张牌，或者拿着别的牌、挂着“是提线木偶”“是疯子”标记
    const is = (i: number, name: string) => players[i]?.name === name || (states[i] ?? []).some((r) => r.from === name && r.effect.includes(name))
    const seats = players.map((_, i) => i)
    const marionettes = seats.filter((i) => is(i, '提线木偶'))
    const lunatics = seats.filter((i) => is(i, '疯子'))
    const demons = seats.filter((i) => players[i].team === 'demon' && !lunatics.includes(i))
    const minions = seats.filter((i) => (players[i].team === 'minion' || marionettes.includes(i)))
    const awake = minions.filter((i) => !marionettes.includes(i))
    const seatsText = (list: number[]) => list.map((i) => `${i + 1}号`).join('、')
    const minionsText = minions.map((i) => `${i + 1}号${marionettes.includes(i) ? '（提线木偶）' : ''}`).join('、')
    const items = info.playerID === -2
      ? awake.map((seat) => ({ seat, text: `恶魔是 ${seatsText(demons)}${awake.length > 1 ? `\n你的爪牙同伴：${seatsText(awake.filter((m) => m !== seat))}` : ''}` }))
      : demons.map((seat) => ({
        seat,
        text: `你的爪牙：${minionsText || '没有'}\n不在场的角色：${bluffs.map((c) => c.name).filter(Boolean).join('、') || '（还没选恶魔伪装）'}`,
      }))
    // 这些角色在场时，邪恶互认的规则会变，一键发之前提醒说书人
    const notes = [
      marionettes.length ? `提线木偶（${seatsText(marionettes)}）以为自己是好人，不会收到爪牙信息${info.playerID === -3 ? '，恶魔会看到他是提线木偶' : ''}。` : '',
      lunatics.length ? `疯子（${seatsText(lunatics)}）没算进去，他的假信息请你自己发。` : '',
      seats.some((i) => players[i].name === '罂粟种植者') ? '场上有罂粟种植者：按规则爪牙和恶魔互相不知道，确定还要发吗？' : '',
      seats.some((i) => players[i].name === '魔术师') ? '场上有魔术师：按规则要把魔术师混进来，这里没有处理，建议自己发。' : '',
    ].filter(Boolean)
    const ready = items.length > 0 && items.every((x) => room?.seats[x.seat]?.taken)
    const open = () => setDraft({ title: info.playerID === -2 ? '发给爪牙：恶魔是谁' : '发给恶魔：爪牙和伪装', notes, items })
    return (
      <div onPointerDown={stop} onPointerUp={stop} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
        <button style={{ ...chip, opacity: ready ? 1 : 0.35 }} disabled={!ready} onClick={open}>发到手机…</button>
        {!ready ? <span style={{ ...rounded(13, 600), opacity: 0.6 }}>{items.length ? '有人还没入座' : '场上没有这类角色'}</span> : null}
        {draft ? <DraftSheet draft={draft} onClose={() => setDraft(null)} /> : null}
      </div>
    )
  }

  if (info.playerID < 0) return null
  const seat = info.playerID
  const taken = !!room?.seats[seat]?.taken
  const last = lastMessageFor(messages, seat)
  const status = !taken ? '没入座'
    : !last ? ''
    : last.kind === 'choose' ? (last.picks ? `选了 ${last.picks.map((p) => `${p + 1}号`).join('、') || '没有人'}` : '等他选')
    : last.kind === 'ask' ? (last.reply !== undefined ? `回复：${last.reply || '（没写）'}` : '等他写')
    : last.readAt ? '已读' : '还没读'

  const openNotepad = () => replyTo(seat)
  const choose = () => {
    const guess = guessCount(info.reminder)
    const counts = [guess, ...[1, 2, 3].filter((n) => n !== guess)]
    showAlert({
      title: `让 ${seat + 1}号 ${info.characterName} 在手机上选人`,
      message: '他选好后会显示在这里，也会记进整局记录',
      sheet: true,
      buttons: [
        ...counts.map((n) => ({ label: `选 ${n} 名玩家`, action: () => { sendChoose(seat, n, `${info.characterName}：请选择 ${n} 名玩家`) } })),
        { label: '取消', role: 'cancel' as const },
      ],
    })
  }

  return (
    <div onPointerDown={stop} onPointerUp={stop} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
      <button style={{ ...chip, opacity: taken ? 1 : 0.35 }} disabled={!taken} onClick={openNotepad}>发信息</button>
      <button style={{ ...chip, opacity: taken ? 1 : 0.35 }} disabled={!taken} onClick={choose}>让他选</button>
      <button style={{ ...chip, opacity: taken ? 1 : 0.35 }} disabled={!taken} onClick={() => askAbility(seat, info.characterName)}>要他发动</button>
      {status ? <span style={{ ...rounded(13, 700), opacity: 0.7 }}>{status}</span> : null}
    </div>
  )
}

/** 要某个座位发动能力：写一句提示，玩家在手机上打字回复 */
export function askAbility(seat: number, characterName: string) {
  showAlert({
    title: `要 ${seat + 1}号${characterName ? ` ${characterName}` : ''} 发动能力`,
    message: '写给他的提示，他在手机上打字回复你',
    input: { placeholder: '比如：请写下你猜的玩家和角色', value: characterName ? `${characterName}：请发动你的能力，写下你的选择` : '请发动你的能力，写下你的选择' },
    buttons: [
      { label: '取消', role: 'cancel' },
      { label: '发送', action: () => { sendAsk(seat, alertInputValue().trim() || '请发动你的能力') } },
    ],
  })
}

/** 预先写好的信息：每个人一条，说书人可以改，改完再发 */
function DraftSheet({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const compact = useCompact()
  const [texts, setTexts] = useState(() => draft.items.map((x) => x.text))
  const players = useGame((s) => s.playersAssignedCharacters)
  const ready = texts.some((t) => t.trim())
  const send = () => {
    const items = draft.items.map((x, i) => ({ seat: x.seat, text: texts[i].trim() })).filter((x) => x.text)
    if (sendTexts(items)) onClose()
  }
  return (
    <Sheet open onClose={onClose} width="min(calc(100vw - 48px), 600px)" height="min(calc(100vh - 48px), 720px)">
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{ flex: 1, minHeight: 0, padding: compact ? '12px 16px 0' : '28px 28px 0', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <STPageHeader title={draft.title} onClose={onClose} closeLabel="取消" />
        <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {draft.notes.map((n) => (
            <div key={n} style={{ ...rounded(15, 700), lineHeight: 1.4, color: 'var(--warningRed)' }}>{n}</div>
          ))}
          <div style={{ ...rounded(14, 600), opacity: 0.65 }}>已经按场上情况写好了，可以直接改。清空的那条不发。</div>
          {draft.items.map((x, i) => (
            <div key={x.seat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={rounded(16, 900)}>{x.seat + 1}号{players[x.seat]?.name ? ` ${players[x.seat].name}` : ''} 会看到</div>
              <textarea
                value={texts[i]}
                onChange={(e) => setTexts((v) => v.map((t, j) => (j === i ? e.target.value.slice(0, 2000) : t)))}
                rows={Math.max(3, texts[i].split('\n').length + 1)}
                style={{
                  ...rounded(17, 700), width: '100%', padding: '10px 12px', borderRadius: 14, border: '2.5px solid var(--ink)',
                  background: 'var(--paper)', color: 'var(--ink)', resize: 'vertical', lineHeight: 1.4, outline: 'none',
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <STChoice selected disabled={!ready} onClick={send} style={{ width: '100%' }}>
            <span style={rounded(18, 900)}>发送</span>
          </STChoice>
        </div>
      </div>
    </Sheet>
  )
}
