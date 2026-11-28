// 说书人联机（玩家端）：输入房间号、选座位，夜里看手机收说书人的信息、选人回传
import { useEffect, useMemo, useRef, useState } from 'react'
import { CODE_LENGTH, normalizeCode, type RoomMessage, type ScriptCharacter } from '../net/protocol'
import { ackMessage, claimSeat, joinRoom, leaveRoom, replyMessage, respondMessage, savedPlayerRoom, sendWhisper, syncPush, usePlayer } from '../net/player'
import { relayURL } from '../net/relay'
import { askPermission, pushState, type PushState } from '../net/push'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { mono, rounded, STChoiceRow } from '../ui/kit'
import { Confetti } from '../ui/Confetti'
import { ReviewTimeline } from '../ai/ReviewTimeline'
import { fetchIcons, iconIsCached, normalizeRecap, renderRecapPoster } from '../ai/RecapPoster'
import type { GameSaveData } from '../game/types'
import { AlertHost, showAlert } from '../ui/Alert'
import { makeCharacter, type Team } from '../game/types'
import { PhoneAllCharacterInfos, saveCharacterInfosImage, type LayoutData } from '../overlays/AllCharacterInfos'

const teamColor: Record<string, string> = {
  townsfolk: 'var(--townsfolk)', outsider: 'var(--outsider)', minion: 'var(--minion)', demon: 'var(--demon)',
  traveler: 'var(--traveler)', fabled: 'var(--fabled)',
}
const teamName: Record<string, string> = {
  townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇角色',
}

const page: React.CSSProperties = {
  position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--mainbg)', color: 'var(--ink)',
  paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
  paddingLeft: 16, paddingRight: 16,
}
const bigButton = (filled = true, disabled = false): React.CSSProperties => ({
  ...rounded(19, 900), width: '100%', padding: '15px 0', borderRadius: 16, textAlign: 'center',
  background: filled ? 'var(--ink)' : 'transparent', color: filled ? 'var(--mainbg)' : 'var(--ink)',
  border: '3px solid var(--ink)', opacity: disabled ? 0.35 : 1, flexShrink: 0,
})
/** 说书人现在会发的几种（以前的“全员同步”“手机投票”不再显示） */
const KINDS: string[] = ['text', 'choose', 'role', 'ask']
const shownKind = (m: RoomMessage) => KINDS.includes(m.kind)

const headerButton: React.CSSProperties = {
  width: 40, height: 40, borderRadius: '50%', border: '2.5px solid var(--ink)', color: 'var(--ink)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

const field: React.CSSProperties = {
  ...rounded(17, 700), width: '100%', padding: '12px 14px', borderRadius: 14, border: '3px solid var(--ink)',
  background: 'var(--paper)', color: 'var(--ink)', outline: 'none',
}

/** 屏幕保持常亮：入座以后一直开着，切回来时再要一次 */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try { lock = await navigator.wakeLock.request('screen') } catch { /* 不支持或者没允许 */ }
      if (!alive) lock?.release().catch(() => {})
    }
    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [on])
}

/** 夜里变深色，和魔典一样 */
function useNightTheme(night: boolean) {
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'dark' : 'light'
  }, [night])
}

export function PlayerApp() {
  const code = usePlayer((s) => s.code)
  const seat = usePlayer((s) => s.seat)
  const night = usePlayer((s) => !!s.room?.night && s.seat >= 0)
  useNightTheme(night)
  useWakeLock(seat >= 0)

  // 打开时：网址里带了房间号就进那个房间，否则回到上次的房间
  useEffect(() => {
    const fromURL = normalizeCode(new URLSearchParams(location.search).get('room') ?? '')
    const target = fromURL.length === CODE_LENGTH ? fromURL : savedPlayerRoom()
    if (target) joinRoom(target)
  }, [])

  return (
    <>
      {!code ? <JoinScreen /> : seat < 0 ? <SeatScreen /> : <SeatedScreen />}
      <AlertHost />
    </>
  )
}

