// 阵营颜色，对应 iPad 版 Helpers.swift 里的 team2Color / teamid2Color 等
export const teamColor = (team: string): string => {
  switch (team) {
    case 'townsfolk': return 'var(--townsfolk)'
    case 'outsider': return 'var(--outsider)'
    case 'minion': return 'var(--minion)'
    case 'demon': return 'var(--demon)'
    case 'traveler': return 'var(--traveler)'
    default: return 'var(--fabled)'
  }
}

export const teamIdColor = (team: number): string =>
  ['var(--townsfolk)', 'var(--outsider)', 'var(--minion)', 'var(--demon)', 'var(--traveler)'][team] ?? 'var(--fabled)'

export const isPlayerTeam = (team: string) => ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'].includes(team)

/** 隐藏阵营颜色时卡片上的小字 */
export const teamShortName = (team: string) =>
  ({ townsfolk: '民', outsider: '外', minion: '爪', demon: '恶', traveler: '旅' } as Record<string, string>)[team] ?? ''

export const isEvilTeam = (team: string) => team === 'minion' || team === 'demon'
