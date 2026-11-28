// 记事本下面的“发到手机”：开着说书人普肉房间时，把拼好的这句话发给某个座位
import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { lastMessageFor, sendText, useHost } from '../net/host'

export function SendBar({ text, compact }: { text: string; compact: boolean }) {
  const online = useHost((s) => s.status === 'online')
  const room = useHost((s) => s.room)
  const seats = room?.seats ?? []
  const messages = useHost((s) => s.messages)
  const preset = useHost((s) => s.notepadTarget)
  const players = useGame((s) => s.playersAssignedCharacters)
  const [target, setTarget] = useState(preset)

  useEffect(() => { if (preset >= 0) setTarget(preset) }, [preset])
  // 关掉记事本时忘掉默认的座位
  useEffect(() => () => useHost.setState({ notepadTarget: -1 }), [])
  if (!online) return null

  const last = target >= 0 ? lastMessageFor(messages, target) : undefined
  const status = target < 0 ? ''
    : !seats[target]?.taken ? '这个座位还没人入座'
    : last ? `上一条${last.readAt ? '已读' : '还没读'}：${last.kind === 'text' ? last.text : last.kind === 'choose' ? '选人' : '角色'}` : ''
  const empty = text.trim() === ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '8px 12px 0' : '10px 14px', flexShrink: 0, flexWrap: 'wrap',
      borderTop: compact ? undefined : '3px solid var(--ink)',
    }}>
      <SFIcon name="paperplane.fill" size={18} />
      <span style={rounded(16, 800)}>发到</span>
      <select
        value={target}
        onChange={(e) => setTarget(Number(e.target.value))}
        style={{ ...rounded(16, 800), padding: '7px 8px', borderRadius: 10, border: '2.5px solid var(--ink)', background: 'var(--paper)', color: 'var(--ink)', minWidth: 0, maxWidth: compact ? 150 : 220 }}
      >
        <option value={-1}>选座位</option>
        {players.map((c, i) => (
          <option key={i} value={i}>{`${i + 1}号 ${c.name}${seats[i]?.taken ? (seats[i].online ? '' : '（掉线）') : '（没入座）'}`}</option>
        ))}
      </select>
      <span style={{ ...rounded(14, 600), opacity: 0.65, flex: 1, minWidth: 60, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</span>
      <button
        disabled={empty || target < 0 || !seats[target]?.taken}
        onClick={() => sendText(target, text.trim())}
        style={{
          ...rounded(16, 900), padding: '8px 16px', borderRadius: 12, background: 'var(--ink)', color: 'var(--mainbg)',
          opacity: empty || target < 0 || !seats[target]?.taken ? 0.35 : 1,
        }}
      >发送</button>
    </div>
  )
}