// ——— 输入房间号 ———
function JoinScreen() {
  const error = usePlayer((s) => s.error)
  const [text, setText] = useState('')
  const value = normalizeCode(text)
  const ready = value.length === CODE_LENGTH
  const noRelay = !relayURL()
  return (
    <div className="dot-bg" style={{ ...page, justifyContent: 'center', gap: 22 }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={rounded(36, 900)}>说书人联机</div>
        <div style={{ ...rounded(15, 600), opacity: 0.65 }}>血染钟楼线下联机：夜里用手机收说书人的信息</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
        <div style={rounded(17, 800)}>房间号（问说书人要）</div>
        <input
          value={value}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ready) joinRoom(value) }}
          placeholder="4位房间号"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          style={{ ...field, ...mono(30, 900), textAlign: 'center', letterSpacing: 10, padding: '12px 0' }}
        />
        {error ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>{error}</div> : null}
        {noRelay ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>联机服务还没有设置好，暂时用不了</div> : null}
        <button style={bigButton(true, !ready)} disabled={!ready} onClick={() => joinRoom(value)}>进入房间</button>
        {pushState() === 'ios-install' ? (
          <div style={{ ...rounded(14, 600), opacity: 0.7, lineHeight: 1.45, textAlign: 'center' }}>
            iPhone 想在别的 app 里也收到说书人的提醒：先点 Safari 的分享按钮，选“添加到主屏幕”，再从主屏幕打开说书人联机加入房间
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatusDot() {
  const status = usePlayer((s) => s.status)
  const hostOnline = usePlayer((s) => s.room?.hostOnline ?? false)
  const ok = status === 'online'
  const label = !ok ? (status === 'connecting' ? '连接中' : '断线重连中') : hostOnline ? '已连接' : '说书人不在线'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...rounded(13, 700), opacity: 0.8, whiteSpace: 'nowrap' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: ok && hostOnline ? '#34c759' : ok ? '#ff9f0a' : '#ff3b30' }} />
      {label}
    </span>
  )
}

