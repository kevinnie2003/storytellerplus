// 游戏存档页，对应 iPad 版 Settings/ArchiveView.swift：每一局一张卡片，可以载入继续或复盘
import { useEffect, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { showAlert } from '../ui/Alert'
import { SFIcon } from '../ui/SFIcon'
import { rounded, STChoice, STPageHeader } from '../ui/kit'
import { ReviewView } from '../ai/ReviewView'
import { archiveDelete, archiveList, type ArchiveEntry } from '../game/persistence'

/** 用一圈小圆点画出这一局的座位：实心是活着，空心带叉是死了 */
export function SeatRing({ alive, size = 76 }: { alive: boolean[]; size?: number }) {
  const radius = size / 2 - 7
  const c = size / 2
  const n = Math.max(alive.length, 1)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      {alive.map((a, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        const x = c + radius * Math.cos(angle)
        const y = c + radius * Math.sin(angle)
        return a ? (
          <circle key={i} cx={x} cy={y} r={5.5} fill="var(--ink)" />
        ) : (
          <g key={i}>
            <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
            <path
              d={`M${x - 2} ${y - 2}L${x + 2} ${y + 2}M${x + 2} ${y - 2}L${x - 2} ${y + 2}`}
              stroke="var(--ink)" strokeWidth={1.4} strokeLinecap="round"
            />
          </g>
        )
      })}
    </svg>
  )
}

function stageText(entry: ArchiveEntry): string {
  switch (entry.gameState) {
    case 1: return '首夜'
    case 2: return `第 ${Math.max(entry.dayCount, 1)} 天白天`
    case 3: return `第 ${entry.dayCount + 1} 夜`
    default: return '配版中'
  }
}

/** 和 iPad 上 zh_CN 的 .month().day().hour().minute() 一样：11月27日 14:05 */
function savedAtText(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ArchiveView({ open, onClose, currentGameID, onLoad }: {
  open: boolean
  onClose: () => void
  /** 正在进行的那一局（从小镇里打开时），这一张不能载入和删除 */
  currentGameID?: string
  onLoad: (id: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <ArchiveContent onClose={onClose} currentGameID={currentGameID} onLoad={onLoad} /> : null}
    </Sheet>
  )
}

function ArchiveContent({ onClose, currentGameID, onLoad }: {
  onClose: () => void
  currentGameID?: string
  onLoad: (id: string) => void
}) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [reviewing, setReviewing] = useState<ArchiveEntry | null>(null)

  const reload = () => {
    void archiveList().then((list) => { setEntries(list); setLoaded(true) }).catch(() => setLoaded(true))
  }
  useEffect(reload, [])

  const confirmDelete = (entry: ArchiveEntry) => showAlert({
    title: `删除“${entry.playName}”的存档吗？`,
    message: '删除后无法恢复。',
    buttons: [
      { label: '取消', role: 'cancel' },
      { label: '删除', role: 'destructive', action: () => { void archiveDelete(entry.id).then(reload) } },
    ],
  })

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <STPageHeader title="游戏存档" onClose={onClose} />
      {entries.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          visibility: loaded ? 'visible' : 'hidden',
        }}>
          <SFIcon name="tray" size={44} weight="bold" />
          <div style={rounded(22, 900)}>还没有存档</div>
          <div style={{ ...rounded(16), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>分好角色之后会自动保存</div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18,
            padding: '4px 4px 34px',
          }}>
            {entries.map((entry) => {
              const isCurrent = entry.id === currentGameID
              return (
                <div key={entry.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 14, padding: 15,
                  background: 'var(--paper)', borderRadius: 18, border: '3px solid var(--ink)',
                  // 正在进行的那一局描边粗一些（5），往里外各多出 1
                  boxShadow: isCurrent ? '0 0 0 1px var(--ink), inset 0 0 0 1px var(--ink)' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <SeatRing alive={entry.alive} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ ...rounded(22, 900), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.playName || '无名剧本'}
                      </div>
                      <div style={rounded(16, 600)}>{entry.playerCount} 人，还剩 {entry.aliveCount} 人活着</div>
                      <div style={{ ...rounded(15), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>
                        {stageText(entry)}，{savedAtText(entry.savedAt)} 保存
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <STChoice selected={false} onClick={() => setReviewing(entry)}>
                      <span style={rounded(17, 700)}>复盘</span>
                    </STChoice>
                    {isCurrent ? (
                      <span style={{ ...rounded(17, 700), padding: '10px 0', color: 'color-mix(in srgb, var(--ink) 50%, transparent)' }}>正在进行</span>
                    ) : (
                      <>
                        <STChoice selected onClick={() => { onClose(); onLoad(entry.id) }}>
                          <span style={rounded(17, 700)}>载入这一局</span>
                        </STChoice>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => confirmDelete(entry)} style={{ padding: 10, color: 'var(--demonInk)' }} aria-label="删除">
                          <SFIcon name="trash" size={18} weight="bold" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <ReviewView open={reviewing !== null} onClose={() => setReviewing(null)} gameID={reviewing?.id ?? ''} />
    </div>
  )
}
