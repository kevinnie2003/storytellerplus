// 复盘：按天和夜排列的时间线（只读），以及 AI 复盘长图。对应 iPad 版 Settings/ReviewView.swift
import { useEffect, useRef, useState } from 'react'
import type { GameLogEntry, GameSaveData } from '../game/types'
import { archiveLoad, recapLoad, recapPosterDelete, recapPosterLoad, recapPosterSave, recapSave } from '../game/persistence'
import { teamColor } from '../game/teams'
import { Sheet } from '../ui/Sheet'
import { STChoice, STChoiceRow, STPageHeader, rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { SFIcon } from '../ui/SFIcon'
import { CachedImage } from '../ui/CachedImage'
import { aiErrorText } from './client'
import { contextFromSave } from './context'
import { recapSystem, recapUser, withHouseRules } from './prompts'
import { AIProgressLine, aiRequestJSON, downloadBlob } from './common'
import { AISettingsView } from './AISettingsView'
import { fetchIcons, iconIsCached, normalizeRecap, recapFrom, renderRecapPoster, type RecapData } from './RecapPoster'

/** 时间线里的一段：游戏开始前、第几夜、第几天 */
interface ReviewSegment {
  id: number
  title: string
  isNight: boolean
  entries: GameLogEntry[]
}

export const ReviewBuilder = {
  segments(logs: GameLogEntry[]): ReviewSegment[] {
    let n = 0
    const result: ReviewSegment[] = [{ id: n++, title: '开局', isNight: false, entries: [] }]
    let day = 0
    let night = 0
    for (const entry of logs) {
      switch (entry.type) {
        case 8:
          continue
        case 9:
          night = 1
          result.push({ id: n++, title: '第 1 夜', isNight: true, entries: [] })
          break
        case 10:
          day += 1
          result.push({ id: n++, title: `第 ${day} 天`, isNight: false, entries: [] })
          break
        case 11:
          night += 1
          result.push({ id: n++, title: `第 ${night} 夜`, isNight: true, entries: [] })
          break
        default:
          result[result.length - 1].entries.push(entry)
      }
    }
    return result.filter((s) => s.entries.length > 0 || s.title !== '开局')
  },

  /** 一条记录的显示文字，去掉原记录里的分隔线 */
  text(entry: GameLogEntry): string {
    switch (entry.type) {
      case 2: {
        const who = entry.messager > 0 ? `${entry.messager} 号 ${entry.characterName}` : entry.characterName
        const detail = entry.message.trim()
        return detail === '' ? `${who} 被唤醒` : `${who}：${detail}`
      }
      case 3:
        return entry.message
      default:
        return entry.logText.split('\n').filter((l) => !l.startsWith('====')).join(' ').replace(/^[ \t]+|[ \t]+$/g, '')
    }
  },

  color(entry: GameLogEntry): string {
    switch (entry.type) {
      case 6: return 'var(--demonInk)'
      case 12: return 'var(--townsfolk)'
      case 4: case 5: return 'var(--ink)'
      default: return 'color-mix(in srgb, var(--ink) 75%, transparent)'
    }
  },

  isBold(entry: GameLogEntry): boolean {
    return [4, 6, 12].includes(entry.type)
  },
}

export function ReviewView({ open, onClose, gameID }: { open: boolean; onClose: () => void; gameID: string }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <ReviewBody key={gameID} onClose={onClose} gameID={gameID} /> : null}
    </Sheet>
  )
}

