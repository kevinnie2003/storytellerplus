// 选标签，对应 SubViews/TagView.swift
// currentSelectedPlayerIDForReminder >= 0 是给座位加，-2 是全局标签
import { useState } from 'react'
import type { Character, Reminder } from '../game/types'
import { makeReminder, reminderId } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { makeLog } from '../game/log'
import { registerUndo } from '../game/undo'
import { team2Int } from '../game/loadScript'
import { teamIdColor } from '../game/teams'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { rounded } from '../ui/kit'
import { MenuPicker, OverlayLayer, panelHeight, stroke, systemBlue } from './common'

const getImageURL = (name: string, characters: Character[]) => characters.find((c) => c.name === name)?.imageURL ?? ''

/** 把剧本里的标签对应到场上的座位（同一个角色有好几个就每个都来一份） */
function computeRemindersWithSource(): Reminder[] {
  const s = game()
  const out: Reminder[] = []
  const fabledNames = s.selectedFabledCharacters.map((c) => c.name)
  const players = s.playersAssignedCharacters
  for (const reminder of s.allReminders) {
    if (reminder.isGlobal) {
      out.push(reminder)
    } else if (reminder.playerId === -2 && fabledNames.includes(reminder.from)) {
      out.push(reminder)
    } else if (reminder.playerId === -1) {
      players.forEach((p, j) => {
        if (reminder.from === p.name) out.push({ ...reminder, playerId: j })
      })
    } else if (reminder.playerId >= 0) {
      out.push(reminder)
      players.forEach((p, j) => {
        if (reminder.from === p.name && j !== reminder.playerId) out.push({ ...reminder, playerId: j })
      })
    }
  }
  return out
}

export function TagPicker() {
  const show = useGame((s) => s.selectNewReminder)
  return show ? <TagView /> : null
}

function confirm(remindersWithSource: Reminder[]) {
  const s = game()
  setGame({ selectNewReminder: false })
  const index = s.selectedReminderIndex
  if (index < 0 || index >= remindersWithSource.length) return
  const selected = remindersWithSource[index]
  const target = s.currentSelectedPlayerIDForReminder
  const id = reminderId(selected)
  if (target >= 0) {
    if (target >= s.playersStates.length) return
    const states = s.playersStates.map((x, i) => (i === target ? [...x, selected] : x))
    let addLog: string | null = null
    const logs = [...s.allLogs]
    if (s.gameState !== 0) {
      const ch = s.playersAssignedCharacters[target]
      const entry = makeLog({
        message: `${selected.effect}`, messager: target + 1, source: selected.from, type: 1, characterName: ch.name,
        playerNumbers: [selected.playerId], playerCharacters: [ch.name, selected.from],
        playerTeams: [team2Int(ch.team), selected.team],
      })
      logs.push(entry)
      addLog = entry.id
    }
    setGame({ playersStates: states, allLogs: logs })
    registerUndo(`已给 ${target + 1} 号加上“${selected.effect}”`, () => {
      setGame((st) => {
        if (target >= st.playersStates.length) return {}
        const list = st.playersStates[target]
        let i = -1
        for (let k = list.length - 1; k >= 0; k--) if (reminderId(list[k]) === id) { i = k; break }
        if (i < 0) return {}
        return {
          playersStates: st.playersStates.map((x, n) => (n === target ? x.filter((_, k) => k !== i) : x)),
          allLogs: addLog ? st.allLogs.filter((l) => l.id !== addLog) : st.allLogs,
        }
      })
    })
  } else {
    let addLog: string | null = null
    const logs = [...s.allLogs]
    if (s.gameState !== 0) {
      const entry = makeLog({
        message: `${selected.effect}`, messager: -20, source: selected.from, type: 16, characterName: '全局',
        playerNumbers: [selected.playerId], playerCharacters: [selected.from], playerTeams: [selected.team],
      })
      logs.push(entry)
      addLog = entry.id
    }
    setGame({ globalStates: [...s.globalStates, selected], allLogs: logs })
    registerUndo(`已加上全局标签“${selected.effect}”`, () => {
      setGame((st) => {
        let i = -1
        for (let k = st.globalStates.length - 1; k >= 0; k--) if (reminderId(st.globalStates[k]) === id) { i = k; break }
        if (i < 0) return {}
        return {
          globalStates: st.globalStates.filter((_, k) => k !== i),
          allLogs: addLog ? st.allLogs.filter((l) => l.id !== addLog) : st.allLogs,
        }
      })
    })
  }
}

const smallButton = (size: number): React.CSSProperties => ({
  ...rounded(size, 700), color: 'var(--ink)', padding: '8px 20px', ...stroke(2, 20),
})

