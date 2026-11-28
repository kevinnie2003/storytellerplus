// 玩家开抽：左边一排卡背，右边座位表。双击座位选中，长按卡牌给这个座位翻牌；长按座位可以提前定角色。
// 对应 SetupPlayerPick.swift
import { useLayoutEffect, useRef, useState } from 'react'
import type { Character } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { useCompact } from '../ui/compact'
import { usePress } from '../ui/gestures'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { boxButton, cardColorOf, CardBack, CardFront, CardGrid, HFlow, usePresence } from './cards'
import { setFlow, setSelectionState, shuffled, useSetupFlow } from './flowState'
import { MobileBar } from './MobileBar'
import { barButton, phoneHint } from './mobileStyles'
import { SpecialCare } from './SpecialCare'

const ease = '.3s ease-in-out'
const spring = '.35s cubic-bezier(.25,.9,.35,1)'

function PickCard({ character, rotation, dimmed, onLongPress, bare }: {
  character: Character
  rotation: number
  dimmed: boolean
  onLongPress: () => void
  /** 手机上放进 CardGrid，不要外边的留白 */
  bare?: boolean
}) {
  const press = usePress({ onLongPress, longPressSeconds: 0.3 })
  const faceUp = rotation > 90 && rotation < 270
  return (
    <div {...press} style={{ padding: bare ? 0 : '30px 10px', touchAction: 'pan-y' }}>
      <div style={{ position: 'relative', width: 200, height: 300 }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: faceUp ? 1 : 0,
          transform: `perspective(300px) rotateY(${rotation + 180}deg)`, transition: `transform ${ease}, opacity ${ease}`,
        }}>
          <CardFront character={character} cardColor={cardColorOf(character.team)} dim={dimmed ? 0.7 : 1} />
        </div>
        <div style={{
          position: 'absolute', inset: 0, opacity: faceUp ? 0 : 1,
          transform: `perspective(300px) rotateY(${rotation}deg)`, transition: `transform ${ease}, opacity ${ease}`,
        }}>
          <CardBack cardColor="var(--ink)" dim={dimmed ? 0.7 : 1} />
        </div>
      </div>
    </div>
  )
}

function SeatRow({ index, chosen, rowRef, onDoubleTap, onLongPress }: {
  index: number
  chosen: boolean
  rowRef: (el: HTMLDivElement | null) => void
  onDoubleTap: () => void
  onLongPress: () => void
}) {
  const press = usePress({ onDoubleTap, onLongPress, longPressSeconds: 0.3 })
  return (
    <div ref={rowRef} style={{ position: 'relative', padding: '10px 10px' }}>
      <div {...press} style={{ display: 'flex', alignItems: 'center', transform: 'scale(.95)', cursor: 'pointer' }}>
        <div style={{ ...rounded(35, 700), padding: '5px 0 5px 20px' }}>{index + 1}号</div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '5px 20px 5px 0' }}>
          <SFIcon name={chosen ? 'checkmark' : 'xmark'} size={40} weight="semibold" />
        </div>
      </div>
    </div>
  )
}

/** 手机上的座位：一格一个号码，选中的那格涂黑 */
function SeatChip({ index, chosen, current, onDoubleTap, onLongPress }: {
  index: number
  chosen: boolean
  current: boolean
  onDoubleTap: () => void
  onLongPress: () => void
}) {
  const press = usePress({ onDoubleTap, onLongPress, longPressSeconds: 0.3 })
  return (
    <div {...press} style={{
      height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer',
      borderRadius: 12, border: '3px solid var(--ink)', touchAction: 'pan-y',
      background: current ? 'var(--ink)' : 'var(--mainbg)', color: current ? 'var(--mainbg)' : 'var(--ink)',
      transition: `background ${ease}, color ${ease}`,
    }}>
      <span style={{ ...rounded(16, 800), whiteSpace: 'nowrap' }}>{index + 1}号</span>
      <span style={{ display: 'flex', opacity: chosen ? 1 : 0.45 }}>
        <SFIcon name={chosen ? 'checkmark' : 'xmark'} size={15} weight="bold" />
      </span>
    </div>
  )
}

