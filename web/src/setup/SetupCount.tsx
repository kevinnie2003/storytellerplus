// 选某个阵营要几张牌，对应 SetupCount.swift
import { useGame } from '../game/store'
import { teamCounts } from '../game/builtins'
import { rounded } from '../ui/kit'
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
