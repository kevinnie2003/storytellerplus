// 说书人联机（说书人这边）：开房间、看谁入座、私聊、把角色发到手机（可以只发给一个人）、关房间
import { useEffect, useState } from 'react'
import { game, useGame } from '../game/store'
import type { Character } from '../game/types'
import { Sheet } from '../ui/Sheet'
import { showAlert } from '../ui/Alert'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'
import { mono, rounded, STChoice, STPageHeader, STRow, STSection } from '../ui/kit'
import { CachedImage } from '../ui/CachedImage'
import { changedRoleSeats, closeRoom, kickSeat, lastRoleFor, markWhispersRead, openRoom, previousRoom, reuseRoom, replyTo, roleInfo, sendRoles, syncHostPush, useHost, whisperLabel } from '../net/host'
import { relayURL } from '../net/relay'
import { askPermission, pushState, type PushState } from '../net/push'

/** 玩家打开的网址 */
export function playerURL(code?: string): string {
  const url = new URL(`${import.meta.env.BASE_URL}online/`, location.href)
  if (code) url.searchParams.set('room', code)
  return url.href
}

export function RoomPanel() {
  const open = useHost((s) => s.showPanel)
  const close = () => useHost.setState({ showPanel: false })
  return (
    <Sheet open={open} onClose={close} width="min(calc(100vw - 48px), 720px)">
      {open ? <RoomContent onClose={close} /> : null}
    </Sheet>
  )
}

const team: Record<string, string> = {
  townsfolk: 'var(--townsfolk)', outsider: 'var(--outsider)', minion: 'var(--minion)', demon: 'var(--demon)', traveler: 'var(--traveler)',
}

