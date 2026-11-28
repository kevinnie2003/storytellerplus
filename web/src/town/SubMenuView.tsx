// 齿轮面板：玩家人数、随机分配、开始游戏、隐藏阵营颜色、存档、设置。对应 iPad 版 SubViews/menus/SubMenuView.swift
import { useGame, setGame } from '../game/store'
import { useSettings, settings } from '../settings/store'
import { addPlayer, canRemoveLastPlayer, randomAssign, removeLastPlayer, startGame } from '../game/actions'
import { SFIcon } from '../ui/SFIcon'
import { rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { useHost } from '../net/host'

function Row({ title, icon, onClick }: { title: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', color: 'var(--ink)', width: '100%', textAlign: 'left' }}
    >
      <span style={{ width: 24, display: 'flex', justifyContent: 'center' }}><SFIcon name={icon} size={20} weight="bold" /></span>
      <span style={{ ...rounded(18, 700), lineHeight: 1.2 }}>{title}</span>
    </button>
  )
}

const stepButton = (disabled: boolean): React.CSSProperties => ({
  width: 64, height: 52, borderRadius: 12, border: '2.5px solid var(--ink)', color: 'var(--ink)',
  background: 'color-mix(in srgb, var(--mainbg) 60%, transparent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1,
  cursor: disabled ? 'default' : 'pointer',
})

// SwiftUI 的 Divider 是一像素（iPad 上 0.5pt）
const Divider = () => <div style={{ height: 0.5, background: 'var(--ink)', flexShrink: 0 }} />

export function SubMenuView() {
  const playerCount = useGame((s) => s.playerCount)
  const gameState = useGame((s) => s.gameState)
  const seatCount = useGame((s) => s.playersAssignedCharacters.length)
  const canRemove = useGame((s) => canRemoveLastPlayer(s))
  const hideTeamColors = useSettings((s) => s.hideTeamColors)
  const close = () => setGame({ showMenu: false })
  const compact = useCompact()
  const roomCode = useHost((s) => s.code)

  return (
    <>
      {/* 点面板外面收起；整层往右挪了 65，左边的图标栏还能点 */}
      <div onClick={close} style={{ position: 'fixed', top: 0, bottom: 0, left: compact ? 0 : 65, right: 0 }} />
      <div style={compact ? {
        // 手机版：从右上角的齿轮弹下来
        position: 'fixed', right: 10, top: 'calc(env(safe-area-inset-top) + 58px)', width: 'min(280px, calc(100vw - 20px))',
        background: 'var(--paper)', borderRadius: 16, outline: '3px solid var(--ink)', outlineOffset: -1.5, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', transformOrigin: 'top right', animation: 'st-submenu-in .2s ease-in-out',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1,
      } : {
        // iPad 的描边是 overlay 画在边上的，不占里面的位置；用 outline 往里收一半，里面的内容才和 iPad 一样宽
        position: 'absolute', left: 65, bottom: 70, width: 280, background: 'var(--paper)', borderRadius: 16,
        outline: '3px solid var(--ink)', outlineOffset: -1.5, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transformOrigin: 'bottom left', animation: 'st-submenu-in .2s ease-in-out',
      }}>
        <div data-tour="gear.players" style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 8px 0', color: 'var(--ink)' }}>
          <span style={{ ...rounded(18, 700), paddingLeft: 14, lineHeight: 1.2 }}>玩家</span>
          <div style={{ flex: 1 }} />
          <button onClick={removeLastPlayer} disabled={!canRemove} style={stepButton(!canRemove)}>
            <SFIcon name="minus" size={30} weight="black" />
          </button>
          <span style={{ ...rounded(24, 900), minWidth: 44, textAlign: 'center', lineHeight: 1.2 }}>{playerCount}</span>
          <button onClick={addPlayer} disabled={playerCount >= 20} style={stepButton(playerCount >= 20)}>
            <SFIcon name="plus" size={30} weight="black" />
          </button>
        </div>
        {gameState === 0 ? (
          <>
            <Divider />
            <Row title="随机分配角色" icon="shuffle" onClick={randomAssign} />
            <button
              data-tour="gear.start"
              onClick={startGame}
              disabled={seatCount < 5}
              style={{ padding: '0 6px 6px', opacity: seatCount < 5 ? 0.4 : 1, cursor: seatCount < 5 ? 'default' : 'pointer' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', color: 'var(--paper)',
                background: 'var(--ink)', borderRadius: 10,
              }}>
                <span style={{ width: 24, display: 'flex', justifyContent: 'center' }}><SFIcon name="play.fill" size={20} weight="bold" /></span>
                <span style={{ ...rounded(18, 900), lineHeight: 1.2 }}>开始游戏</span>
              </div>
            </button>
          </>
        ) : null}
        <Divider />
        <Row
          title={hideTeamColors ? '显示阵营颜色' : '隐藏阵营颜色'}
          icon={hideTeamColors ? 'eye' : 'eye.slash'}
          onClick={() => settings().set('hideTeamColors', !hideTeamColors)}
        />
        <Row title={roomCode ? `说书人普肉 · ${roomCode}` : '说书人普肉（联机）'} icon="person.2" onClick={() => { setGame({ showMenu: false }); useHost.setState({ showPanel: true }) }} />
        <Row title="存档" icon="tray.full" onClick={() => setGame({ showMenu: false, showArchive: true })} />
        <Row title="设置" icon="gearshape" onClick={() => setGame({ showMenu: false, showSettings: true })} />
      </div>
    </>
  )
}
