// 白天的提名、投票、处决记录，对应 iPad 版 SubViews/voting/VotingView.swift
// 提名、投票的进度存在组件自己的 state 里（iPad 版的 @State），切页签不会丢，入夜这个面板换掉后清空
import { useState } from 'react'
import { useGame } from '../game/store'
import { team2Int } from '../game/loadScript'
import { makeLog } from '../game/log'
import { isPlayerTeam } from '../game/teams'
import { useSettings } from '../settings/store'
import { mono } from '../ui/kit'
import { needsCareForBeingNominated, needsCareForNomination } from './care'
import { LabeledDivider, ScrollColumn, TabCell } from './common'
import { circleStroke, edgeBorder } from './style'

/** 说书人在提名里用 21，特殊票：21 说书人，22–24 正票，25–27 负票 */
const STORYTELLER = 21
const ease = 'opacity .3s ease-in-out, transform .3s ease-in-out'

function bgColor(team: string, hideTeamColors: boolean) {
  if (hideTeamColors && isPlayerTeam(team)) return 'var(--neutralTeam)'
  switch (team) {
    case 'townsfolk': return 'var(--townsfolk)'
    case 'outsider': return 'var(--outsider)'
    case 'minion': return 'var(--minion)'
    case 'demon': return 'var(--demon)'
    case 'traveler': return 'var(--traveler)'
    default: return 'var(--mainbg)'
  }
}

function fgColor(team: string) {
  switch (team) {
    case 'townsfolk': case 'outsider': case 'traveler': return 'var(--goodTextBg)'
    case 'minion': case 'demon': return 'var(--evilTextBg)'
    default: return 'var(--ink)'
  }
}

const gridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', columnGap: 10, rowGap: 20,
  width: '100%', padding: '0 5px',
}

/** 圆形号码（40×40），外面一层负责缩放、透明度和点击 */
function Seat({ label, bg, fg, outlined, scale, opacity = 1, rings, onTap }: {
  label: string
  bg?: string
  fg?: string
  outlined?: boolean
  scale: number
  opacity?: number
  /** 提名相关角色外面扩散的波纹颜色 */
  rings?: string
  onTap: () => void
}) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', justifyContent: 'center', cursor: 'pointer',
        transform: `scale(${scale})`, opacity, transition: ease,
      }}
    >
      <div style={{
        position: 'relative', width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...mono(20, 700), lineHeight: 1,
        background: bg, color: fg ?? 'var(--ink)',
        boxShadow: outlined ? circleStroke(2) : undefined,
      }}>
        {label}
        {rings ? [0, 1, 2].map((ring) => (
          <div key={ring} style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
            boxShadow: circleStroke(4, rings),
            animation: `st-nominate-ring 2s ease-out ${ring * 0.5}s infinite backwards`,
          }} />
        )) : null}
      </div>
    </div>
  )
}

function ActionButton({ title, onTap, style }: { title: string; onTap: () => void; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', ...style }}>
      <button
        onClick={onTap}
        style={{
          ...mono(20, 700), lineHeight: 1.2, padding: '5px 10px', color: 'var(--ink)',
          borderRadius: 10, boxShadow: 'inset 0 0 0 1px var(--ink), 0 0 0 1px var(--ink)',
        }}
      >{title}</button>
    </div>
  )
}

