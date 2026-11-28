// 能力里提到提名、被提名的角色，提名时要留意（ExtraCareView 列表和 VotingView 的波纹都用）
import type { Character } from '../game/types'

export const needsCareForNomination = (c: Character) =>
  c.ability.includes('提名') && !c.ability.includes('被提名') && !c.ability.includes('提名你')
export const needsCareForBeingNominated = (c: Character) =>
  c.ability.includes('被提名') || c.ability.includes('提名你')
