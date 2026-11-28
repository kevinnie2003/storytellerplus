// 手机版小镇：顶栏、状态条、两列卡片、底部的流程面板和导航栏。
// 大屏的小镇见 screens/TownScreen.tsx，两边共用卡片、夜晚顺序、投票这些组件
import { useEffect, useRef } from 'react'
import { setGame, useGame } from '../game/store'
import { goDay, goNight } from '../game/actions'
import { useSettings } from '../settings/store'
import { SFIcon } from '../ui/SFIcon'
import { mono, rounded } from '../ui/kit'
import { PlayersView } from '../town/PlayersView'
import { TimerView } from '../town/TimerView'
import { UndoToast } from '../town/UndoToast'
import { OrderView } from '../panels/OrderView'
import { VotingView } from '../panels/VotingView'
import { ExtraSetup } from '../panels/ExtraSetup'
import { InfoPage } from './InfoPage'
import { setMobileUI, useMobileUI } from './uiStore'
import { phaseLabel } from '../game/phase'

/** 第几天、第几夜 */
function usePhaseLabel() {
  return useGame((s) => phaseLabel(s.gameState, s.allLogs))
}

function IconButton({ icon, onClick, color, label, tour, filled }: {
  icon: string
  onClick: () => void
  color?: string
  label: string
  tour?: string
  filled?: boolean
}) {
  return (
    <button
      aria-label={label}
      data-tour={tour}
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: filled ? 'var(--mainbg)' : color ?? 'var(--ink)', background: filled ? 'var(--ink)' : 'transparent',
      }}
    >
      <SFIcon name={icon} size={26} />
    </button>
  )
}

const setupButton: React.CSSProperties = {
  ...rounded(17, 700), color: 'var(--ink)', padding: '13px 0', flex: '1 1 0', minWidth: 0,
  background: 'var(--mainbg)', borderRadius: 26, outline: '3px solid var(--ink)', outlineOffset: -1.5, textAlign: 'center',
}