export function VotingView() {
  const [nominationPlayerIndex, setNominationPlayerIndex] = useState<number[]>([]) // 提名过的人
  const [executionPlayerIndex, setExecutionPlayerIndex] = useState<number[]>([]) // 被提名过的人
  const [executionVoteCount, setExecutionVoteCount] = useState<number[][]>([]) // 每次投票的人
  const [nominatorIndex, setNominatorIndex] = useState(-1)
  const [nominatedIndex, setNominatedIndex] = useState(-1)
  const [nominationVotes, setNominationVotes] = useState<number[]>([])
  const [aliveCountAtVote, setAliveCountAtVote] = useState<number[]>([])
  const [playerCountAtVote, setPlayerCountAtVote] = useState<number[]>([])

  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const playerCount = useGame((s) => s.playerCount)
  const aliveCount = useGame((s) => s.aliveCount)
  const playersIsAlive = useGame((s) => s.playersIsAlive)
  const playersHasDeathVote = useGame((s) => s.playersHasDeathVote)
  const votingPhase = useGame((s) => s.votingPhase)
  const nominationPhase = useGame((s) => s.nominationPhase)
  const set = useGame((s) => s.set)
  const hideTeamColors = useSettings((s) => s.hideTeamColors)

  const teamOf = (i: number) => playersAssignedCharacters[i]?.team ?? ''
  const toggleVote = (v: number) =>
    setNominationVotes((votes) => (votes.includes(v) ? votes.filter((x) => x !== v) : [...votes, v]))

  // ——— 提名 ———
  const nominationGrid = (nominated: boolean) => {
    const done = nominationPhase === 0 ? nominationPlayerIndex : executionPlayerIndex
    const current = nominationPhase === 0 ? nominatorIndex : nominatedIndex
    const indices = Array.from({ length: playerCount + 1 }, (_, i) => i).filter((i) => done.includes(i) === nominated)
    return (
      <div style={{ ...gridStyle, padding: '10px 5px' }}>
        {indices.map((index) => {
          const tap = () => {
            const v = index < playerCount ? index : STORYTELLER
            if (nominationPhase === 0) setNominatorIndex(v)
            else setNominatedIndex(v)
          }
          if (index < playerCount) {
            const character = playersAssignedCharacters[index]
            const team = character?.team ?? ''
            const bg = bgColor(team, hideTeamColors)
            const care = character && ((nominationPhase === 1 && needsCareForBeingNominated(character)) || (nominationPhase === 0 && needsCareForNomination(character)))
            return (
              <Seat
                key={index} label={`${index + 1}`} bg={bg} fg={fgColor(team)}
                scale={index === current ? 1.2 : 1} opacity={playersIsAlive[index] ? 1 : 0.5}
                rings={care ? bg : undefined} onTap={tap}
              />
            )
          }
          return <Seat key={index} label="说" outlined scale={current === STORYTELLER ? 1.2 : 1} onTap={tap} />
        })}
      </div>
    )
  }

  // ——— 投票 ———
  const isTravelerNominee = nominatedIndex >= 0 && nominatedIndex < playerCount && teamOf(nominatedIndex) === 'traveler'
  const voteSeat = (index: number, dimUnselected: boolean) => {
    const team = teamOf(index)
    const selected = nominationVotes.includes(index)
    return (
      <Seat
        key={index} label={`${index + 1}`} bg={bgColor(team, hideTeamColors)} fg={fgColor(team)}
        scale={selected ? 1.2 : 1} opacity={dimUnselected && !selected ? 0.5 : 1} onTap={() => toggleVote(index)}
      />
    )
  }
  const seats = Array.from({ length: playerCount }, (_, i) => i)

  const submitVote = () => {
    const s = useGame.getState()
    const pc = s.playerCount
    const chars = s.playersAssignedCharacters
    const nameOf = (i: number) => chars[i]?.name ?? ''
    const teamIdOf = (i: number) => team2Int(chars[i]?.team ?? '')
    const votePlayerNumbers = nominationVotes.map((v) => (v < pc ? v + 1 : 21))
    const votePlayerCharacters = nominationVotes.map((v) => (v < pc ? nameOf(v) : v === 21 ? '说' : v < 25 ? '正' : '负'))
    const votePlayerTeams = nominationVotes.map((v) => (v < pc ? teamIdOf(v) : 5))
    setNominationPlayerIndex((l) => [...l, nominatorIndex]) // 提名过的人不能再提名
    setExecutionPlayerIndex((l) => [...l, nominatedIndex])
    setExecutionVoteCount((l) => [...l, nominationVotes])
    setAliveCountAtVote((l) => [...l, s.aliveCount])
    setPlayerCountAtVote((l) => [...l, pc])
    const nominatorNum = nominatorIndex < pc ? nominatorIndex + 1 : 21
    const nominatedNum = nominatedIndex < pc ? nominatedIndex + 1 : 21
    const nominatorTeam = nominatorIndex < pc ? teamIdOf(nominatorIndex) : 5
    const nominatedTeam = nominatedIndex < pc ? teamIdOf(nominatedIndex) : 5
    const nominatorCharacter = nominatorIndex < pc ? nameOf(nominatorIndex) : '说书人'
    const nominatedCharacter = nominatedIndex < pc ? nameOf(nominatedIndex) : '说书人'
    const logs = [
      makeLog({
        message: '', messager: nominatorNum, source: '', type: 4, characterName: nominatorCharacter,
        playerNumbers: [nominatorNum, nominatedNum], playerCharacters: [nominatorCharacter, nominatedCharacter],
        playerTeams: [nominatorTeam, nominatedTeam],
      }),
      makeLog({
        message: '', messager: nominatorNum, source: '', type: 5, characterName: nominatorCharacter,
        playerNumbers: votePlayerNumbers, playerCharacters: votePlayerCharacters, playerTeams: votePlayerTeams,
      }),
    ]
    // 流放旅行者不消耗死人的票
    let deathVotes = s.playersHasDeathVote
    if (!(nominatedIndex >= 0 && nominatedIndex < chars.length && chars[nominatedIndex].team === 'traveler')) {
      deathVotes = [...deathVotes]
      for (const vote of nominationVotes) {
        if (vote < s.playersIsAlive.length && !s.playersIsAlive[vote]) deathVotes[vote] = false
      }
    }
    setNominatedIndex(-1)
    setNominatorIndex(-1)
    setNominationVotes([])
    s.set({ allLogs: [...s.allLogs, ...logs], playersHasDeathVote: deathVotes, votingPhase: 2 })
  }

  let body: React.ReactNode
  if (votingPhase === 0) {
    body = (
      <>
        <ScrollColumn>
          <div style={{ ...mono(25, 700), paddingTop: 10 }}>{nominationPhase === 0 ? '选择提名者' : '选择被提名者'}</div>
          <LabeledDivider title={nominationPhase === 0 ? '未提名' : '未被提'} style={{ padding: '10px 0' }} />
          {nominationGrid(false)}
          <LabeledDivider title={nominationPhase === 0 ? '已提名' : '已被提'} style={{ padding: '10px 0' }} />
          {nominationGrid(true)}
        </ScrollColumn>
        <div style={{ display: 'flex', paddingBottom: 10, justifyContent: 'center' }}>
          {nominationPhase === 0 ? (
            <ActionButton title="确认" onTap={() => { if (nominatorIndex !== -1) set({ nominationPhase: 1 }) }} />
          ) : (
            <>
              <ActionButton title="返回" style={{ flex: 1 }} onTap={() => set({ nominationPhase: 0 })} />
              <ActionButton
                title="确认" style={{ flex: 1 }}
                onTap={() => set(nominatedIndex !== -1 ? { nominationPhase: 0, votingPhase: 1 } : { nominationPhase: 0 })}
              />
            </>
          )}
        </div>
      </>
    )
  } else if (votingPhase === 1) {
    const nominatorText = nominatorIndex < playerCount ? `${nominatorIndex + 1}` : '说'
    const nominatedText = nominatedIndex < playerCount ? `${nominatedIndex + 1}` : '说'
    const neededVotes = Math.ceil(aliveCount / 2)
    const liveCount = nominationVotes.filter((v) => v < 25).length - nominationVotes.filter((v) => v >= 25).length
    body = (
      <>
        <ScrollColumn>
          <div style={{ ...mono(25, 700), paddingTop: 10, textAlign: 'center' }}>
            {isTravelerNominee
              ? `${nominatorText}流放${nominatedText}，${Math.ceil(playersAssignedCharacters.length / 2)}票过半`
              : `${nominatorText}提${nominatedText}，${neededVotes}票过半`}
          </div>
          {nominatedIndex >= 0 && nominatedIndex < playerCount && playerCount > 0 ? (
            // 投票从被提名者顺时针的下一位开始；后半句是实时票数，点一个投票的人就变
            <div style={{ ...mono(20, 600), color: 'color-mix(in srgb, var(--ink) 70%, transparent)', textAlign: 'center' }}>
              {`从${(nominatedIndex + 1) % playerCount + 1}号开始投票，当前${liveCount}票`}
            </div>
          ) : null}
          {isTravelerNominee ? (
            <>
              <LabeledDivider title="玩家" />
              <div style={gridStyle}>{seats.map((i) => voteSeat(i, false))}</div>
            </>
          ) : (
            <>
              <LabeledDivider title="存活" />
              <div style={gridStyle}>{seats.filter((i) => playersIsAlive[i]).map((i) => voteSeat(i, true))}</div>
              <LabeledDivider title="死亡" />
              <div style={gridStyle}>{seats.filter((i) => !playersIsAlive[i] && playersHasDeathVote[i]).map((i) => voteSeat(i, true))}</div>
              <LabeledDivider title="无票" />
              <div style={gridStyle}>{seats.filter((i) => !playersIsAlive[i] && !playersHasDeathVote[i]).map((i) => voteSeat(i, true))}</div>
              <LabeledDivider title="特殊" />
              <div style={{ ...gridStyle, paddingBottom: 20 }}>
                {Array.from({ length: 7 }, (_, i) => 21 + i).map((v) => {
                  const selected = nominationVotes.includes(v)
                  return (
                    <Seat
                      key={v} label={v === 21 ? '说' : v < 25 ? '票' : '负'} outlined
                      scale={selected ? 1.2 : 1} opacity={selected ? 1 : 0.5} onTap={() => toggleVote(v)}
                    />
                  )
                })}
              </div>
            </>
          )}
        </ScrollColumn>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ActionButton title="投票" onTap={submitVote} />
        </div>
      </>
    )
  } else {
    body = (
      <ScrollColumn>
        <div style={{ height: 10, flexShrink: 0 }} />
        {executionPlayerIndex.map((nominee, index) => {
          const voteCount = executionVoteCount[index]
          const alive = aliveCountAtVote[index]
          const players = playerCountAtVote[index]
          const totalVotes = voteCount.filter((v) => v < 25).length - voteCount.filter((v) => v >= 25).length
          const nominator = nominationPlayerIndex[index]
          const nominationText = nominator < 20 ? `${nominator + 1}` : '说书人'
          const nominatedText = nominee < 20 ? `${nominee + 1}` : '说书人'
          const isTraveler = nominee > 20 ? false : (nominee < playersAssignedCharacters.length && playersAssignedCharacters[nominee]?.team === 'traveler')
          const over = totalVotes >= alive / 2
          return (
            <div key={index} style={{ width: '100%', padding: '0 5px' }}>
              <div style={{
                position: 'relative', borderRadius: 10, overflow: 'hidden', isolation: 'isolate', background: 'var(--mainbg)',
                padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={mono(20, 700)}>{`${nominationText}${isTraveler ? '流放' : '提名'}${nominatedText}`}</div>
                  <div style={{ flex: 1 }} />
                  <div style={mono(15, 600)}>{`${totalVotes} / ${alive} / ${players}`}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 1 }}>
                  {voteCount.map((voter) => (
                    <div key={voter} style={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...mono(15, 600), lineHeight: 1, boxShadow: circleStroke(2),
                    }}>
                      {voter < 20 ? `${voter + 1}` : voter === 21 ? '说' : voter < 25 ? '票' : '负'}
                    </div>
                  ))}
                </div>
                {over ? <div style={{ position: 'absolute', inset: 0, background: '#fff', mixBlendMode: 'difference', pointerEvents: 'none' }} /> : null}
              </div>
            </div>
          )
        })}
      </ScrollColumn>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', width: '100%', lineHeight: 1.2 }}>
      {body}
      <div style={{ display: 'flex' }}>
        <TabCell title="提名" active={votingPhase === 0} border={edgeBorder([3, ['top']], [1.5, ['trailing']])} onTap={() => set({ votingPhase: 0 })} />
        <TabCell title="投票" active={votingPhase === 1} border={edgeBorder([3, ['top']], [1.5, ['trailing', 'leading']])} />
        <TabCell title="处决" active={votingPhase === 2} border={edgeBorder([3, ['top']], [1.5, ['leading']])} onTap={() => set({ votingPhase: 2 })} />
      </div>
    </div>
  )
}