// ——— 选座位 ———
function SeatScreen() {
  const code = usePlayer((s) => s.code)
  const room = usePlayer((s) => s.room)
  const error = usePlayer((s) => s.error)
  const [name, setName] = useState(() => { try { return localStorage.getItem('RoomPlayerName') ?? '' } catch { return '' } })
  const named = name.trim() !== ''
  const pick = (i: number) => {
    if (!named) return
    try { localStorage.setItem('RoomPlayerName', name) } catch { /* 存不了就算了 */ }
    claimSeat(i, name.trim())
  }
  return (
    <div className="dot-bg" style={{ ...page, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={rounded(22, 900)}>房间 {code}</div>
          <StatusDot />
        </div>
        <button onClick={() => leaveRoom()} style={{ ...rounded(15, 800), padding: '8px 14px', borderRadius: 999, border: '2.5px solid var(--ink)' }}>换房间</button>
      </div>
      {!room ? (
        <div style={{ ...rounded(16, 600), opacity: 0.7, textAlign: 'center', marginTop: 40 }}>正在进入房间…</div>
      ) : (
        <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={rounded(17, 800)}>你的昵称（必填）</div>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="大家都认得的名字" style={field} />
            <div style={{ ...rounded(14, 600), opacity: 0.6 }}>其他玩家选人时会看到“几号 · 昵称”，不用抬头对座位</div>
          </div>
          <div style={rounded(17, 800)}>{named ? '点你坐的座位号' : '先填昵称，再点座位号'}</div>
          {room.seats.length === 0 ? (
            <div style={{ ...rounded(15, 600), opacity: 0.7 }}>说书人还没定人数，请稍等</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 10 }}>
              {room.seats.map((s, i) => (
                <button
                  key={i}
                  disabled={s.taken || !named}
                  onClick={() => pick(i)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    height: 72, borderRadius: 16, border: '3px solid var(--ink)', color: 'var(--ink)',
                    background: s.taken ? 'transparent' : 'var(--paper)', opacity: s.taken ? 0.4 : named ? 1 : 0.6,
                  }}
                >
                  <span style={rounded(24, 900)}>{i + 1}</span>
                  <span style={{ ...rounded(12, 700), maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.taken ? (s.name || '有人') : '空'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>{error}</div> : null}
        </div>
      )}
    </div>
  )
}

// ——— 入座以后 ———
function SeatedScreen() {
  const code = usePlayer((s) => s.code)
  const seat = usePlayer((s) => s.seat)
  const name = usePlayer((s) => s.name)
  const room = usePlayer((s) => s.room)
  const inbox = usePlayer((s) => s.inbox)
  const [showHistory, setShowHistory] = useState(false)
  const [showWhisper, setShowWhisper] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const unreadSent = usePlayer((s) => s.sent.filter((w) => !w.readAt).length)
  const ended = !!room?.ended

  // 还没回复的，最早的那条先处理
  const pending = useMemo(() => inbox.find((m) => !m.readAt && !m.cancelled && shownKind(m)), [inbox])
  const role = useMemo(() => [...inbox].reverse().find((m) => m.kind === 'role' && !m.cancelled)?.role, [inbox])
  // 说书人发来新东西：关掉私信页和记录页，免得挡住
  const pendingId = pending?.id
  useEffect(() => {
    if (!pendingId) return
    setShowWhisper(false)
    setShowHistory(false)
    setShowPlayers(false)
    setShowScript(false)
  }, [pendingId])

  return (
    <div style={{ ...page, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', ...rounded(24, 900),
        }}>{seat + 1}</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ ...rounded(18, 900), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {seat + 1}号{name ? ` · ${name}` : ''}{room?.phase ? ` · ${room.phase}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ ...rounded(13, 700), opacity: 0.6, whiteSpace: 'nowrap' }}>房间 {code}</span>
            <StatusDot />
          </div>
        </div>
        <button
          aria-label="玩家列表"
          onClick={() => setShowPlayers(true)}
          style={headerButton}
        >
          <SFIcon name="person.2" size={20} />
        </button>
        <button
          aria-label="全部角色"
          onClick={() => setShowScript(true)}
          style={headerButton}
        >
          <SFIcon name="person.2.crop.square.stack" size={20} />
        </button>
        <button
          aria-label="记录"
          onClick={() => setShowHistory(true)}
          style={headerButton}
        >
          <SFIcon name="list.bullet.clipboard" size={20} />
        </button>
      </div>

      {!pending && !ended ? <PushPrompt /> : null}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {ended ? <EndView /> : pending ? <PendingMessage key={pending.id} message={pending} /> : <Waiting night={!!room?.night} setup={!room?.phase || room.phase === '配版'} />}
      </div>

      {!pending && !ended && role ? <RoleHold role={role} /> : null}
      {!pending && !ended ? (
        <button style={bigButton(false)} onClick={() => setShowWhisper(true)}>
          私信说书人{unreadSent ? ` · ${unreadSent} 条未读` : ''}
        </button>
      ) : null}
      {showWhisper ? <WhisperPage onClose={() => setShowWhisper(false)} /> : null}
      {showHistory ? <History onClose={() => setShowHistory(false)} /> : null}
      {showPlayers ? <PlayersPage onClose={() => setShowPlayers(false)} /> : null}
      {showScript ? <ScriptPage onClose={() => setShowScript(false)} /> : null}
    </div>
  )
}

function Waiting({ night, setup }: { night: boolean; setup: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
      <SFIcon name={night ? 'moon' : setup ? 'checkmark.circle.fill' : 'sun.min'} size={56} />
      <div style={rounded(24, 900)}>{night ? '请看着手机' : setup ? '已入座' : '白天'}</div>
      <div style={{ ...rounded(16, 600), opacity: 0.6, lineHeight: 1.4 }}>
        {night ? '等待说书人。有你的信息会直接显示在这里'
          : setup ? '说书人正在准备，游戏开始后这里会显示你的角色和夜里的信息。请保持这个页面开着'
          : '天亮了，可以放下手机讨论。入夜后说书人会通过这里发信息'}
      </div>
    </div>
  )
}

/** 一条要处理的：信息、选人、角色、发动能力 */
function PendingMessage({ message: m }: { message: RoomMessage }) {
  const room = usePlayer((s) => s.room)
  // 之前已经发过角色：这是换了的新角色（比如舞蛇人换了恶魔）
  const renewed = usePlayer((s) => s.inbox.some((x) => x.kind === 'role' && x.id !== m.id && !x.cancelled && x.sentAt <= m.sentAt))
  const seats = room?.seats.length ?? 0
  const seatNames = (room?.seats ?? []).map((x) => x.name)
  const alive = room?.alive ?? []
  const mySeat = usePlayer((s) => s.seat)
  const [reply, setReply] = useState('')
  const [picks, setPicks] = useState<number[]>([])
  const count = Math.max(1, m.count ?? 1)

  if (m.kind === 'choose') {
    const toggle = (i: number) => setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= count ? [...p.slice(1), i] : [...p, i]))
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...rounded(26, 900), textAlign: 'center', marginTop: 8 }}>请选 {count} 名玩家</div>
        {m.text ? <div style={{ ...rounded(16, 600), opacity: 0.75, textAlign: 'center', lineHeight: 1.4 }}>{m.text}</div> : null}
        <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10 }}>
            {Array.from({ length: seats }, (_, i) => {
              const on = picks.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  style={{
                    height: 70, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    border: '3px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--mainbg)' : 'var(--ink)',
                    outline: i === mySeat ? '2px dashed var(--ink)' : 'none', outlineOffset: 3,
                    opacity: alive[i] === false && !on ? 0.55 : 1,
                  }}
                >
                  <span style={rounded(22, 900)}>{i + 1}</span>
                  <span style={{ ...rounded(12, 700), maxWidth: '92%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {seatNames[i] || ' '}{alive[i] === false ? '（死）' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <button
          style={bigButton(true, picks.length === 0)}
          disabled={picks.length === 0}
          onClick={() => respondMessage(m.id, [...picks].sort((a, b) => a - b))}
        >
          {picks.length ? `确认 ${[...picks].sort((a, b) => a - b).map((p) => `${p + 1}号${seatNames[p] ? ` ${seatNames[p]}` : ''}`).join('、')}` : '先点座位号'}
        </button>
      </div>
    )
  }

  if (m.kind === 'role' && m.role) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
        <div style={{ ...rounded(24, 900), textAlign: 'center' }}>{renewed ? '你的角色变了' : '说书人发来了你的角色'}</div>
        {renewed ? <div style={{ ...rounded(16, 800), textAlign: 'center' }}>说书人发来了你现在的角色，以这个为准</div> : null}
        <div style={{ ...rounded(15, 600), textAlign: 'center', opacity: 0.65, lineHeight: 1.4 }}>别让旁边的人看到。长按下面的按钮，进度条满了才显示，松手就藏起来</div>
        <RoleHold role={m.role} />
        <button style={bigButton()} onClick={() => ackMessage(m.id)}>记住了</button>
      </div>
    )
  }

  if (m.kind === 'ask') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...rounded(26, 900), textAlign: 'center', marginTop: 8 }}>说书人请你发动能力</div>
        {m.text ? <div style={{ ...rounded(17, 700), textAlign: 'center', lineHeight: 1.4 }}>{m.text}</div> : null}
        <div style={{ ...rounded(14, 600), opacity: 0.6, textAlign: 'center' }}>只有说书人能看到。打字时注意别让旁边的人看到屏幕</div>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value.slice(0, 500))}
          placeholder="写下你的选择，比如：我猜 3号 是小恶魔"
          rows={4}
          style={{ ...field, resize: 'none', lineHeight: 1.4, flexShrink: 0 }}
        />
        <div style={{ flex: 1 }} />
        <button style={bigButton(true, !reply.trim())} disabled={!reply.trim()} onClick={() => replyMessage(m.id, reply.trim())}>发给说书人</button>
        <button style={bigButton(false)} onClick={() => replyMessage(m.id, '')}>这次不发动</button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...rounded(16, 800), textAlign: 'center', opacity: 0.6, marginTop: 6 }}>说书人给你的信息</div>
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...rounded(m.text.length > 40 ? 26 : m.text.length > 16 ? 34 : 46, 900), textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {m.text}
        </div>
      </div>
      <button style={bigButton()} onClick={() => ackMessage(m.id)}>知道了</button>
    </div>
  )
}

function RoleCard({ role }: { role: NonNullable<RoomMessage['role']> }) {
  const color = teamColor[role.team] ?? 'var(--neutralTeam)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 16px', borderRadius: 22, background: color, color: 'var(--goodTextBg)' }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--goodTextBg)' }}>
        <CachedImage url={role.imageURL} size={96} />
      </div>
      <div style={rounded(30, 900)}>{role.name}</div>
      <div style={{ ...rounded(14, 800), opacity: 0.8 }}>{teamName[role.team] ?? ''}</div>
      <div style={{ ...rounded(16, 600), lineHeight: 1.4, textAlign: 'center' }}>{role.ability}</div>
    </div>
  )
}

const HOLD_MS = 800

/** 长按满进度条才显示自己的角色，松手就藏起来；碰一下不会显示 */
function RoleHold({ role, label = '长按查看我的角色' }: { role: NonNullable<RoomMessage['role']>; label?: string }) {
  const [holding, setHolding] = useState(false)
  const [show, setShow] = useState(false)
  const timer = useRef(0)
  const start = (e: React.PointerEvent) => {
    // 手指稍微挪一下也不算松手
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 有的浏览器不支持 */ }
    setHolding(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(true), HOLD_MS)
  }
  const stop = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
    setShow(false)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <>
      <button
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          ...bigButton(false), position: 'relative', overflow: 'hidden', touchAction: 'none',
          userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        }}
      >
        {/* 进度条：按住时从左往右涨满，松手立刻清零 */}
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: holding ? '100%' : '0%', background: 'var(--ink)', opacity: 0.2,
          transition: holding ? `width ${HOLD_MS}ms linear` : 'none',
        }} />
        <span style={{ position: 'relative' }}>{holding ? '继续按住…' : label}</span>
      </button>
      {show ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--mainbg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: 20, pointerEvents: 'none' }}>
          <RoleCard role={role} />
          <div style={{ ...rounded(15, 700), opacity: 0.6, textAlign: 'center' }}>松手就会藏起来</div>
        </div>
      ) : null}
    </>
  )
}

const whisperLabel = { ability: '申请发动能力', talk: '申请私聊', text: '' } as const

/** 私信说书人：申请发动能力、申请私聊，或者打字 */
function WhisperPage({ onClose }: { onClose: () => void }) {
  const sent = usePlayer((s) => s.sent)
  const [text, setText] = useState('')
  const [flash, setFlash] = useState('')
  const send = (kind: 'text' | 'ability' | 'talk') => {
    const body = text.trim()
    if (kind === 'text' && !body) return
    if (sendWhisper(kind, body)) {
      setText('')
      setFlash(kind === 'text' ? '已发给说书人' : `已${whisperLabel[kind]}，等说书人回应`)
      window.setTimeout(() => setFlash(''), 2500)
    } else {
      setFlash('没连上，等一下再发')
    }
  }
  return (
    <div style={{ ...page, zIndex: 40, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...rounded(22, 900), flex: 1 }}>私信说书人</div>
        <button aria-label="关闭" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SFIcon name="xmark" size={22} weight="bold" />
        </button>
      </div>
      <div style={{ ...rounded(14, 600), opacity: 0.65, lineHeight: 1.4 }}>只有说书人能看到。打字时注意别让旁边的人看到屏幕。</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...bigButton(false), flex: 1 }} onClick={() => send('ability')}>申请发动能力</button>
        <button style={{ ...bigButton(false), flex: 1 }} onClick={() => send('talk')}>申请私聊</button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        placeholder="想说的话，可以附在申请上，也可以单独发。比如赌徒：我猜 3 号是小恶魔"
        rows={3}
        style={{ ...field, resize: 'none', lineHeight: 1.4, flexShrink: 0 }}
      />
      <button style={bigButton(true, !text.trim())} disabled={!text.trim()} onClick={() => send('text')}>发送文字</button>
      {flash ? <div style={{ ...rounded(15, 800), textAlign: 'center' }}>{flash}</div> : null}
      <div style={{ ...rounded(16, 800), marginTop: 4 }}>发过的</div>
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sent.length === 0 ? <div style={{ ...rounded(15, 600), opacity: 0.6 }}>还没发过</div> : null}
        {[...sent].reverse().map((w) => (
          <div key={w.id} style={{ padding: '8px 12px', borderRadius: 12, border: '2px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ ...rounded(13, 700), opacity: 0.6 }}>{w.phase || ' '} · {w.readAt ? '说书人已读' : '未读'}</div>
            <div style={{ ...rounded(16, 800), whiteSpace: 'pre-wrap' }}>{[whisperLabel[w.kind], w.text].filter(Boolean).join('：')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 玩家列表：几号、昵称、在线、死活、死人票。随时能看，选人时不用抬头对座位 */
function PlayersPage({ onClose }: { onClose: () => void }) {
  const room = usePlayer((s) => s.room)
  const mySeat = usePlayer((s) => s.seat)
  const seats = room?.seats ?? []
  return (
    <div style={{ ...page, zIndex: 40, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...rounded(22, 900), flex: 1 }}>玩家列表</div>
        <button aria-label="关闭" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SFIcon name="xmark" size={22} weight="bold" />
        </button>
      </div>
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {seats.map((s, i) => {
          const dead = room?.alive?.[i] === false
          const vote = room?.deadVote?.[i] !== false
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 14,
              border: i === mySeat ? '3px solid var(--ink)' : '2px solid color-mix(in srgb, var(--ink) 35%, transparent)', opacity: dead ? 0.6 : 1,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--ink)', color: 'var(--mainbg)', ...rounded(19, 900),
              }}>{i + 1}</span>
              <span style={{ ...rounded(18, 800), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.taken ? s.name || '（没填昵称）' : '没人用手机'}{i === mySeat ? '（我）' : ''}
              </span>
              {dead ? <span style={{ ...rounded(14, 800), flexShrink: 0 }}>{vote ? '死亡 · 有死人票' : '死亡 · 票已用'}</span> : null}
              {s.taken && !s.online ? <span style={{ ...rounded(13, 700), opacity: 0.6, flexShrink: 0 }}>掉线</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function History({ onClose }: { onClose: () => void }) {
  const inbox = usePlayer((s) => s.inbox)
  // 从旧到新排，打开时停在最下面（最新的）
  const list = inbox.filter((m) => shownKind(m) && !m.cancelled)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [list.length])
  return (
    <div style={{ ...page, zIndex: 40, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...rounded(22, 900), flex: 1 }}>收到的信息</div>
        <button aria-label="关闭" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SFIcon name="xmark" size={22} weight="bold" />
        </button>
      </div>
      <div ref={scroller} className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 ? <div style={{ ...rounded(16, 600), opacity: 0.6 }}>还没有收到信息</div> : null}
        {list.map((m) => (
          <div key={m.id} style={{ padding: '10px 14px', borderRadius: 14, border: '2.5px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ ...rounded(13, 700), opacity: 0.6 }}>{m.phase || ' '}</div>
            <div style={{ ...rounded(18, 800), lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
              {m.kind === 'text' ? m.text
                : m.kind === 'choose' ? `选 ${m.count ?? 1} 人${m.text ? `：${m.text}` : ''}${m.picks ? ` → ${m.picks.map((p) => `${p + 1}号`).join('、')}` : '（还没选）'}`
                : m.kind === 'role' ? '说书人发来了你的角色（在主页面长按查看）'
                : m.kind === 'ask' ? `说书人请你发动能力${m.text ? `：${m.text}` : ''}\n你的回复：${m.reply === undefined ? '（还没回）' : m.reply || '这次不发动'}` : ''}
            </div>
          </div>
        ))}
        <button onClick={() => showAlert({
          title: '离开座位？', message: '离开后别人可以坐这个位置，你要重新选座位。',
          buttons: [{ label: '取消', role: 'cancel' }, { label: '离开', role: 'destructive', action: () => { leaveRoom(true); onClose() } }],
        })} style={{ ...bigButton(false), marginTop: 20 }}>离开座位</button>
      </div>
    </div>
  )
}

/** 开通知：说书人找你时，就算切到别的 app 也会弹提醒 */
function PushPrompt() {
  const [state, setState] = useState<PushState>(() => pushState())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('RoomPushHint') === state } catch { return false } })
  if (hidden || state === 'granted' || state === 'unsupported') return null
  const dismiss = () => {
    try { localStorage.setItem('RoomPushHint', state) } catch { /* 存不了就算了 */ }
    setHidden(true)
  }
  const enable = async () => {
    setBusy(true)
    setError('')
    const next = await askPermission()
    if (next === 'granted' && !(await syncPush())) setError('没开成，等一下再试')
    setBusy(false)
    setState(next)
  }
  const text = state === 'ios-install'
    ? 'iPhone 要先添加到主屏幕才能收提醒：点 Safari 的分享按钮，选“添加到主屏幕”，从主屏幕打开说书人联机重新进房间（先在这里离开座位）'
    : state === 'denied'
      ? '通知被关掉了。想收提醒的话，去系统设置里给这个网页打开通知'
      : '开启通知：说书人找你时，就算你切到别的 app 也会提醒你'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '2.5px solid var(--ink)', flexShrink: 0 }}>
      <div style={{ flex: 1, ...rounded(14, 700), lineHeight: 1.4 }}>
        {text}
        {error ? <div style={{ color: 'var(--warningRed)' }}>{error}</div> : null}
      </div>
      {state === 'default' ? (
        <button disabled={busy} onClick={() => { void enable() }} style={{ ...rounded(15, 900), padding: '8px 12px', borderRadius: 999, background: 'var(--ink)', color: 'var(--mainbg)', flexShrink: 0, opacity: busy ? 0.5 : 1 }}>开启</button>
      ) : null}
      <button aria-label="不再提示" onClick={dismiss} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--ink)' }}>
        <SFIcon name="xmark" size={16} weight="bold" />
      </button>
    </div>
  )
}

/** 这一局剧本的全部角色能力和夜晚顺序：和说书人手机上的“全部角色能力”是同一页 */
function ScriptPage({ onClose }: { onClose: () => void }) {
  const script = usePlayer((s) => s.script)
  const [saving, setSaving] = useState(false)
  const data = useMemo<LayoutData>(() => {
    const toChars = (list: ScriptCharacter[] | undefined) => (list ?? []).map((c) => makeCharacter({
      id: c.id || c.name, name: c.name, ability: c.ability, imageURL: c.imageURL, team: c.team as Team,
      firstNightOrder: c.firstNightOrder ?? 0, otherNightOrder: c.otherNightOrder ?? 0,
    }))
    return { playableCharacters: toChars(script?.characters), travelersInPlay: toChars(script?.travelers), fabledInPlay: toChars(script?.fabled) }
  }, [script])
  const save = async () => {
    setSaving(true)
    await saveCharacterInfosImage(data, script?.name ?? '')
    setSaving(false)
  }
  return <PhoneAllCharacterInfos data={data} isSavingImage={saving} onSave={() => { void save() }} onClose={onClose} />
}

const winnerText = (w: string) => (w === 'evil' ? '邪恶阵营胜利' : '善良阵营胜利')

/** 游戏结束：赢了放礼炮、显示胜利，输了显示失败；下面是复盘（时间线和 AI 复盘） */
function EndView() {
  const ended = usePlayer((s) => s.room?.ended)
  const seat = usePlayer((s) => s.seat)
  const final = usePlayer((s) => s.final)
  const [replay, setReplay] = useState(0)
  const game = (final?.game ?? null) as GameSaveData | null
  const recap = useMemo(() => normalizeRecap(final?.recap ?? null), [final])
  const [tab, setTab] = useState<'timeline' | 'recap'>('timeline')
  const [poster, setPoster] = useState<Blob | null>(null)
  const [posterURL, setPosterURL] = useState('')

  // AI 复盘到了：画成长图（先用手上有的图标画，再补下载缺的图标重画），并切过去
  useEffect(() => {
    if (!game || !recap) return
    let cancelled = false
    setTab('recap')
    ;(async () => {
      const first = await renderRecapPoster(game, recap)
      if (cancelled) return
      setPoster(first)
      const missing = [...new Set(game.playersAssignedCharacters.map((c) => c.imageURL).filter((u) => u && !iconIsCached(u)))]
      if (!missing.length) return
      await fetchIcons(missing, 8000)
      const again = await renderRecapPoster(game, recap)
      if (!cancelled && again) setPoster(again)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final])
  useEffect(() => {
    if (!poster) { setPosterURL(''); return }
    const url = URL.createObjectURL(poster)
    setPosterURL(url)
    return () => URL.revokeObjectURL(url)
  }, [poster])

  if (!ended) return null
  const won = seat >= 0 && seat < ended.results.length ? ended.results[seat] : null
  const color = ended.winner === 'evil' ? 'var(--demon)' : 'var(--townsfolk)'

  const savePoster = async () => {
    if (!poster) return
    const file = new File([poster], `${game?.playName || '复盘'}-复盘.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }) } catch { /* 取消了 */ }
      return
    }
    const a = document.createElement('a')
    a.href = posterURL
    a.download = file.name
    a.click()
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {won ? <Confetti replay={replay} /> : null}
      <button
        onClick={() => { if (won) setReplay((r) => r + 1) }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '18px 12px', borderRadius: 20, flexShrink: 0,
          background: won ? color : 'transparent', color: won ? 'var(--goodTextBg)' : 'var(--ink)',
          border: won ? 'none' : '3px solid var(--ink)', animation: 'st-rise .4s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <span style={rounded(won === null ? 30 : 44, 900)}>{won === null ? winnerText(ended.winner) : won ? '胜利！' : '失败'}</span>
        <span style={{ ...rounded(16, 800), opacity: 0.85 }}>{won === null ? '游戏结束' : `游戏结束 · ${winnerText(ended.winner)}`}</span>
      </button>
      {!game ? (
        <div style={{ ...rounded(15, 600), opacity: 0.6, textAlign: 'center' }}>正在取复盘…</div>
      ) : (
        <>
          <STChoiceRow<'timeline' | 'recap'> options={[['timeline', '时间线'], ['recap', 'AI 复盘']]} value={tab} onChange={setTab} />
          <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {tab === 'timeline' ? <ReviewTimeline game={game} /> : posterURL ? (
              <>
                <img src={posterURL} alt="复盘长图" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, border: '2px solid var(--ink)', flexShrink: 0 }} />
                <button style={bigButton(false)} onClick={() => { void savePoster() }}>保存图片</button>
              </>
            ) : (
              <div style={{ ...rounded(15, 600), opacity: 0.6, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
                {recap ? '正在画复盘图…' : '说书人那边生成 AI 复盘后，会自动显示在这里'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
