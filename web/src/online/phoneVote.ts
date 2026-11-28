// 说书人普肉的白天投票：提名确认后，从被提名者的下一位开始按座位顺序，一个一个问玩家投不投。
// 玩家在手机上选“举手投票”或“不投”，投了的自动记到投票面板上；所有人手机上都看得到进度
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { cancelMessages, sendVote, setBanner, useHost } from '../net/host'

interface Options {
  /** 投票面板在“投票”这一步，被提名的是玩家，房间连着 */
  active: boolean
  nominator: number
  nominee: number
  isTraveler: boolean
  votes: number[]
  addVote: (seat: number) => void
}

export interface PhoneVote {
  /** 正在问的座位，没有就是 -1 */
  asking: number
  /** 能投票但没用手机的人，说书人要自己记 */
  manual: number[]
  done: boolean
  /** 有人用手机投票 */
  running: boolean
  skip: () => void
}

const seatText = (i: number, n: number) => (i < n ? `${i + 1}号` : '说书人')

export function usePhoneVote({ active, nominator, nominee, isTraveler, votes, addVote }: Options): PhoneVote {
  const messages = useHost((s) => s.messages)
  const [order, setOrder] = useState<number[]>([])
  const [manual, setManual] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [askId, setAskId] = useState('')
  const handled = useRef(new Set<string>())
  const addRef = useRef(addVote)
  addRef.current = addVote

  // 开始：排好顺序（从被提名者的下一位顺时针一圈）
  const key = active ? `${nominator}>${nominee}` : ''
  useEffect(() => {
    if (!key) return
    const s = useGame.getState()
    const n = s.playersAssignedCharacters.length
    const seats = useHost.getState().room?.seats ?? []
    const eligible = (i: number) => isTraveler || s.playersIsAlive[i] || s.playersHasDeathVote[i]
    const all = Array.from({ length: n }, (_, k) => (nominee + 1 + k) % n).filter(eligible)
    setOrder(all.filter((i) => seats[i]?.taken))
    setManual(all.filter((i) => !seats[i]?.taken))
    setPos(0)
    setAskId('')
    return () => {
      // 投票结束或者换了提名：没回复的收回来
      const pending = useHost.getState().messages.filter((m) => m.kind === 'vote' && !m.readAt).map((m) => m.id)
      cancelMessages(pending)
      setBanner('')
    }
  }, [key])

  // 轮到下一位：发出去
  const asking = pos < order.length ? order[pos] : -1
  useEffect(() => {
    if (!key || asking < 0 || askId) return
    const s = useGame.getState()
    const n = s.playersAssignedCharacters.length
    const dead = !s.playersIsAlive[asking]
    const text = `要投票${isTraveler ? '流放' : '处决'} ${seatText(nominee, n)} 吗？`
    const note = dead && !isTraveler ? '你已经死亡，这是你唯一的死人票。投了就用掉，之后不能再投。' : ''
    const id = sendVote(asking, text, note)
    if (id) setAskId(id)
  }, [key, asking, askId, isTraveler, nominee])

  // 玩家回复了，或者被收回了：记票，问下一位
  useEffect(() => {
    if (!askId || handled.current.has(askId)) return
    const m = messages.find((x) => x.id === askId)
    if (!m || (m.answer === undefined && !m.cancelled)) return
    handled.current.add(askId)
    if (m.answer) addRef.current(m.seat)
    setAskId('')
    setPos((p) => p + 1)
  }, [messages, askId])

  // 所有人手机上的进度
  const n = useGame((s) => s.playersAssignedCharacters.length)
  const alive = useGame((s) => s.aliveCount)
  const count = votes.filter((v) => v < 25).length - votes.filter((v) => v >= 25).length
  const need = isTraveler ? Math.ceil(n / 2) : Math.ceil(alive / 2)
  const done = !!key && order.length > 0 && pos >= order.length
  useEffect(() => {
    if (!key || order.length === 0) return
    const head = `${seatText(nominator, n)}${isTraveler ? '流放' : '提名'}${seatText(nominee, n)}`
    setBanner(done
      ? `${head} · 手机投票结束 · ${count} 票（需要 ${need} 票）`
      : `${head} · 轮到 ${asking + 1}号 投票 · 当前 ${count} 票（需要 ${need} 票）`)
  }, [key, order.length, done, asking, count, need, nominator, nominee, isTraveler, n])

  const skip = () => { if (askId) cancelMessages([askId]) }

  return { asking: key ? asking : -1, manual: key ? manual : [], done, running: !!key && order.length > 0, skip }
}
