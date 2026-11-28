// 配版流程的状态，对应 iPad 版 SetupView 里的 @State。放在 zustand 里，新手教程可以读现在到哪一步、直接跳步或者塞一套抽卡堆
import { create } from 'zustand'
import type { Character } from '../game/types'
import { game, setGame } from '../game/store'
import { showAlert } from '../ui/Alert'

export const teamNames = ['恶魔', '爪牙', '外来者', '镇民']
export const teamNameEnglish = ['demon', 'minion', 'outsider', 'townsfolk']
export const teamColors = ['var(--demon)', 'var(--minion)', 'var(--outsider)', 'var(--townsfolk)']

export interface SetupFlow {
  /**
   * 0 选恶魔数量，1 玩家盲选恶魔，2 检查恶魔，3 选爪牙数量 …… 9 选镇民数量，10 盲选镇民，11 检查全部，
   * 12 玩家一个一个抽卡
   */
  selectionState: number
  selectedTeamCounts: number[] // [demon, minion, outsider, townsfolk]
  cardSelected: boolean[]
  playableCharactersShuffled: Character[]
  extraRepeatedCharacters: Character[] // 重复角色
  extraRepeatedCardSelected: boolean[]
  playerChoices: number[] // 每个玩家抽了哪张牌
}

export const useSetupFlow = create<SetupFlow>(() => ({
  selectionState: 0,
  selectedTeamCounts: [0, 0, 0, 0],
  cardSelected: [],
  playableCharactersShuffled: [],
  extraRepeatedCharacters: [],
  extraRepeatedCardSelected: [],
  playerChoices: [],
}))

const flow = () => useSetupFlow.getState()
export const setFlow = (partial: Partial<SetupFlow>) => useSetupFlow.setState(partial)

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export { shuffled }

/** Swift 的 Character 是 Equatable，所有字段都一样才算同一个 */
export const sameCharacter = (a: Character, b: Character) =>
  a.id === b.id && a.name === b.name && a.ability === b.ability && a.firstNightOrder === b.firstNightOrder &&
  a.otherNightOrder === b.otherNightOrder && a.firstNightReminder === b.firstNightReminder &&
  a.otherNightReminder === b.otherNightReminder && a.setup === b.setup && a.team === b.team && a.imageURL === b.imageURL

/** 配版页出现时（SetupView.onAppear）：洗牌，清空选择 */
export function startSetupFlow() {
  const { playableCharacters, playerCount } = game()
  const deck = shuffled(playableCharacters)
  setFlow({
    selectionState: 0,
    selectedTeamCounts: [0, 0, 0, 0],
    cardSelected: deck.map(() => false),
    playableCharactersShuffled: deck,
    extraRepeatedCharacters: [],
    extraRepeatedCardSelected: [],
    playerChoices: Array.from({ length: playerCount }, () => -1),
  })
}

/**
 * 换到某一步。抽卡堆的牌数要等于人数才能开抽，不然抽卡页没有牌可抽（SetupView 的 onChange(of: selectionState)）
 */
export function setSelectionState(value: number) {
  const old = flow().selectionState
  if (value === old) return
  if (value === 12 && old !== 12) {
    const f = flow()
    const count = f.cardSelected.filter(Boolean).length + f.extraRepeatedCardSelected.filter(Boolean).length
    const playerCount = game().playerCount
    if (count !== playerCount) {
      showAlert({
        title: '牌数不对，还不能开抽',
        message: `抽卡堆现在有 ${count} 张牌，玩家有 ${playerCount} 人。在检查页点牌选中或去掉，让牌数和人数一样再点“玩家开抽”。`,
        buttons: [{ label: '好', role: 'cancel' }],
      })
      return
    }
  }
  setFlow({ selectionState: value })
}

/** 把 AI（或者新手教程）给的抽卡堆填进配版，然后跳到检查页让说书人确认（applyAIBag） */
export function fillSetupBag(bag: Character[], notes = '') {
  const f = flow()
  const cardSelected = f.cardSelected.map(() => false)
  const extraRepeatedCharacters: Character[] = []
  const extraRepeatedCardSelected: boolean[] = []
  for (const character of bag) {
    const index = f.playableCharactersShuffled.findIndex((c, i) => sameCharacter(c, character) && !cardSelected[i])
    if (index !== -1) {
      cardSelected[index] = true
    } else {
      // 同一个角色出现多次，走“重复角色”
      extraRepeatedCharacters.push(character)
      extraRepeatedCardSelected.push(true)
    }
  }
  setFlow({
    cardSelected,
    extraRepeatedCharacters,
    extraRepeatedCardSelected,
    selectedTeamCounts: teamNameEnglish.map((team) => bag.filter((c) => c.team === team).length),
  })
  setGame({ aiSetupNotes: notes })
  setSelectionState(11)
}

/** 新手教程让检查页滚到“玩家开抽”（TourBus.scrollRequest = "setup.deal"） */
export function scrollSetupDeal() {
  const el = document.querySelector<HTMLElement>('[data-tour="setup.deal"]')
  el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}
