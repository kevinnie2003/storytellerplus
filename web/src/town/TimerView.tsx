// 游戏时长、白天/夜晚时长、计时器（可倒计时）。对应 iPad 版 SubViews/timer/TimerView.swift
import { useEffect, useRef, useState } from 'react'
import { game, useGame } from '../game/store'
import { bumpTimer, timerState } from './timer'
import { useSettings, settings } from '../settings/store'
import { usePress } from '../ui/gestures'
import { alertInputValue, showAlert } from '../ui/Alert'
import { mono, rounded } from '../ui/kit'

/** 和 DateComponentsFormatter（时分秒、补零）一样：0:01:05 */
function formatted(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  // 模拟器里是 00:00:01，小时也补成两位
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const title: React.CSSProperties = { ...rounded(20, 700), color: 'var(--ink)', lineHeight: 1.2 }
const time: React.CSSProperties = { ...mono(18, 600), color: 'var(--ink)', lineHeight: 1.2 }
const section: React.CSSProperties = {
  flex: '1 1 0', minHeight: 'min-content', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, /* 两个 Text 之间 SwiftUI 默认不留空 */
}

export function TimerView({ compact = false }: { compact?: boolean } = {}) {
  const gameState = useGame((s) => s.gameState)
  const countdownSeconds = useSettings((s) => s.countdownSeconds)

  // 和 Swift 里的 @State 一样，用 ref 存，靠每秒一次的 now 刷新
  const [now, setNow] = useState(() => Date.now())
  const st = { current: timerState }
  const [timeUp, setTimeUp] = useState(false)
  const [flash, setFlash] = useState(false)
  const [, force] = useState(0)
  const rerender = () => { force((x) => x + 1); bumpTimer() }
  const timeUpRef = useRef(false)
  timeUpRef.current = timeUp
  const pressInCountdown = useRef(false)
  const countdownRef = useRef<HTMLDivElement>(null)

  const timerElapsed = (at: number) => st.current.previousTimerElapsed + Math.ceil((at - st.current.timerTimeStart) / 1000)
  const currentTimerValue = st.current.timerStopped ? st.current.previousTimerElapsed : timerElapsed(now)
  const timerDisplay = countdownSeconds > 0 ? Math.max(0, countdownSeconds - currentTimerValue) : currentTimerValue

  const resetTimer = () => {
    st.current.previousTimerElapsed = 0
    st.current.timerTimeStart = Date.now()
    setTimeUp(false)
    rerender()
  }

  /** 选好倒计时就直接开始 */
  const startCountdown = (seconds: number) => {
    settings().set('countdownSeconds', seconds)
    resetTimer()
    st.current.timerTimeStart = Date.now()
    st.current.timerStopped = useGame.getState().gameState === 0
    rerender()
  }

  // onAppear：换了一局才重新开始算（手机、大屏布局来回切换时接着算）
  useEffect(() => {
    const { gameState: gs, gameID } = game()
    if (timerState.gameID === gameID) return
    timerState.gameID = gameID
    const t = Date.now()
    if (gs !== 0) {
      timerState.gameStartTime = t
      if (gs === 1 || gs === 3) timerState.nightTimeStart = t
      else timerState.dayTimeStart = t
    }
    timerState.timerStopped = true
    timerState.previousTimerElapsed = 0
    bumpTimer()
  }, [])

  // 每秒一次
  useEffect(() => {
    const id = window.setInterval(() => {
      const date = Date.now()
      setNow(date)
      const cd = settings().countdownSeconds
      // 倒计时到 0：停下并闪烁提醒
      if (cd > 0 && !st.current.timerStopped && timerElapsed(date) >= cd) {
        st.current.previousTimerElapsed = cd
        st.current.timerStopped = true
        timeUpRef.current = true
        setTimeUp(true)
      }
      if (timeUpRef.current) setFlash((f) => !f)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // gameState 变了
  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current === gameState) return
    prevGameState.current = gameState
    const t = Date.now()
    if (gameState === 1) {
      st.current.gameStartTime = t
      st.current.nightTimeStart = t
    } else if (gameState === 2) {
      st.current.dayTimeStart = t
    } else if (gameState === 3) {
      st.current.nightTimeStart = t
    }
    st.current.timerStopped = true
    st.current.previousTimerElapsed = 0
    setTimeUp(false)
    rerender()
  }, [gameState])

  const openPicker = () => {
    showAlert({
      title: '计时器',
      message: '选好倒计时会直接开始。点一下暂停或继续，点两下归零',
      sheet: true,
      anchor: countdownRef.current,
      buttons: [
        { label: '归零', action: () => { resetTimer(); st.current.timerStopped = true; rerender() } },
        { label: '正计时', action: () => { settings().set('countdownSeconds', 0); resetTimer(); st.current.timerStopped = true; rerender() } },
        ...[60, 120, 180, 300, 600].map((seconds) => ({ label: `倒计时 ${seconds / 60} 分钟`, action: () => startCountdown(seconds) })),
        {
          label: '自定义时长…',
          action: () => showAlert({
            title: '倒计时多久？',
            message: '输入分钟数，可以带小数',
            input: { placeholder: '分钟，比如 1.5', value: '', inputMode: 'decimal' },
            buttons: [
              { label: '取消', role: 'cancel' },
              {
                label: '开始',
                action: () => {
                  const minutes = Number(alertInputValue().replace(/，/g, '.')) || 0
                  const seconds = Math.round(minutes * 60)
                  if (seconds > 0) startCountdown(Math.min(seconds, 99 * 60))
                },
              },
            ],
          }),
        },
        { label: '取消', role: 'cancel' },
      ],
    })
  }

  const press = usePress({
    // 双击归零
    onDoubleTap: () => resetTimer(),
    onTap: () => {
      if (timeUpRef.current) {
        // 时间到了，点一下归零
        resetTimer()
        st.current.timerStopped = true
        rerender()
        return
      }
      if (st.current.timerStopped) {
        st.current.timerTimeStart = Date.now()
        st.current.timerStopped = false
      } else {
        st.current.previousTimerElapsed = timerElapsed(Date.now())
        st.current.timerStopped = true
      }
      setNow(Date.now())
      rerender()
    },
    // 长按计时器那一栏：选倒计时
    onLongPress: () => { if (pressInCountdown.current) openPicker() },
    longPressSeconds: 0.5,
  })

  const night = gameState === 1 || gameState === 3
  // 手机版：一行，阶段时长 + 计时器，点、双击、长按和大屏一样
  if (compact) {
    const small: React.CSSProperties = { ...rounded(12, 700), opacity: 0.6, lineHeight: 1.1 }
    const t: React.CSSProperties = { ...mono(15, 700), lineHeight: 1.2 }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {night || gameState === 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={small}>本局</span>
            <span style={t}>{formatted((now - st.current.gameStartTime) / 1000)}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={small}>{night ? '夜晚' : gameState === 2 ? '白天' : '游戏'}</span>
          <span style={t}>{gameState === 0 ? '00:00:00' : formatted((now - (night ? st.current.nightTimeStart : gameState === 2 ? st.current.dayTimeStart : st.current.gameStartTime)) / 1000)}</span>
        </div>
        <div
          {...press}
          ref={countdownRef}
          onPointerDownCapture={() => { pressInCountdown.current = true }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '2px 8px', borderRadius: 8, border: '2px solid var(--ink)' }}
        >
          <span style={small}>{countdownSeconds > 0 ? '倒计时' : '计时器'}</span>
          <span style={{
            ...t, color: timeUp ? '#fff' : 'var(--ink)', borderRadius: 4, padding: '0 2px',
            background: timeUp && flash ? 'var(--demon)' : 'transparent',
          }}>{gameState === 0 ? '00:00:00' : formatted(timerDisplay)}</span>
        </div>
      </div>
    )
  }
  return (
    <div
      {...press}
      onPointerDownCapture={() => { pressInCountdown.current = false }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', cursor: 'pointer' }}
    >
      <div style={section}>
        <div style={title}>游戏时长</div>
        <div style={time}>{gameState === 0 ? '00:00:00' : formatted((now - st.current.gameStartTime) / 1000)}</div>
      </div>
      <div style={section}>
        {night ? (
          <>
            <div style={title}>夜晚时长</div>
            <div style={time}>{formatted((now - st.current.nightTimeStart) / 1000)}</div>
          </>
        ) : gameState === 2 ? (
          <>
            <div style={title}>白天时长</div>
            <div style={time}>{formatted((now - st.current.dayTimeStart) / 1000)}</div>
          </>
        ) : null}
      </div>
      <div ref={countdownRef} style={section} onPointerDownCapture={() => { pressInCountdown.current = true }}>
        <div style={title}>{countdownSeconds > 0 ? '倒计时' : '计时器'}</div>
        {gameState === 0 ? (
          <div style={time}>00:00:00</div>
        ) : (
          <div style={{
            ...time, color: timeUp ? '#fff' : 'var(--ink)', padding: '0 4px', borderRadius: 6,
            background: timeUp && flash ? 'var(--demon)' : 'transparent',
          }}>{formatted(timerDisplay)}</div>
        )}
      </div>
    </div>
  )
}