function TagView() {
  const target = useGame((s) => s.currentSelectedPlayerIDForReminder)
  const selectedReminderIndex = useGame((s) => s.selectedReminderIndex)
  const characters = useGame((s) => s.characters)
  const players = useGame((s) => s.playersAssignedCharacters)
  const [remindersWithSource, setRemindersWithSource] = useState(computeRemindersWithSource)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagSource, setNewTagSource] = useState(() => game().playersAssignedCharacters.length)

  const addCustomTag = () => {
    if (newTagName === '') return
    const isPlayer = newTagSource >= 0 && newTagSource < players.length
    const r = makeReminder(
      isPlayer ? players[newTagSource].name : '说书人',
      newTagName,
      isPlayer ? team2Int(players[newTagSource].team) : 5,
      newTagSource >= players.length,
      isPlayer ? newTagSource : -2,
    )
    setGame((s) => ({ allReminders: [...s.allReminders, r] }))
    const next = [...remindersWithSource, r]
    setRemindersWithSource(next)
    setShowTagEditor(false)
    setNewTagName('')
    setNewTagSource(players.length)
    setGame({ selectedReminderIndex: next.length - 1 })
  }

  const sourceOptions = [
    ...players.map((p, i) => ({ value: i, label: `${i + 1}号 ${p.name}` })),
    { value: players.length, label: '说书人' },
  ]

  return (
    <OverlayLayer
      zIndex={12}
      background="color-mix(in srgb, var(--mainbg) 30%, transparent)"
      onDoubleTapBackground={() => setGame({ selectNewReminder: false })}
    >
      <div
        data-tour="tag.panel"
        style={{
          position: 'relative', width: 600, height: panelHeight, background: 'var(--mainbg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', ...stroke(3, 20),
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ ...rounded(25, 700), paddingTop: 25, textAlign: 'center', width: '100%' }}>
            {target >= 0 ? `为${target + 1}号玩家选择标记` : '为全局添加标记'}
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 15, rowGap: 8,
            padding: '8px 20px 0',
          }}>
            {remindersWithSource.map((r, index) => (
              <ReminderChip
                key={index}
                reminder={r}
                imageURL={getImageURL(r.from, characters)}
                selected={selectedReminderIndex === index}
                onTap={() => setGame({ selectedReminderIndex: index })}
              />
            ))}
            <button
              onClick={() => setShowTagEditor(true)}
              style={{
                width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink)', ...stroke(3, 25), transform: 'scale(0.9)',
              }}
            >
              <SFIcon name="plus" size={25} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <div style={{ padding: '20px 30px' }}>
            <button onClick={() => confirm(remindersWithSource)} style={smallButton(20)}>确认</button>
          </div>
          <div style={{ padding: '20px 30px' }}>
            <button onClick={() => setGame({ selectNewReminder: false })} style={smallButton(20)}>返回</button>
          </div>
        </div>
      </div>

      {showTagEditor ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'color-mix(in srgb, var(--mainbg) 50%, transparent)', animation: 'st-fade .3s ease-in-out',
        }}>
          <div style={{
            width: 300, height: 300, background: 'var(--paper)', padding: '0 20px', display: 'flex',
            flexDirection: 'column', gap: 8, ...stroke(3, 20),
          }}>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...rounded(20, 700), whiteSpace: 'nowrap' }}>标签名字： </span>
              <input
                autoFocus
                value={newTagName}
                placeholder="输入标签名字"
                onChange={(e) => setNewTagName(e.target.value)}
                style={{
                  flex: 1, minWidth: 0, fontSize: 17, background: 'transparent', border: 'none', outline: 'none', padding: 0,
                  fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...rounded(20, 700), whiteSpace: 'nowrap' }}>标签来源： </span>
              <MenuPicker options={sourceOptions} value={newTagSource} onChange={setNewTagSource} tint={systemBlue} style={{ flex: 1 }} />
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 10 }}>
              <button onClick={addCustomTag} style={smallButton(15)}>确认</button>
              <button onClick={() => setShowTagEditor(false)} style={smallButton(15)}>取消</button>
            </div>
          </div>
        </div>
      ) : null}
    </OverlayLayer>
  )
}

function ReminderChip({ reminder, imageURL, selected, onTap }: {
  reminder: Reminder
  imageURL: string
  selected: boolean
  onTap: () => void
}) {
  const color = teamIdColor(reminder.team)
  const hasSeat = reminder.playerId >= 0
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 80, height: 55,
        padding: '0 5px', borderRadius: 40, background: color, cursor: 'pointer',
        transform: `scale(${selected ? 1.05 : 0.93})`, transition: 'transform .3s ease-in-out',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', paddingLeft: hasSeat ? 5 : 0, borderRadius: 30,
        background: 'var(--goodTextBg)', marginRight: hasSeat || imageURL ? 10 : 0,
      }}>
        {hasSeat ? (
          <span style={{
            ...rounded(18, 900), color, minWidth: 30, height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{reminder.playerId + 1}</span>
        ) : null}
        {imageURL ? (
          <CachedImage url={imageURL} size={43} style={{ borderRadius: '50%', background: 'var(--goodTextBg)' }} />
        ) : (
          <span style={{ width: 0, height: 45 }} />
        )}
      </div>
      <span style={{ ...rounded(18, 700), color: 'var(--goodTextBg)', padding: 5, whiteSpace: 'nowrap' }}>{reminder.effect}</span>
    </div>
  )
}
