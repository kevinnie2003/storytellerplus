// 左边的图标栏，对应 iPad 版 SubViews/menus/MenuView.swift
import { useGame, setGame } from '../game/store'
import { goDay, goNight } from '../game/actions'
import { SFIcon } from '../ui/SFIcon'

function MenuButton({ icon, tour, onClick, color, style }: {
  icon: string
  tour: string
  onClick: () => void
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      data-tour={tour}
      onClick={onClick}
      style={{ width: 64, color: color ?? 'var(--ink)', display: 'flex', justifyContent: 'center', flexShrink: 0, ...style }}
    >
      <SFIcon name={icon} size={30} />
    </button>
  )
}

export function MenuView({ onExit }: { onExit: () => void }) {
  const gameState = useGame((s) => s.gameState)
  const night = gameState === 1 || gameState === 3
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, width: 70, height: '100%',
      background: 'var(--mainbg)', borderRadius: 10, outline: '3px solid var(--ink)', outlineOffset: -1.5,
    }}>
      <MenuButton icon={night ? 'moon.fill' : 'moon'} tour="menu.moon" onClick={goNight} style={{ marginTop: 30, marginBottom: 35 }} />
      <MenuButton icon={gameState === 2 ? 'sun.min.fill' : 'sun.min'} tour="menu.sun" onClick={goDay} />
      <div style={{ flex: 1 }} />
      <MenuButton icon="sparkles" tour="menu.ai" onClick={() => setGame({ showAIAdvisor: true })} style={{ marginBottom: 35 }} />
      <MenuButton icon="person.2.crop.square.stack" tour="menu.infos" onClick={() => setGame({ showAllCharacterInfos: true })} style={{ marginBottom: 35 }} />
      <MenuButton icon="list.bullet.clipboard" tour="menu.log" onClick={() => setGame({ showConversation: true })} style={{ marginBottom: 35 }} />
      <MenuButton icon="rectangle.and.pencil.and.ellipsis" tour="menu.notepad" onClick={() => setGame({ showNotepad: true })} style={{ marginBottom: 35 }} />
      <MenuButton icon="gearshape" tour="menu.gear" onClick={() => setGame((s) => ({ showMenu: !s.showMenu }))} style={{ marginBottom: 35 }} />
      <MenuButton icon="x.circle" tour="menu.exit" onClick={onExit} color="#ff3b30" style={{ marginBottom: 30 }} />
    </div>
  )
}