/** 底部可以拉起的流程面板：配版时是设置调整，夜里是唤醒顺序，白天是提名投票 */
function PhaseSheet({ expanded, setExpanded }: { expanded: boolean; setExpanded: (v: boolean) => void }) {
  const gameState = useGame((s) => s.gameState)
  const awake = useGame((s) => s.currentlyAwakePlayerIndex)
  const awakeName = useGame((s) => (s.currentlyAwakePlayerIndex >= 0 ? s.playersAssignedCharacters[s.currentlyAwakePlayerIndex]?.name ?? '' : ''))
  const kind = gameState === 0 ? 'setup' : gameState === 1 || gameState === 3 ? 'order' : 'voting'
  const title = kind === 'setup' ? '设置调整' : kind === 'order' ? '夜晚顺序' : '提名投票'
  const hint = kind === 'order'
    ? (awake >= 0 && awakeName ? `当前：${awake + 1}号 ${awakeName}` : '点一行标成当前唤醒')
    : kind === 'voting' ? '提名、投票、处决' : '会改配版的角色'
  return (
    <div
      data-tour="rightPanel"
      style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--mainbg)',
        borderTop: '3px solid var(--ink)', borderRadius: '18px 18px 0 0', marginTop: -6,
        height: expanded ? '52%' : 52, transition: 'height .28s cubic-bezier(.2,.8,.2,1)', overflow: 'hidden',
        boxShadow: '0 -4px 14px rgba(0,0,0,0.12)', position: 'relative', zIndex: 2,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 49, flexShrink: 0, color: 'var(--ink)', width: '100%', textAlign: 'left' }}
      >
        <span style={{ ...rounded(18, 900), lineHeight: 1.2 }}>{title}</span>
        <span style={{ ...rounded(14, 600), opacity: 0.65, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{hint}</span>
        <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .28s', display: 'flex' }}>
          <SFIcon name="chevron.up" size={22} weight="bold" />
        </span>
      </button>
      {/* 内容一直挂着，收起来也不丢投票进度 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 6px' }}>
        <div key={kind} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'st-fade .3s ease-in-out' }}>
          {kind === 'setup' ? <ExtraSetup /> : kind === 'order' ? <OrderView /> : <VotingView />}
        </div>
      </div>
    </div>
  )
}

function TabBar({ onTown, onInfo }: { onTown: () => void; onInfo: () => void }) {
  const items: { icon: string; label: string; tour: string; onClick: () => void }[] = [
    { icon: 'person.2', label: '小镇', tour: 'mobile.town', onClick: onTown },
    { icon: 'info.circle', label: '信息', tour: 'mobile.info', onClick: onInfo },
    { icon: 'rectangle.and.pencil.and.ellipsis', label: '记事本', tour: 'menu.notepad', onClick: () => setGame({ showNotepad: true }) },
    { icon: 'list.bullet.clipboard', label: '记录', tour: 'menu.log', onClick: () => setGame({ showConversation: true }) },
    { icon: 'sparkles', label: 'AI', tour: 'menu.ai', onClick: () => setGame({ showAIAdvisor: true }) },
  ]
  return (
    <div style={{
      display: 'flex', flexShrink: 0, background: 'var(--mainbg)', borderTop: '2px solid var(--ink)',
      paddingBottom: 'env(safe-area-inset-bottom)', position: 'relative', zIndex: 3,
    }}>
      {items.map((it) => (
        <button
          key={it.label}
          data-tour={it.tour}
          onClick={it.onClick}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 0 6px', color: 'var(--ink)' }}
        >
          <SFIcon name={it.icon} size={24} />
          <span style={{ ...rounded(11, 700), lineHeight: 1.2 }}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

export function MobileTown({ onExit }: { onExit: () => void }) {
  const gameState = useGame((s) => s.gameState)
  const playName = useGame((s) => s.playName)
  const aliveCount = useGame((s) => s.aliveCount)
  const playerCount = useGame((s) => s.playerCount)
  const demo = useGame((s) => s.gameID === 'demo')
  const circleLayout = useSettings((s) => s.circleLayout)
  const phase = usePhaseLabel()
  const night = gameState === 1 || gameState === 3
  const expanded = useMobileUI((s) => s.sheetExpanded)
  const info = useMobileUI((s) => s.info)
  const setExpanded = (v: boolean) => setMobileUI({ sheetExpanded: v })
  const setInfo = (v: boolean) => setMobileUI({ info: v })
  // 进小镇时：开局后流程面板拉起来，信息页关着
  useEffect(() => { setMobileUI({ sheetExpanded: useGame.getState().gameState !== 0, info: false }) }, [])
  const scroller = useRef<HTMLDivElement>(null)

  // 入夜、天亮时把流程面板拉起来
  const prevState = useRef(gameState)
  useEffect(() => {
    if (prevState.current !== gameState) setMobileUI({ sheetExpanded: gameState !== 0 })
    prevState.current = gameState
  }, [gameState])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* 顶栏：退出、剧本名和第几天、齿轮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 6px 4px', flexShrink: 0, background: 'var(--mainbg)' }}>
        <IconButton icon="x.circle" label="离开小镇" color="#ff3b30" onClick={onExit} tour="menu.exit" />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{ ...rounded(17, 900), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playName || '说书人普拉斯'}</div>
          <div style={{ ...rounded(13, 700), opacity: 0.6 }}>{phase}</div>
        </div>
        <IconButton icon="gearshape" label="齿轮面板" onClick={() => setGame((s) => ({ showMenu: !s.showMenu }))} tour="menu.gear" />
      </div>

      {/* 状态条：昼夜切换、存活、计时 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, margin: '0 10px 6px', padding: '5px 8px', flexShrink: 0,
        background: 'var(--mainbg)', borderRadius: 12, outline: '3px solid var(--ink)', outlineOffset: -1.5,
      }}>
        <div style={{ display: 'flex', borderRadius: 10, outline: '2px solid var(--ink)', outlineOffset: -1, overflow: 'hidden', flexShrink: 0 }}>
          <button
            data-tour="menu.moon" aria-label="入夜" onClick={goNight}
            style={{ width: 40, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: night ? 'var(--ink)' : 'transparent', color: night ? 'var(--mainbg)' : 'var(--ink)' }}
          ><SFIcon name={night ? 'moon.fill' : 'moon'} size={22} /></button>
          <button
            data-tour="menu.sun" aria-label="天亮" onClick={goDay}
            style={{ width: 40, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: gameState === 2 ? 'var(--ink)' : 'transparent', color: gameState === 2 ? 'var(--mainbg)' : 'var(--ink)' }}
          ><SFIcon name={gameState === 2 ? 'sun.min.fill' : 'sun.min'} size={22} /></button>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
          <span style={{ ...rounded(12, 700), opacity: 0.6 }}>存活</span>
          <span style={mono(16, 800)}>{aliveCount}/{playerCount}</span>
        </div>
        <div data-tour="timer"><TimerView compact /></div>
      </div>

      {/* 卡片 */}
      <div
        ref={scroller}
        className="scroll-hidden"
        style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 10px 16px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, filter: circleLayout ? undefined : 'drop-shadow(2px 3px 4px rgba(0,0,0,0.18))' }}>
          <PlayersView numCols={2} forceGrid={demo} />
          {gameState === 0 ? (
            <div data-tour="setup.buttons" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={setupButton} onClick={() => setGame({ showSetup: true })}>说书人配版</button>
                <button style={setupButton} onClick={() => setGame({ openAISetupOnAppear: true, showSetup: true })}>AI配版</button>
              </div>
              <button style={setupButton} onClick={() => setGame({ showAIPostDraw: true })}>AI补完配版</button>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0, height: 0, zIndex: 5 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}><UndoToast /></div>
        </div>
      </div>

      <PhaseSheet expanded={expanded} setExpanded={setExpanded} />
      <TabBar
        onTown={() => { setInfo(false); setExpanded(false); scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
        onInfo={() => setInfo(true)}
      />
      {info ? <InfoPage onClose={() => setInfo(false)} /> : null}
    </div>
  )
}
