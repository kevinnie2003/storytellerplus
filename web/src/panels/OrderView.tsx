// 夜晚唤醒顺序，对应 iPad 版 SubViews/OrderView.swift
import { useGame } from '../game/store'
import type { Character, OrderInfo } from '../game/types'
import { demonInfo, minionInfo } from '../game/builtins'
import { team2Int } from '../game/loadScript'
import { makeLog } from '../game/log'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'
import { usePress } from '../ui/gestures'
import { ScrollColumn, TabCell } from './common'
import { edgeBorder } from './style'
import { useCompact } from '../ui/compact'
import { OrderActions } from '../online/OrderActions'

const ease = 'opacity .3s ease-in-out, transform .3s ease-in-out'
// 提示文字收 0.3 字距：iPad 上 15 号字的汉字约 14.7 宽（系统字体的 tracking），一行能多排一个字

function wake(info: OrderInfo) {
  const s = useGame.getState()
  s.set({
    allLogs: [...s.allLogs, makeLog({
      message: info.reminder, messager: info.playerID + 1, source: '', type: 2,
      characterName: info.characterName, playerTeams: [team2Int(info.team)],
    })],
    currentlyAwakePlayerIndex: info.playerID,
  })
}

function NightRow({ info, isAlive, opacity, scale }: { info: OrderInfo; isAlive: boolean; opacity: number; scale: number }) {
  // 手机上点一下就标成当前唤醒的角色（大屏是双击）
  const compact = useCompact()
  const press = usePress(compact ? { onTap: () => wake(info) } : { onDoubleTap: () => wake(info) })
  const idText = info.playerID >= 0 ? `${info.playerID + 1}号` : info.playerID <= -4 ? '不在场' : ''
  return (
    <div {...press} style={{ width: '100%', opacity, transform: `scale(${scale})`, transition: ease }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 0' }}>
        <CachedImage url={info.imageURL} size={40} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ ...rounded(20, 700), whiteSpace: 'pre-wrap' }}>{`${idText}${isAlive ? '' : '  已死亡'}  ${info.characterName}`}</div>
          <div style={{ ...rounded(15, 600), letterSpacing: -0.3 }}>{info.reminder}</div>
          {/* 说书人联机：开着房间时，发信息、让他选 */}
          <OrderActions info={info} />
        </div>
      </div>
    </div>
  )
}

/** “不需要唤醒”的那一段：iPad 版只把文字那一块变淡、缩小，双击也只在文字上 */
function IdleRow({ info, isAlive, awake }: { info: OrderInfo; isAlive: boolean; awake: boolean }) {
  // 手机上点一下就标成当前唤醒的角色（大屏是双击）
  const compact = useCompact()
  const press = usePress(compact ? { onTap: () => wake(info) } : { onDoubleTap: () => wake(info) })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 0' }}>
      <CachedImage url={info.imageURL} size={40} />
      <div {...press} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0,
        opacity: awake ? 1 : 0.5, transform: `scale(${awake ? 1 : 0.95})`, transition: ease,
      }}>
        <div style={{ ...rounded(20, 700), whiteSpace: 'pre-wrap' }}>
          {`${info.playerID >= 0 ? `${info.playerID + 1}号${isAlive ? '' : '  已死亡'}` : '不在场'}  ${info.characterName}`}
        </div>
        <div style={{ ...rounded(15, 600), letterSpacing: -0.3 }}>{info.reminder}</div>
      </div>
    </div>
  )
}

const Bar = () => <div style={{ width: '100%', padding: '0 10px' }}><div style={{ height: 3, background: 'var(--ink)' }} /></div>

export function OrderView() {
  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const playableCharacters = useGame((s) => s.playableCharacters)
  const playersIsAlive = useGame((s) => s.playersIsAlive)
  const firstNightOrder = useGame((s) => s.firstNightOrder)
  const currentlyAwakePlayerIndex = useGame((s) => s.currentlyAwakePlayerIndex)
  const set = useGame((s) => s.set)

  const assignedNames = new Set(playersAssignedCharacters.map((c) => c.name))
  const unassignedCharacters = playableCharacters.filter((c) => !assignedNames.has(c.name) && c.team !== 'traveler')
  const unassignedCharacterNames = new Set(unassignedCharacters.map((c) => c.name))

  const order = (c: Character) => (firstNightOrder ? c.firstNightOrder : c.otherNightOrder)
  const toInfo = (c: Character, playerID: number, reminder: string): OrderInfo => ({
    order: order(c), reminder, playerID, imageURL: c.imageURL, characterName: c.name, team: c.team,
  })
  const nightReminder = (c: Character) => (firstNightOrder ? c.firstNightReminder : c.otherNightReminder)

  // enumerated() 之后再 filter，所以序号是过滤前的下标
  const combined: OrderInfo[] = [
    ...playersAssignedCharacters.map((c, i) => [c, i] as const).filter(([c]) => order(c) !== 0).map(([c, i]) => toInfo(c, i, nightReminder(c))),
    ...(firstNightOrder ? [minionInfo, demonInfo] : []),
    ...unassignedCharacters.map((c, i) => [c, i] as const).filter(([c]) => order(c) !== 0).map(([c, i]) => toInfo(c, -4 - i, nightReminder(c))),
  ]
  // Swift 的 sorted 不保证稳定，这里用稳定排序
  const sortedNight = [...combined].sort((a, b) => a.order - b.order)
  const sortedNightOtherCharacters: OrderInfo[] = [
    ...playersAssignedCharacters.map((c, i) => [c, i] as const).filter(([c]) => order(c) === 0).map(([c, i]) => toInfo(c, i, c.ability)),
    ...unassignedCharacters.map((c, i) => [c, i] as const).filter(([c]) => order(c) === 0).map(([c, i]) => toInfo(c, -4 - i, c.ability)),
  ]
  const aliveOf = (id: number) => (id >= 0 ? (id < playersIsAlive.length ? playersIsAlive[id] : false) : true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', width: '100%', lineHeight: 1.2 }}>
      <div style={{ display: 'flex' }}>
        <TabCell
          title="第一晚" font="rounded" active={firstNightOrder}
          border={edgeBorder([3, ['bottom']], [1.5, ['trailing']])}
          onTap={() => set({ currentlyAwakePlayerIndex: -666, firstNightOrder: true })}
        />
        <TabCell
          title="其他晚" font="rounded" active={!firstNightOrder}
          border={edgeBorder([3, ['bottom']], [1.5, ['leading']])}
          onTap={() => set({ currentlyAwakePlayerIndex: -666, firstNightOrder: false })}
        />
      </div>
      <ScrollColumn style={{ marginBottom: 10 }}>
        {sortedNight.map((info, index) => {
          const awake = info.playerID === currentlyAwakePlayerIndex
          return (
            <NightRow
              key={index}
              info={info}
              isAlive={aliveOf(info.playerID)}
              opacity={awake ? 1 : unassignedCharacterNames.has(info.characterName) ? 0.3 : 0.65}
              scale={awake ? 1 : 0.95}
            />
          )
        })}
        <Bar />
        <div style={rounded(20, 700)}>不需要唤醒</div>
        <Bar />
        {sortedNightOtherCharacters.map((info, index) => (
          <IdleRow key={index} info={info} isAlive={aliveOf(info.playerID)} awake={info.playerID === currentlyAwakePlayerIndex} />
        ))}
      </ScrollColumn>
    </div>
  )
}
