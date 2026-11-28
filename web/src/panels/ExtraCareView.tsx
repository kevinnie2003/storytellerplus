// 右栏中间“需要注意”的面板：相克 / 提名 / 被提 / 投票 / 处决 / 圆桌
// 对应 iPad 版 SubViews/extraCare/*.swift
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import type { Character } from '../game/types'
import { isPlayerTeam } from '../game/teams'
import { useSettings } from '../settings/store'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'
import { needsCareForBeingNominated, needsCareForNomination } from './care'
import { IconTextRow, ScrollColumn, SlideSwitch, TabCell } from './common'
import { edgeBorder } from './style'

const fade = 'opacity .3s ease-in-out'

function JinxView() {
  const jinxList = useGame((s) => s.jinxList)
  return (
    <ScrollColumn>
      {jinxList.map((jinx, i) => (
        <IconTextRow key={`${jinx.name}-${i}`} imageURL={jinx.imageURL} showImage={jinx.type !== 0} title={jinx.name} text={jinx.description} />
      ))}
    </ScrollColumn>
  )
}

/** 提名 / 被提 / 投票 / 处决 四个列表：能力里提到这些字眼的在场角色 */
function CareList({ needsCare }: { needsCare: (c: Character) => boolean }) {
  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const playersIsAlive = useGame((s) => s.playersIsAlive)
  return (
    <ScrollColumn>
      {playersAssignedCharacters.map((character, index) => needsCare(character) ? (
        <IconTextRow
          key={index}
          imageURL={character.imageURL}
          title={`${index + 1}号   ${character.name}`}
          text={character.ability}
          style={{ opacity: index >= playersIsAlive.length ? 0.5 : (playersIsAlive[index] ? 1 : 0.5), transition: fade }}
        />
      ) : null)}
    </ScrollColumn>
  )
}

const needsCareForVoting = (c: Character) => c.ability.includes('投票')
const needsCareForExecution = (c: Character) => c.ability.includes('处决')

function circleBg(team: string, hideTeamColors: boolean) {
  if (hideTeamColors && isPlayerTeam(team)) return 'var(--neutralTeam)'
  switch (team) {
    case 'townsfolk': return 'var(--townsfolk)'
    case 'outsider': return 'var(--outsider)'
    case 'minion': return 'var(--minion)'
    case 'demon': return 'var(--demon)'
    case 'traveler': return 'var(--traveler)'
    default: return 'var(--ink)'
  }
}

/** 圆桌：按座位把角色图标摆成一圈，号码在内圈 */
function CircularView() {
  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const playersIsAlive = useGame((s) => s.playersIsAlive)
  const hideTeamColors = useSettings((s) => s.hideTeamColors)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const count = playersAssignedCharacters.length
  const radius = Math.min(size.w, size.h) / 2.5
  const cx = size.w / 2
  const cy = size.h / 2
  const scale = 1 - count * 0.0125
  const move = 'left .3s ease-in-out, top .3s ease-in-out, opacity .3s ease-in-out'

  return (
    <div ref={box} style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      {/* 量出大小之前先不画，不然打开时所有头像会从左上角飞进来 */}
      {size.w > 0 && playersAssignedCharacters.map((c, index) => {
        const angle = (2 * Math.PI / count) * index
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        const xt = cx + radius * Math.cos(angle) * 0.75
        const yt = cy + radius * Math.sin(angle) * 0.75
        const alive = !!playersIsAlive[index]
        return (
          <div key={index}>
            <div style={{
              position: 'absolute', left: xt - 12.5, top: yt - 12.5, width: 25, height: 25, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...rounded(15, 700), lineHeight: 1, color: 'var(--goodTextBg)', background: circleBg(c.team, hideTeamColors),
              transform: `scale(${scale})`, opacity: alive ? 1 : 0.3, transition: move,
            }}>{index + 1}</div>
            <div style={{
              position: 'absolute', left: x - 22.5, top: y - 22.5, width: 45, height: 45,
              transform: `scale(${scale})`, opacity: alive ? 1 : 0.5, transition: move,
            }}>
              <CachedImage url={c.imageURL} size={45} grayscale={hideTeamColors} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ExtraCareView() {
  const votingPhase = useGame((s) => s.votingPhase)
  const nominationPhase = useGame((s) => s.nominationPhase)
  const gameState = useGame((s) => s.gameState)
  // 0 相克 1 提名 2 被提 3 投票 4 处决 5 圆桌
  const [selectedView, setSelectedView] = useState(0)

  // 和 iPad 版的三个 onChange 一样：只在值变化时触发，按 gameState、nominationPhase、votingPhase 的顺序，后面的说了算
  const prev = useRef({ gameState, nominationPhase, votingPhase })
  useEffect(() => {
    const p = prev.current
    let next: number | null = null
    if (p.gameState !== gameState) next = gameState === 2 ? 1 : 0
    if (p.nominationPhase !== nominationPhase) next = nominationPhase === 0 ? 1 : 2
    if (p.votingPhase !== votingPhase) {
      if (votingPhase === 1) next = 3
      else if (votingPhase === 2) next = 4
      else next = nominationPhase === 0 ? 1 : 2
    }
    prev.current = { gameState, nominationPhase, votingPhase }
    if (next !== null) setSelectedView(next)
  }, [gameState, nominationPhase, votingPhase])

  const content = (() => {
    switch (selectedView) {
      case 0: return <JinxView />
      case 1: return <CareList needsCare={needsCareForNomination} />
      case 2: return <CareList needsCare={needsCareForBeingNominated} />
      case 3: return <CareList needsCare={needsCareForVoting} />
      case 4: return <CareList needsCare={needsCareForExecution} />
      default: return <CircularView />
    }
  })()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, height: '100%', width: '100%',
      background: 'var(--mainbg)', lineHeight: 1.2,
    }}>
      <div style={{ display: 'flex' }}>
        <TabCell title="相克" active={selectedView === 0} border={edgeBorder([3, ['bottom']], [1.5, ['trailing']])} onTap={() => setSelectedView(0)} />
        <TabCell title="提名" active={selectedView === 1} border={edgeBorder([3, ['bottom']], [1.5, ['trailing', 'leading']])} onTap={() => setSelectedView(1)} />
        <TabCell title="被提" active={selectedView === 2} border={edgeBorder([3, ['bottom']], [1.5, ['leading']])} onTap={() => setSelectedView(2)} />
      </div>
      <SlideSwitch value={selectedView}>{content}</SlideSwitch>
      <div style={{ display: 'flex' }}>
        <TabCell title="投票" active={selectedView === 3} border={edgeBorder([3, ['top']], [1.5, ['trailing']])} onTap={() => setSelectedView(3)} />
        <TabCell title="处决" active={selectedView === 4} border={edgeBorder([3, ['top']], [1.5, ['leading', 'trailing']])} onTap={() => setSelectedView(4)} />
        <TabCell title="圆桌" active={selectedView === 5} border={edgeBorder([3, ['top']], [1.5, ['leading']])} onTap={() => setSelectedView(5)} />
      </div>
    </div>
  )
}
