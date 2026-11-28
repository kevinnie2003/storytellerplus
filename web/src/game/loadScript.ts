// 读剧本 JSON，对应 iPad 版 Helpers.swift 里的 loadGameData
import type { Character, Jinx, Reminder } from './types'
import { makeReminder } from './types'
import {
  demonCharacter, demonInfo, evilCharacter, evilReminder, fabledCharactersGlobal, fabledRemindersGlobal,
  goodCharacter, goodReminder, minionCharacter, minionInfo, travelerCharactersGlobal, travelerRemindersGlobal,
} from './builtins'

/** 剧本 JSON 里的 image 可以是链接，也可以是链接数组，数组时取第一个非空的 */
export function imageURLString(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) if (typeof item === 'string' && item) return item
  }
  return ''
}

export function team2Int(team: string): number {
  switch (team) {
    case 'townsfolk': return 0
    case 'outsider': return 1
    case 'minion': return 2
    case 'demon': return 3
    case 'traveler': return 4
    default: return 5
  }
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : 0)

export interface LoadedScript {
  characters: Character[]
  playableCharacters: Character[]
  travelers: Character[]
  fabled: Character[]
  allReminders: Reminder[]
  jinxList: Jinx[]
  playName: string
  playAuthor: string
  alertMessage: string
}

export function loadGameData(playJSON: Record<string, unknown>[]): LoadedScript {
  const characters: Character[] = []
  const playableCharacters: Character[] = []
  const travelers: Character[] = []
  const fabled: Character[] = []
  const allReminders: Reminder[] = []
  const jinxList: Jinx[] = []
  let playName = ''
  let playAuthor = ''
  let alertMessage = ''
  minionInfo.order = 4.5
  demonInfo.order = 7.5

  for (const item of playJSON) {
    const id = item.id
    if (typeof id !== 'string') continue
    if (id === '_meta') {
      playName = (typeof item.name === 'string' && item.name) || '无名剧本'
      playAuthor = (typeof item.author === 'string' && item.author) || '无名作者'
      minionInfo.order = typeof item.minionInfo === 'number' ? item.minionInfo : 4.5
      demonInfo.order = typeof item.demonInfo === 'number' ? item.demonInfo : 4.5
      const statusList = Array.isArray(item.status) ? (item.status as Record<string, string>[]) : []
      for (const status of statusList) {
        const name = status.name ?? ''
        const description = status.skill ?? ''
        if (name && description) jinxList.push({ name, imageURL: '', type: 0, description })
      }
    } else if (id.includes('_meta')) {
      jinxList.push({
        name: typeof item.name === 'string' ? item.name : '',
        imageURL: imageURLString(item.image),
        type: 1,
        description: typeof item.ability === 'string' ? item.ability : '',
      })
    } else {
      const team = item.team
      if (typeof team !== 'string') { alertMessage = `ID: ${id} 角色阵营缺失`; continue }
      if (team.includes('jinx')) {
        const name = typeof item.name === 'string' ? item.name : ''
        const description = typeof item.ability === 'string' ? item.ability : ''
        if (name && description) jinxList.push({ name, imageURL: imageURLString(item.image), type: 1, description })
      }
      if (typeof item.name !== 'string') { alertMessage = `ID: ${id} 角色名称缺失`; continue }
      if (typeof item.ability !== 'string') { alertMessage = `ID: ${id} 角色能力缺失`; continue }
      const name = item.name
      const character: Character = {
        id,
        name,
        ability: item.ability,
        firstNightOrder: num(item.firstNight),
        otherNightOrder: num(item.otherNight),
        firstNightReminder: typeof item.firstNightReminder === 'string' ? item.firstNightReminder : '',
        otherNightReminder: typeof item.otherNightReminder === 'string' ? item.otherNightReminder : '',
        // Swift 的 as? Bool 会把 JSON 里的 1 也当成 true
        setup: item.setup === true || item.setup === 1,
        team,
        imageURL: imageURLString(item.image),
      }
      if (team === 'fabled') fabled.push(character)
      else if (team === 'traveler') { travelers.push(character); playableCharacters.push(character) }
      else playableCharacters.push(character)
      characters.push(character)
      const reminders = Array.isArray(item.reminders) ? (item.reminders as unknown[]).filter((x): x is string => typeof x === 'string') : []
      const remindersGlobal = Array.isArray(item.remindersGlobal) ? (item.remindersGlobal as unknown[]).filter((x): x is string => typeof x === 'string') : []
      allReminders.push(...reminders.map((e) => makeReminder(name, e, team2Int(team), false)))
      allReminders.push(...remindersGlobal.map((e) => makeReminder(name, e, team2Int(team), true)))
    }
  }

  characters.push(goodCharacter, evilCharacter, minionCharacter, demonCharacter)
  const characterNames = new Set(characters.map((c) => c.name))
  const fabledNames = new Set(fabled.map((c) => c.name))
  const extraTravelers = travelerCharactersGlobal.filter((c) => !characterNames.has(c.name))
  playableCharacters.push(...extraTravelers)
  characters.push(...extraTravelers)
  characters.push(...fabledCharactersGlobal.filter((c) => !fabledNames.has(c.name)))
  allReminders.push(goodReminder, evilReminder, ...travelerRemindersGlobal, ...fabledRemindersGlobal)

  return { characters, playableCharacters, travelers, fabled, allReminders, jinxList, playName, playAuthor, alertMessage }
}