export function SetupPlayerPick() {
  const playersAssignedCharacters = useGame((s) => s.playersAssignedCharacters)
  const playerChoices = useSetupFlow((s) => s.playerChoices)
  // init：把选中的牌和重复角色合在一起再洗一次
  const [merged, setMerged] = useState<Character[]>(() => {
    const f = useSetupFlow.getState()
    const picked = f.playableCharactersShuffled.filter((_, i) => f.cardSelected[i])
    const repeated = f.extraRepeatedCharacters.filter((_, i) => f.extraRepeatedCardSelected[i])
    return shuffled([...picked, ...repeated])
  })
  const [cardRotation, setCardRotation] = useState<number[]>(() => merged.map(() => 0))
  const [currentSelectingPlayerIndex, setCurrentRaw] = useState(-1)
  const [selectedCardIndices, setSelectedCardIndices] = useState<Set<number>>(() => new Set())
  const [showSpecialCare, setShowSpecialCare] = useState(false)
  const [specialCarePlayerChoices, setSpecialCarePlayerChoices] = useState<Map<number, number>>(() => new Map())
  const care = usePresence(showSpecialCare, 0)

  // onAppear：每个座位都还没抽
  useLayoutEffect(() => {
    setFlow({ playerChoices: useSetupFlow.getState().playerChoices.map(() => -1) })
  }, [])

  // onChange(of: currentSelectingPlayerIndex)：选中的座位如果抽过牌，把他那张翻过来给他再看一眼，别的都盖上
  const setCurrent = (newValue: number) => {
    if (newValue === currentSelectingPlayerIndex) return
    setCurrentRaw(newValue)
    const chosen = newValue !== -1 ? useSetupFlow.getState().playerChoices[newValue] : -2
    setCardRotation((rot) => rot.map((_, i) => (i === chosen ? 180 : 0)))
  }

  const pickCard = (index: number) => {
    const cur = currentSelectingPlayerIndex
    const choices = useSetupFlow.getState().playerChoices
    if (!(cur !== -1 && choices[cur] === -1 && !selectedCardIndices.has(index))) return
    const m = [...merged]
    const sc = new Map(specialCarePlayerChoices)
    const swap = (a: number, b: number) => { const t = m[a]; m[a] = m[b]; m[b] = t }
    const keyWithValue = (v: number, except?: number) => [...sc.entries()].find(([k, val]) => val === v && k !== except)?.[0]
    const chosen = sc.get(cur)
    // 先看这个座位是不是提前定过角色（-1 是定了又取消，当作没定）
    if (chosen !== undefined && chosen >= 0) {
      // 定好的那张还没被别人抽走，就把它换到现在点的位置
      if (!selectedCardIndices.has(chosen)) {
        swap(chosen, index)
        sc.set(cur, index)
        const keyToUpdate = keyWithValue(index, cur)
        if (keyToUpdate !== undefined) sc.set(keyToUpdate, chosen)
      }
    } else if ([...sc.values()].includes(index)) {
      // 点到了给别人定好的牌：换一张没人定、没人抽的给他
      for (let i = 0; i < m.length; i++) {
        const newIndex = (index + i) % m.length
        if (!selectedCardIndices.has(newIndex) && ![...sc.values()].includes(newIndex)) {
          swap(newIndex, index)
          const keyToUpdate = keyWithValue(index)
          if (keyToUpdate !== undefined) sc.set(keyToUpdate, newIndex)
        }
      }
    }
    setMerged(m)
    setSpecialCarePlayerChoices(sc)
    const nextChoices = [...choices]
    nextChoices[cur] = index
    setFlow({ playerChoices: nextChoices })
    setCardRotation((rot) => rot.map((r, i) => (i === index ? 180 : r)))
    setSelectedCardIndices((s) => new Set(s).add(index))
    const assigned = [...game().playersAssignedCharacters]
    assigned[cur] = m[index]
    setGame({ playersAssignedCharacters: assigned })
  }

  // 选中座位的高亮框在座位之间滑动（matchedGeometryEffect）
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const [highlight, setHighlight] = useState<{ top: number; height: number; slide: boolean } | null>(null)
  const prevCurrent = useRef(-1)
  useLayoutEffect(() => {
    const el = currentSelectingPlayerIndex !== -1 ? rowRefs.current[currentSelectingPlayerIndex] : null
    if (el) setHighlight({ top: el.offsetTop, height: el.offsetHeight, slide: prevCurrent.current !== -1 })
    prevCurrent.current = currentSelectingPlayerIndex
  }, [currentSelectingPlayerIndex])

  const seatDoubleTap = (index: number) => setCurrent(currentSelectingPlayerIndex === index ? -1 : index)
  const seatLongPress = (index: number) => {
    if ((useSetupFlow.getState().playerChoices[index] ?? -1) === -1) {
      setCurrent(index)
      setShowSpecialCare(true)
    }
  }
  const back = () => setSelectionState(Math.max(useSetupFlow.getState().selectionState - 1, 0))

  const compact = useCompact()
  if (compact) {
    // 手机：上面座位格子，中间一格一格的牌，底下操作条。退出用标题栏的 ✕
    const dealt = playersAssignedCharacters.filter((_, index) => (playerChoices[index] ?? -1) !== -1).length
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {care.mounted ? (
          <SpecialCare
            shown={care.shown}
            merged={merged}
            selectedCardIndices={selectedCardIndices}
            specialCarePlayerChoices={specialCarePlayerChoices}
            setSpecialCarePlayerChoices={setSpecialCarePlayerChoices}
            currentSelectingPlayerIndex={currentSelectingPlayerIndex}
            onClose={() => setShowSpecialCare(false)}
          />
        ) : null}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px 10px', background: 'var(--mainbg)', borderBottom: '2px solid var(--ink)' }}>
          <div style={phoneHint}>双击号码选中座位，再让这位玩家长按一张牌翻开看角色。长按号码可以提前给他指定角色</div>
          <div data-tour="deal.seats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 6 }}>
            {playersAssignedCharacters.map((_, index) => (
              <SeatChip
                key={index}
                index={index}
                chosen={(playerChoices[index] ?? -1) !== -1}
                current={currentSelectingPlayerIndex === index}
                onDoubleTap={() => seatDoubleTap(index)}
                onLongPress={() => seatLongPress(index)}
              />
            ))}
          </div>
        </div>
        <div data-tour="deal.cards" className="scroll-hidden" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px 18px 24px' }}>
          <CardGrid target={110} center>
            {merged.map((c, index) => (
              <PickCard
                key={index}
                bare
                character={c}
                rotation={cardRotation[index] ?? 0}
                dimmed={(cardRotation[index] ?? 0) === 0 && selectedCardIndices.has(index)}
                onLongPress={() => pickCard(index)}
              />
            ))}
          </CardGrid>
        </div>
        <MobileBar
          status={currentSelectingPlayerIndex !== -1 ? `${currentSelectingPlayerIndex + 1}号在抽 · 已抽 ${dealt} / ${playerChoices.length}` : `已抽 ${dealt} / ${playerChoices.length}，先双击一个号码`}
          buttonsTour="deal.buttons"
        >
          <button style={barButton()} onClick={back}>返回</button>
          <button style={barButton(true)} onClick={() => setGame({ showSetup: false })}>确认</button>
        </MobileBar>
      </div>
    )
  }

  const btn = boxButton(20, 20, 10, 3)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {care.mounted ? (
        <SpecialCare
          shown={care.shown}
          merged={merged}
          selectedCardIndices={selectedCardIndices}
          specialCarePlayerChoices={specialCarePlayerChoices}
          setSpecialCarePlayerChoices={setSpecialCarePlayerChoices}
          currentSelectingPlayerIndex={currentSelectingPlayerIndex}
          onClose={() => setShowSpecialCare(false)}
        />
      ) : null}
      <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
        <div data-tour="deal.cards" style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto' }}>
          <HFlow center style={{ padding: '0 10px' }}>
            {merged.map((c, index) => (
              <PickCard
                key={index}
                character={c}
                rotation={cardRotation[index] ?? 0}
                dimmed={(cardRotation[index] ?? 0) === 0 && selectedCardIndices.has(index)}
                onLongPress={() => pickCard(index)}
              />
            ))}
          </HFlow>
        </div>
        <div style={{ width: 260, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div data-tour="deal.seats" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {highlight ? (
                <div style={{
                  position: 'absolute', left: 6, right: 6, top: highlight.top + 4, height: highlight.height - 8,
                  borderRadius: 40, border: '3px solid var(--ink)',
                  background: 'color-mix(in srgb, var(--paper) 45%, transparent)',
                  backdropFilter: 'blur(14px) saturate(1.6)', WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
                  opacity: currentSelectingPlayerIndex !== -1 ? 1 : 0,
                  transition: highlight.slide ? `top ${spring}, height ${spring}, opacity ${spring}` : `opacity ${spring}`,
                  pointerEvents: 'none',
                }} />
              ) : null}
              {playersAssignedCharacters.map((_, index) => (
                <SeatRow
                  key={index}
                  index={index}
                  chosen={(playerChoices[index] ?? -1) !== -1}
                  rowRef={(el) => { rowRefs.current[index] = el }}
                  onDoubleTap={() => seatDoubleTap(index)}
                  onLongPress={() => seatLongPress(index)}
                />
              ))}
            </div>
          </div>
          <div data-tour="deal.buttons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <button style={btn} onClick={back}>返回</button>
            <button style={btn} onClick={() => setGame({ showSetup: false })}>确认</button>
            <button style={btn} onClick={() => setGame({ showSetup: false })}>退出</button>
          </div>
        </div>
      </div>
    </div>
  )
}
