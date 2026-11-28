// 选某个阵营要几张牌，对应 SetupCount.swift
import { useGame } from '../game/store'
import { teamCounts } from '../game/builtins'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { phoneHint } from './mobileStyles'
import { setFlow, teamNames, useSetupFlow } from './flowState'

export function SetupCount({ stage }: { stage: number }) {
  const playerCount = useGame((s) => s.playerCount)
  const selectedTeamCounts = useSetupFlow((s) => s.selectedTeamCounts)
  // 跳到最后一步时这一页还在淡出，阶段号会超过 11，要夹住，不然数组越界
  const teamIndex = Math.min(Math.max(Math.floor(stage / 3), 0), 3)
  const teamName = teamNames[teamIndex]
  const teamCount = [...(teamCounts[playerCount] ?? [0, 0, 0, 0, 0])].reverse()
  const change = (delta: number) => {
    const next = [...useSetupFlow.getState().selectedTeamCounts]
    next[teamIndex] = Math.max(next[teamIndex] + delta, 0)
    setFlow({ selectedTeamCounts: next })
  }
  const compact = useCompact()
  if (compact) {
    // 手机：大号的 − 数字 +，居中摆
    const round: React.CSSProperties = {
      width: 64, height: 64, borderRadius: '50%', border: '3.5px solid var(--ink)', background: 'var(--mainbg)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }
    return (
      <div data-tour="setup.count" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '0 20px' }}>
        <div style={rounded(28, 900)}>选择{teamName}数量</div>
        <div style={{ ...rounded(18, 700), opacity: 0.7 }}>应有 {teamCount[teamIndex + 1]} 个{teamName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0' }}>
          <button aria-label="减一" style={round} onClick={() => change(-1)}><SFIcon name="minus" size={30} weight="bold" /></button>
          <div style={{ ...rounded(64, 900), minWidth: 90 }}>{selectedTeamCounts[teamIndex]}</div>
          <button aria-label="加一" style={round} onClick={() => change(1)}><SFIcon name="plus" size={30} weight="bold" /></button>
        </div>
        <div style={phoneHint}>数量只在让玩家自己盲选时用到，不需要就直接点“确认”</div>
      </div>
    )
  }
  const big: React.CSSProperties = { ...rounded(40, 700), color: 'var(--ink)', padding: '10px 20px' }
  return (
    <div data-tour="setup.count" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={rounded(35, 700)}>选择 {teamName} 数量</div>
      <div style={{ ...rounded(30, 700), paddingTop: 20 }}>(应有 {teamCount[teamIndex + 1]} 个 {teamName})</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={big} onClick={() => change(-1)}>-</button>
        <div style={big}>{selectedTeamCounts[teamIndex]}</div>
        <button style={big} onClick={() => change(1)}>+</button>
      </div>
    </div>
  )
}