function RoomContent({ onClose }: { onClose: () => void }) {
  const compact = useCompact()
  const code = useHost((s) => s.code)
  const status = useHost((s) => s.status)
  const room = useHost((s) => s.room)
  const error = useHost((s) => s.error)
  const dealt = useHost((s) => s.dealt)
  const players = useGame((s) => s.playersAssignedCharacters)
  const [dealing, setDealing] = useState(false)
  const changed = new Set(changedRoleSeats(dealt, players, room))
  const [copied, setCopied] = useState(false)
  // 上一局的房间还在的话，这一局可以接着用
  const [prev, setPrev] = useState('')
  useEffect(() => {
    if (code) return
    let alive = true
    void previousRoom().then((c) => { if (alive) setPrev(c) })
    return () => { alive = false }
  }, [code])

  const copy = () => {
    void navigator.clipboard?.writeText(playerURL(code)).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const confirmClose = () => showAlert({
    title: '关掉房间？',
    message: '所有玩家都会被请出去，要重新开房间、重新输入房间号。',
    buttons: [{ label: '取消', role: 'cancel' }, { label: '关掉', role: 'destructive', action: closeRoom }],
  })

  const seats = room?.seats ?? []
  const joined = seats.filter((s) => s.taken).length

  return (
    <div style={{ flex: 1, minHeight: 0, padding: compact ? '12px 16px 0' : '28px 28px 0', display: 'flex', flexDirection: 'column', gap: compact ? 12 : 18 }}>
      <STPageHeader title="说书人联机" onClose={onClose} />
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: compact ? 20 : 26, paddingBottom: 30 }}>
        {!code ? (
          <STSection title="线下联机">
            <STRow title="夜里用手机发信息" hint="开一个房间，玩家用手机打开联机网址、输入房间号、选自己的座位。夜里你在夜晚顺序里点“发信息”“让他选”，信息直接出现在他的手机上，大家不用闭眼，你也不用走动。" />
            {!relayURL() ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>联机服务还没有设置好，暂时用不了</div> : null}
            {error ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>{error}</div> : null}
            {prev ? (
              <STRow title={`接着用上一局的房间 ${prev}`} hint="玩家不用重新输房间号，上一局的信息和结果会清掉。换了座位或者人数变了，就让大家重新选座位（昵称会记住）。">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <STChoice selected disabled={players.length === 0} onClick={() => reuseRoom(false)}>
                    <span style={rounded(16, 800)}>座位不变</span>
                  </STChoice>
                  <STChoice selected={false} disabled={players.length === 0} onClick={() => reuseRoom(true)}>
                    <span style={rounded(16, 800)}>大家重新选座位</span>
                  </STChoice>
                </div>
              </STRow>
            ) : null}
            <div>
              <STChoice selected={!prev} disabled={status === 'connecting' || players.length === 0} onClick={() => { void openRoom() }}>
                <span style={rounded(17, 800)}>{status === 'connecting' ? '正在开房间…' : prev ? '开一个新房间' : '开房间'}</span>
              </STChoice>
            </div>
            {players.length === 0 ? <div style={{ ...rounded(15), opacity: 0.6 }}>先在齿轮面板里定好玩家人数</div> : null}
          </STSection>
        ) : (
          <>
            <STSection title="房间号">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ ...mono(compact ? 44 : 56, 900), letterSpacing: 8 }}>{code}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                  <span style={{ ...rounded(15, 700) }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', marginRight: 6, background: status === 'online' ? '#34c759' : '#ff9f0a' }} />
                    {status === 'online' ? `已连接 · ${joined}/${seats.length} 人入座` : '正在重连…'}
                  </span>
                  <span style={{ ...rounded(15), opacity: 0.7, wordBreak: 'break-all' }}>玩家打开 {playerURL()} ，输入房间号</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <STChoice selected={false} onClick={copy}>
                  <span style={rounded(16, 800)}>{copied ? '已复制' : '复制带房间号的链接'}</span>
                </STChoice>
              </div>
            </STSection>

            <HostPush />

            <STSection title="座位">
              {seats.length === 0 ? <div style={{ ...rounded(15), opacity: 0.6 }}>还没有座位</div> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {seats.map((s, i) => {
                  const c = players[i]
                  const chip: React.CSSProperties = { ...rounded(14, 800), padding: '6px 11px', borderRadius: 999, border: '2px solid var(--ink)', flexShrink: 0 }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: compact ? 'wrap' : 'nowrap' }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: c?.name ? team[c.team] ?? 'var(--ink)' : 'var(--ink)', color: 'var(--goodTextBg)', ...rounded(17, 900),
                      }}>{i + 1}</span>
                      <span style={{ ...rounded(16, 700), width: compact ? 64 : 90, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.75 }}>{c?.name || '—'}</span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, ...rounded(16, 700) }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: !s.taken ? 'transparent' : s.online ? '#34c759' : '#ff9f0a', border: s.taken ? 'none' : '1.5px solid var(--ink)' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: s.taken ? 1 : 0.5 }}>
                          {s.taken ? `${s.name || '已入座'}${s.online ? '' : '（掉线）'}` : '空座位'}
                        </span>
                        {changed.has(i) ? <span style={{ ...rounded(13, 900), color: 'var(--warningRed)', flexShrink: 0 }}>角色变了</span> : null}
                      </span>
                      {s.taken ? (
                        <span style={{ display: 'flex', gap: 6, marginLeft: compact ? 46 : 0 }}>
                          <button onClick={() => replyTo(i)} style={chip}>私聊</button>
                          <button
                            onClick={() => dealOne(i)}
                            disabled={!c?.name}
                            style={{ ...chip, opacity: c?.name ? 1 : 0.35, ...(changed.has(i) ? { borderColor: 'var(--warningRed)', color: 'var(--warningRed)' } : {}) }}
                          >发角色</button>
                          <button
                            onClick={() => showAlert({
                              title: `清空 ${i + 1}号座位？`, message: '这个玩家要重新选座位。坐错位置时用。',
                              buttons: [{ label: '取消', role: 'cancel' }, { label: '清空', role: 'destructive', action: () => kickSeat(i) }],
                            })}
                            style={chip}
                          >清空</button>
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </STSection>

            <Whispers />

            <STSection title="角色">
              <STRow title="把角色发到玩家手机" hint="分好角色后发一次，玩家在手机上长按就能看自己的角色。酒鬼这类看到的和真实不一样的，在这里改成要显示的角色。之后谁的角色变了（比如舞蛇人换了恶魔），座位上会标“角色变了”，点那个座位的“发角色”只发给他一个人。">
                <div>
                  <STChoice selected={false} disabled={players.some((p) => !p.name) || joined === 0} onClick={() => setDealing(true)}>
                    <span style={rounded(16, 800)}>发角色…</span>
                  </STChoice>
                </div>
              </STRow>
            </STSection>

            <div>
              <STChoice selected={false} onClick={confirmClose} style={{ borderColor: 'var(--warningRed)', color: 'var(--warningRed)' }}>
                <span style={rounded(16, 800)}>关掉房间</span>
              </STChoice>
            </div>
          </>
        )}
      </div>
      {dealing ? <DealRoles onClose={() => setDealing(false)} /> : null}
    </div>
  )

  /** 只给一个座位发角色：默认发他现在的角色（酒鬼默认显示成镇民），也可以去发角色页面换一个 */
  function dealOne(seat: number) {
    const actual = players[seat]
    const shown = defaultRoleFor(seat)
    showAlert({
      title: `把角色发给 ${seat + 1}号？`,
      message: shown.name === actual.name ? `他的手机上会显示：${shown.name}` : `真实是${actual.name}，他的手机上会显示：${shown.name}`,
      sheet: true,
      buttons: [
        { label: `发：${shown.name}`, action: () => { sendRoles([{ seat, role: roleInfo(shown), actual: actual.name }]) } },
        { label: '换成别的角色…', action: () => setDealing(true) },
        { label: '取消', role: 'cancel' },
      ],
    })
  }
}