function ReviewBody({ onClose, gameID }: { onClose: () => void; gameID: string }) {
  const [loaded, setLoaded] = useState(false)
  const [game, setGame] = useState<GameSaveData | null>(null)
  const [recap, setRecap] = useState<RecapData | null>(null)
  const [poster, setPoster] = useState<Blob | null>(null)
  const [posterURL, setPosterURL] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [progress, setProgress] = useState('')
  const [errorText, setErrorText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const compact = useCompact()
  /** 手机上时间线和 AI 复盘分两页 */
  const [tab, setTab] = useState<'timeline' | 'recap'>('timeline')
  /** 画图是异步的，只认最后一次 */
  const renderToken = useRef(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (!poster) { setPosterURL(''); return }
    const url = URL.createObjectURL(poster)
    setPosterURL(url)
    return () => URL.revokeObjectURL(url)
  }, [poster])

  /** 先用已经下载好的图标马上画出来，再花几秒补下载缺的图标，补到了就重画。画好的图存起来 */
  const renderPoster = async (g: GameSaveData | null, r: RecapData | null) => {
    const token = ++renderToken.current
    if (!g || !r) { setPoster(null); return }
    const urls = [...new Set(g.playersAssignedCharacters.map((c) => c.imageURL).filter((u) => u !== ''))]
    const missing = urls.filter((u) => !iconIsCached(u))
    const first = await renderRecapPoster(g, r)
    if (token !== renderToken.current || !alive.current) return
    setPoster(first)
    if (missing.length === 0) {
      if (first) void recapPosterSave(gameID, first)
      return
    }
    // 有的图标站很慢、连不上或者不允许跨域，最多等 8 秒
    await fetchIcons(missing, 8000)
    if (token !== renderToken.current) return
    const image = await renderRecapPoster(g, r)
    if (token !== renderToken.current) return
    if (alive.current) setPoster(image)
    // 图标都齐了才存，缺图标的下次打开再补画（文字内容来自存好的复盘，不会变）
    if (image && missing.every(iconIsCached)) void recapPosterSave(gameID, image)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const g = await archiveLoad(gameID).catch(() => null)
      const r = normalizeRecap(await recapLoad<unknown>(gameID).catch(() => null))
      if (cancelled) return
      setGame(g)
      setRecap(r)
      setLoaded(true)
      const saved = r ? await recapPosterLoad(gameID).catch(() => null) : null
      if (cancelled) return
      if (r && saved) setPoster(saved)
      else void renderPoster(g, r)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameID])

  const generate = async () => {
    if (!game) return
    const ctx = contextFromSave(game)
    setBusy(true)
    setErrorText('')
    setSavedMessage('')
    setStartedAt(Date.now())
    setProgress('正在思考…')
    try {
      const object = await aiRequestJSON(withHouseRules(recapSystem), recapUser(ctx), '正在写复盘…', setProgress)
      const result = recapFrom(object)
      setRecap(result)
      await recapSave(gameID, result)
      await recapPosterDelete(gameID)
      void renderPoster(game, result)
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    setBusy(false)
  }

  const fileName = () => `${game?.playName || '复盘'}-复盘.png`

  /** 保存图片：能调系统分享的设备（iPad、手机）弹出分享，里面有“存储图像”；电脑上直接下载 */
  const savePoster = async () => {
    if (!poster) return
    const file = new File([poster], fileName(), { type: 'image/png' })
    const touch = navigator.maxTouchPoints > 1
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        setSavedMessage('已保存到相册')
      } catch { /* 取消了 */ }
      return
    }
    downloadBlob(poster, fileName())
    setSavedMessage('已保存图片')
  }

  const sharePoster = async () => {
    if (!poster) return
    const file = new File([poster], fileName(), { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '复盘' }) } catch { /* 取消了 */ }
      return
    }
    // 不能分享文件的浏览器：复制到剪贴板，再不行就下载
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': poster })])
      setSavedMessage('已复制图片，可以粘贴发送')
    } catch {
      downloadBlob(poster, fileName())
      setSavedMessage('已保存图片')
    }
  }

  if (compact) {
    const dim = (pct: number) => `color-mix(in srgb, var(--ink) ${pct}%, transparent)`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px 0', flex: 1, minHeight: 0, background: 'var(--mainbg)', color: 'var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
            <div style={{ ...rounded(22, 900), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {game && game.playName !== '' ? game.playName : '复盘'}
            </div>
            {game ? (
              <div style={{ ...rounded(13), color: dim(60) }}>{`${game.playersAssignedCharacters.length} 人，还剩 ${game.aliveCount} 人活着`}</div>
            ) : null}
          </div>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="AI 设置"
            style={{
              width: 38, height: 38, borderRadius: '50%', border: '2.5px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <SFIcon name="gearshape" size={20} weight="bold" />
          </button>
          <button
            onClick={onClose}
            style={{ ...rounded(16, 900), color: 'var(--paper)', background: 'var(--ink)', padding: '0 18px', height: 38, borderRadius: 999, flexShrink: 0 }}
          >完成</button>
        </div>

        {game ? (
          <>
            <STChoiceRow<'timeline' | 'recap'> options={[['timeline', '时间线'], ['recap', 'AI 复盘']]} value={tab} onChange={setTab} />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
              {tab === 'timeline' ? (
                <>
                  {/* 座位一行左右滑 */}
                  <div className="scroll-hidden" style={{ overflowX: 'auto', background: 'var(--paper)', borderRadius: 14, border: '2.5px solid var(--ink)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, padding: 8, width: 'max-content' }}>
                      {game.playersAssignedCharacters.map((c, i) => {
                        const isAlive = i < game.playersIsAlive.length ? game.playersIsAlive[i] : true
                        return (
                          <div key={i} style={{ width: 52, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <CachedImage url={c.imageURL} size={34} style={{ opacity: isAlive ? 1 : 0.4 }} />
                            <div style={rounded(13, 900)}>{i + 1}</div>
                            <div style={{
                              ...rounded(13, 600), color: teamColor(c.team), maxWidth: '100%',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{c.name}</div>
                            {!isAlive ? (
                              <div style={{ position: 'absolute', top: 0, right: 0, color: 'var(--demonInk)' }}>
                                <SFIcon name="xmark" size={13} weight="black" />
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ background: 'var(--paper)', borderRadius: 16, border: '3px solid var(--ink)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 13, alignItems: 'flex-start' }}>
                      {ReviewBuilder.segments(game.allLogs).map((segment) => (
                        <div key={segment.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', width: '100%' }}>
                          <div style={{
                            ...rounded(17, 900), display: 'flex', alignItems: 'center', gap: 6,
                            color: segment.isNight ? 'var(--paper)' : 'var(--ink)', background: segment.isNight ? 'var(--ink)' : 'var(--paper)',
                            padding: '4px 11px', borderRadius: 999, border: '2px solid var(--ink)',
                          }}>
                            <SFIcon name={segment.isNight ? 'moon.fill' : segment.title === '开局' ? 'flag.fill' : 'sun.max.fill'} size={17} weight="black" />
                            <span>{segment.title}</span>
                          </div>
                          {segment.entries.length === 0 ? (
                            <div style={{ ...rounded(14), color: dim(40), paddingLeft: 8 }}>没有记录</div>
                          ) : null}
                          {segment.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="ai-select-text"
                              style={{
                                ...rounded(15, ReviewBuilder.isBold(entry) ? 700 : 400), color: ReviewBuilder.color(entry),
                                paddingLeft: 8, width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              }}
                            >{ReviewBuilder.text(entry)}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <STChoice selected={recap === null} onClick={generate} disabled={busy} style={{ opacity: busy ? 0.4 : 1 }}>
                      <span style={rounded(16, 700)}>{recap === null ? '生成复盘图' : '重新生成'}</span>
                    </STChoice>
                    {posterURL !== '' ? (
                      <>
                        <STChoice selected onClick={savePoster}>
                          <span style={rounded(16, 700)}>保存到相册</span>
                        </STChoice>
                        <button
                          onClick={sharePoster}
                          style={{ ...rounded(16, 700), color: 'var(--ink)', padding: '0 16px', minHeight: 40, borderRadius: 14, border: '2.5px solid var(--ink)' }}
                        >分享</button>
                      </>
                    ) : null}
                  </div>
                  {savedMessage !== '' ? <div style={{ ...rounded(14, 600), color: 'var(--ai-green)' }}>{savedMessage}</div> : null}
                  {busy ? <AIProgressLine since={startedAt} text={progress} /> : null}
                  {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
                  {posterURL !== '' ? (
                    // 长图按屏幕宽度缩放，跟着整页往下滑
                    <img
                      src={posterURL}
                      alt="复盘长图"
                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, border: '2px solid var(--ink)', flexShrink: 0 }}
                    />
                  ) : !busy && recap === null ? (
                    <div style={{ ...rounded(15), color: dim(45) }}>
                      让 AI 根据这一局的记录生成一张复盘长图，可以保存或发给玩家。
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </>
        ) : loaded ? (
          <div style={{ ...rounded(17), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>读取存档失败</div>
        ) : <div style={{ flex: 1 }} />}
        <AISettingsView open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 26, flex: 1, minHeight: 0, background: 'var(--mainbg)', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={rounded(30, 900)}>{game && game.playName !== '' ? game.playName : '复盘'}</div>
          {game ? (
            <div style={{ ...rounded(16), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>
              {`${game.playersAssignedCharacters.length} 人，还剩 ${game.aliveCount} 人活着`}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowSettings(true)} style={{ marginRight: 10, color: 'var(--ink)' }} aria-label="AI 设置">
          <SFIcon name="gearshape" size={24} weight="bold" />
        </button>
        <div style={{ flexShrink: 0 }}><STPageHeader title="" onClose={onClose} /></div>
      </div>

      {game ? (
        <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {/* 时间线 */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--paper)', borderRadius: 18, border: '3px solid var(--ink)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 18, alignItems: 'flex-start' }}>
              {ReviewBuilder.segments(game.allLogs).map((segment) => (
                <div key={segment.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', width: '100%' }}>
                  <div style={{
                    ...rounded(19, 900), display: 'flex', alignItems: 'center', gap: 8,
                    color: segment.isNight ? 'var(--paper)' : 'var(--ink)', background: segment.isNight ? 'var(--ink)' : 'var(--paper)',
                    padding: '5px 12px', borderRadius: 999, border: '2px solid var(--ink)',
                  }}>
                    <SFIcon name={segment.isNight ? 'moon.fill' : segment.title === '开局' ? 'flag.fill' : 'sun.max.fill'} size={19} weight="black" />
                    <span>{segment.title}</span>
                  </div>
                  {segment.entries.length === 0 ? (
                    <div style={{ ...rounded(15), color: 'color-mix(in srgb, var(--ink) 40%, transparent)', paddingLeft: 12 }}>没有记录</div>
                  ) : null}
                  {segment.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="ai-select-text"
                      style={{
                        ...rounded(16, ReviewBuilder.isBold(entry) ? 700 : 400), color: ReviewBuilder.color(entry),
                        paddingLeft: 12, width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}
                    >{ReviewBuilder.text(entry)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 座位和 AI 复盘 */}
          <div style={{ width: 430, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            <div className="scroll-hidden" style={{ overflowX: 'auto', background: 'var(--paper)', borderRadius: 14, border: '2.5px solid var(--ink)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, padding: 10, width: 'max-content' }}>
                {game.playersAssignedCharacters.map((c, i) => {
                  const isAlive = i < game.playersIsAlive.length ? game.playersIsAlive[i] : true
                  return (
                    <div key={i} style={{ width: 54, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <CachedImage url={c.imageURL} size={38} style={{ opacity: isAlive ? 1 : 0.4 }} />
                      <div style={rounded(13, 900)}>{i + 1}</div>
                      <div style={{
                        ...rounded(12, 600), color: teamColor(c.team), maxWidth: '100%',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{c.name}</div>
                      {!isAlive ? (
                        <div style={{ position: 'absolute', top: 0, right: 0, color: 'var(--demonInk)' }}>
                          <SFIcon name="xmark" size={13} weight="black" />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={rounded(22, 900)}>AI 复盘</div>
              <div style={{ flex: 1 }} />
              <STChoice selected={recap === null} onClick={generate} disabled={busy} style={{ opacity: busy ? 0.4 : 1 }}>
                <span style={rounded(16, 700)}>{recap === null ? '生成复盘图' : '重新生成'}</span>
              </STChoice>
            </div>
            {busy ? <AIProgressLine since={startedAt} text={progress} /> : null}
            {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
            {posterURL !== '' ? (
              <>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <img
                    src={posterURL}
                    alt="复盘长图"
                    style={{ width: '100%', display: 'block', borderRadius: 12, border: '2px solid var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <STChoice selected onClick={savePoster}>
                    <span style={rounded(16, 700)}>保存到相册</span>
                  </STChoice>
                  <button
                    onClick={sharePoster}
                    style={{ ...rounded(16, 700), color: 'var(--ink)', padding: '10px 16px', borderRadius: 14, border: '2.5px solid var(--ink)' }}
                  >分享</button>
                  {savedMessage !== '' ? <span style={{ ...rounded(15, 600), color: 'var(--ai-green)' }}>{savedMessage}</span> : null}
                </div>
              </>
            ) : !busy && recap === null ? (
              <>
                <div style={{ ...rounded(15), color: 'color-mix(in srgb, var(--ink) 45%, transparent)' }}>
                  让 AI 根据这一局的记录生成一张复盘长图，可以保存或发给玩家。
                </div>
                <div style={{ flex: 1 }} />
              </>
            ) : <div style={{ flex: 1 }} />}
          </div>
        </div>
      ) : loaded ? (
        <div style={{ ...rounded(18), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>读取存档失败</div>
      ) : <div style={{ flex: 1 }} />}
      <AISettingsView open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
