// 夜晚顺序每一行下面的联机按钮：发信息、让他选，首夜的爪牙信息和恶魔信息可以一键发
import { useGame } from '../game/store'
import type { OrderInfo } from '../game/types'
import { rounded } from '../ui/kit'
import { showAlert } from '../ui/Alert'
import { lastMessageFor, replyTo, sendChoose, sendTexts, useHost } from '../net/host'

const chip: React.CSSProperties = {
  ...rounded(14, 800), padding: '5px 11px', borderRadius: 999, border: '2px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
}

/** 看提示里写的“两名玩家”之类，猜要选几个人 */
function guessCount(reminder: string): number {
  if (/三名|3名/.test(reminder)) return 3
  if (/两名|2名|二名/.test(reminder)) return 2
  return 1
}

export function OrderActions({ info }: { info: OrderInfo }) {
  const online = useHost((s) => s.status === 'online')
  const room = useHost((s) => s.room)
  const messages = useHost((s) => s.messages)
  const players = useGame((s) => s.playersAssignedCharacters)
  const bluffs = useGame((s) => s.notPresentedGoodCharacters)
  if (!online) return null
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation()

  // 首夜：爪牙信息、恶魔信息
  if (info.playerID === -2 || info.playerID === -3) {
    const demons = players.map((c, i) => (c.team === 'demon' ? i : -1)).filter((i) => i >= 0)
    const minions = players.map((c, i) => (c.team === 'minion' ? i : -1)).filter((i) => i >= 0)
    const seatsText = (list: number[]) => list.map((i) => `${i + 1}号`).join('、')
    const items = info.playerID === -2
      ? minions.map((seat) => ({ seat, text: `恶魔是 ${seatsText(demons)}${minions.length > 1 ? `\n你的爪牙同伴：${seatsText(minions.filter((m) => m !== seat))}` : ''}` }))
      : demons.map((seat) => ({
        seat,
        text: `你的爪牙：${seatsText(minions) || '没有'}\n不在场的角色：${bluffs.map((c) => c.name).filter(Boolean).join('、') || '（还没选恶魔伪装）'}`,
      }))
    const ready = items.length > 0 && items.every((x) => room?.seats[x.seat]?.taken)
    const send = () => showAlert({
      title: info.playerID === -2 ? '把恶魔是谁发给爪牙？' : '把爪牙和伪装发给恶魔？',
      message: items.map((x) => `${x.seat + 1}号 会看到：\n${x.text}`).join('\n\n'),
      buttons: [{ label: '取消', role: 'cancel' }, { label: '发送', action: () => sendTexts(items) }],
    })
    return (
      <div onPointerDown={stop} onPointerUp={stop} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
        <button style={{ ...chip, opacity: ready ? 1 : 0.35 }} disabled={!ready} onClick={send}>一键发到手机</button>
        {!ready ? <span style={{ ...rounded(13, 600), opacity: 0.6 }}>{items.length ? '有人还没入座' : '场上没有这类角色'}</span> : null}
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
      {status ? <span style={{ ...rounded(13, 700), opacity: 0.7 }}>{status}</span> : null}
    </div>
  )
}