/** 一个座位默认显示的角色：真实角色没变就沿用上次发的，变了或者没发过就用他现在的角色（酒鬼显示成镇民） */
function defaultRoleFor(seat: number): Character {
  const s = game()
  const actual = s.playersAssignedCharacters[seat]
  const { dealt, messages } = useHost.getState()
  const all = [...s.playableCharacters, ...s.travelers]
  if (dealt[seat] === actual.name) {
    const last = lastRoleFor(messages, seat)
    const found = last && (all.find((c) => c.name === last.name) ?? s.playersAssignedCharacters.find((c) => c.name === last.name))
    if (found) return found
  }
  const used = new Set([...s.playersAssignedCharacters, ...s.notPresentedGoodCharacters].map((c) => c.name))
  return defaultShown(actual, s.playableCharacters, used)
}

/** 酒鬼默认显示成一个不在场、也不是恶魔伪装的镇民，其他人显示自己的角色 */
function defaultShown(c: Character, all: Character[], used: Set<string>): Character {
  if (c.name !== '酒鬼') return c
  return all.find((x) => x.team === 'townsfolk' && !used.has(x.name)) ?? c
}

function DealRoles({ onClose }: { onClose: () => void }) {
  const players = useGame((s) => s.playersAssignedCharacters)
  const playable = useGame((s) => s.playableCharacters)
  const travelers = useGame((s) => s.travelers)
  const room = useHost((s) => s.room)
  const messages = useHost((s) => s.messages)
  const dealt = useHost((s) => s.dealt)
  const [shown, setShown] = useState<string[]>(() => players.map((_, seat) => defaultRoleFor(seat).name))
  const options = [...new Map([...playable, ...travelers, ...players].filter((c) => c.name).map((c) => [c.name, c])).values()]
  const byName = new Map(options.map((c) => [c.name, c]))
  const changed = new Set(changedRoleSeats(dealt, players, room))

  const entry = (seat: number) => ({ seat, role: roleInfo(byName.get(shown[seat]) ?? players[seat]), actual: players[seat].name })
  const sendAll = () => {
    const list = players.map((_, seat) => entry(seat)).filter(({ seat }) => room?.seats[seat]?.taken)
    if (sendRoles(list)) {
      onClose()
      showAlert({ title: '角色已发出', message: `发给了 ${list.length} 名已入座的玩家。没入座的人入座后，可以单独发给他。`, buttons: [{ label: '好' }] })
    }
  }
  const [flash, setFlash] = useState(-1)
  const sendOne = (seat: number) => {
    if (sendRoles([entry(seat)])) {
      setFlash(seat)
      window.setTimeout(() => setFlash((f) => (f === seat ? -1 : f)), 1500)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--mainbg)', display: 'flex', flexDirection: 'column', padding: 'inherit', gap: 14, zIndex: 5 }}>
      <STPageHeader title="发角色" onClose={onClose} />
      <div style={{ ...rounded(15), opacity: 0.7 }}>右边是玩家手机上会看到的角色。可以点“发”只发给一个人，也可以在最下面全部发。</div>
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {players.map((c, i) => {
          const s = byName.get(shown[i])
          const taken = room?.seats[i]?.taken
          const last = lastRoleFor(messages, i)
          const state = !taken ? '没入座' : flash === i ? '已发出' : changed.has(i) ? '角色变了' : last ? `已发：${last.name}` : '还没发'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: taken ? 1 : 0.45 }}>
              <span style={{ ...rounded(17, 900), width: 34, flexShrink: 0 }}>{i + 1}号</span>
              <span style={{ ...rounded(16, 700), width: 72, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
              <SFIcon name="chevron.right" size={16} weight="bold" />
              {s ? <CachedImage url={s.imageURL} size={34} /> : null}
              <select
                value={shown[i]}
                onChange={(e) => setShown((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                style={{ ...rounded(16, 800), flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 12, border: '2.5px solid var(--ink)', background: 'var(--paper)', color: s?.name !== c.name ? 'var(--warningRed)' : 'var(--ink)' }}
              >
                {options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, width: 64 }}>
                <button
                  disabled={!taken}
                  onClick={() => sendOne(i)}
                  style={{ ...rounded(14, 800), padding: '5px 14px', borderRadius: 999, border: '2px solid var(--ink)', ...(changed.has(i) ? { borderColor: 'var(--warningRed)', color: 'var(--warningRed)' } : {}) }}
                >发</button>
                <span style={{ ...rounded(11, 700), opacity: 0.7, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', color: changed.has(i) ? 'var(--warningRed)' : undefined }}>{state}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <STChoice selected onClick={sendAll} style={{ width: '100%' }}>
          <span style={rounded(18, 900)}>全部发到玩家手机</span>
        </STChoice>
      </div>
    </div>
  )
}

/** 玩家发来的私信、申请发动能力、申请私聊 */
function Whispers() {
  const whispers = useHost((s) => s.whispers)
  const players = useGame((s) => s.playersAssignedCharacters)
  const unread = whispers.filter((w) => !w.readAt).map((w) => w.id)
  return (
    <STSection title="玩家私信">
      {whispers.length === 0 ? <div style={{ ...rounded(15), opacity: 0.6 }}>玩家可以在手机上私信你、申请发动能力或者申请私聊，会显示在这里</div> : null}
      {unread.length ? (
        <div><STChoice selected={false} onClick={() => markWhispersRead(unread)}><span style={rounded(15, 800)}>全部标为已读</span></STChoice></div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...whispers].reverse().slice(0, 30).map((w) => (
          <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: team[players[w.seat]?.team ?? ''] ?? 'var(--ink)', color: 'var(--goodTextBg)', ...rounded(15, 900),
            }}>{w.seat + 1}</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...rounded(13, 700), opacity: 0.6 }}>{`${w.phase || ''} · ${w.readAt ? '已读' : '未读'}`}</span>
              <span style={{ ...rounded(16, w.readAt ? 600 : 900), whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {`${whisperLabel[w.kind]}${w.text ? `：${w.text}` : ''}`}
              </span>
            </div>
            <button
              onClick={() => { markWhispersRead([w.id]); replyTo(w.seat) }}
              style={{ ...rounded(14, 800), padding: '6px 12px', borderRadius: 999, border: '2px solid var(--ink)', flexShrink: 0 }}
            >回复</button>
          </div>
        ))}
      </div>
    </STSection>
  )
}

/** 说书人的通知：玩家私信、申请私聊、回复你时，你不在看魔典就弹通知 */
function HostPush() {
  const [state, setState] = useState<PushState>(() => pushState())
  const [note, setNote] = useState('')
  const enable = async () => {
    const next = await askPermission()
    setState(next)
    if (next === 'granted') setNote((await syncHostPush()) ? '' : '没开成，等一下再试')
  }
  const hint = state === 'granted' ? '已开启。玩家私信、申请私聊、回复你的时候，你不在看这个页面就会弹通知。'
    : state === 'denied' ? '通知被关掉了。想收的话，去系统设置里给这个网页打开通知。'
    : state === 'ios-install' ? 'iPhone、iPad 要先在 Safari 里点分享，选“添加到主屏幕”，从主屏幕打开说书人普拉斯才能收通知。'
    : state === 'unsupported' ? '这个浏览器收不了通知。'
    : '玩家私信、申请私聊、回复你的时候，你切到别的 app 也会弹通知。'
  return (
    <STSection title="通知">
      <STRow title="有玩家找你时提醒" hint={hint}>
        {state === 'default' ? (
          <div><STChoice selected onClick={() => { void enable() }}><span style={rounded(16, 800)}>开启通知</span></STChoice></div>
        ) : null}
        {note ? <div style={{ ...rounded(15, 700), color: 'var(--warningRed)' }}>{note}</div> : null}
      </STRow>
    </STSection>
  )
}
