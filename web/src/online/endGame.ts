// 结束游戏：说书人确认两次（真的要结束？哪一方赢？），记进整局记录，开着联机房间时告诉所有玩家谁赢谁输，再打开复盘
import { game, setGame } from '../game/store'
import { makeLog } from '../game/log'
import { archiveSave, makeSaveData, saveLastGame } from '../game/persistence'
import type { Character, Reminder } from '../game/types'
import type { RecapData } from '../ai/RecapPoster'
import type { Winner } from '../net/protocol'
import { showAlert } from '../ui/Alert'
import { uploadFinal } from '../net/host'

export const winnerText = (w: string) => (w === 'evil' ? '邪恶阵营胜利' : '善良阵营胜利')

/**
 * 这个座位最后算不算邪恶：
 * - 爪牙、恶魔（包括拿着好人牌、挂“是提线木偶”的提线木偶）是邪恶，除非挂了“善良”标记
 * - 其他角色（镇民、外来者、旅行者，包括疯子）是善良，除非挂了“邪恶”标记
 */
export function isEvil(c: Character, states: Reminder[] = []): boolean {
  const marked = (word: string) => states.some((r) => r.effect.includes(word))
  const marionette = c.name === '提线木偶' || states.some((r) => r.from === '提线木偶' && r.effect.includes('提线木偶'))
  const evilCharacter = c.team === 'minion' || c.team === 'demon' || marionette
  return evilCharacter ? !marked('善良') : marked('邪恶')
}

/** 每个座位赢没赢 */
export function seatResults(winner: Winner): boolean[] {
  const s = game()
  return s.playersAssignedCharacters.map((c, i) => isEvil(c, s.playersStates[i]) === (winner === 'evil'))
}

/** 齿轮面板里的“结束游戏”：先确认，再选胜利方 */
export function confirmEndGame() {
  showAlert({
    title: '结束游戏？',
    message: '结束后不能撤销，这一局就到此为止。下一步选哪一方胜利。',
    buttons: [
      { label: '取消', role: 'cancel' },
      { label: '结束游戏', role: 'destructive', action: chooseWinner },
    ],
  })
}

function chooseWinner() {
  showAlert({
    title: '哪一方胜利？',
    message: '选好后会告诉所有玩家谁赢谁输，并打开复盘。',
    sheet: true,
    buttons: [
      { label: '善良阵营胜利', action: () => { void finish('good') } },
      { label: '邪恶阵营胜利', action: () => { void finish('evil') } },
      { label: '取消', role: 'cancel' },
    ],
  })
}

async function finish(winner: Winner) {
  const log = makeLog({
    message: `游戏结束：${winnerText(winner)}`, messager: 21, type: 3, characterName: '说书人',
    playerCharacters: ['说书人'], playerTeams: [5],
  })
  setGame((s) => ({ gameWinner: winner, allLogs: [...s.allLogs, log], showMenu: false }))
  // 复盘页从存档里读，先存好
  const data = makeSaveData()
  if (data.gameID !== 'demo') {
    saveLastGame(data)
    await archiveSave(data)
  }
  void sendFinal(null)
  setGame({ showEndReview: true })
}

/** 把结果（和 AI 复盘）发到玩家手机上；没开联机房间就什么都不做 */
export function sendFinal(recap: RecapData | null) {
  const s = game()
  if (s.gameWinner !== 'good' && s.gameWinner !== 'evil') return Promise.resolve(false)
  const winner = s.gameWinner as Winner
  return uploadFinal({ winner, results: seatResults(winner), game: makeSaveData(), recap })
}
