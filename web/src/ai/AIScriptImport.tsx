// 根据剧本图片生成 JSON。对应 iPad 版 AI/AIScriptImportView.swift
import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { AIError, aiErrorText, aiExtractJSON, aiSendStreaming, chatMessage } from './client'
import { scriptImportSystem, scriptImportUser, scriptRefineSystem, scriptRefineUser } from './prompts'
import { AIPanelHeader, AIPillButton, AIPillLabel, AITextField, Spinner, aiPanelStyle, downloadBlob, isObject, strings, str } from './common'
import { aiPrepareImage, applyPatch, compactJSON, fillIcons, isCharacter, type ScriptItem } from './scriptTools'

export function AIScriptImport({ open, onClose, onEnter }: { open: boolean; onClose: () => void; onEnter: (items: Record<string, unknown>[]) => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <ImportBody onClose={onClose} onEnter={onEnter} /> : null}
    </Sheet>
  )
}

function ImportBody({ onClose, onEnter }: { onClose: () => void; onEnter: (items: Record<string, unknown>[]) => void }) {
  const [image, setImageFile] = useState<File | null>(null)
  const [imageURL, setImageURL] = useState('')
  const [imageJPEG, setImageJPEG] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [errorText, setErrorText] = useState('')
  const [script, setScript] = useState<ScriptItem[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [missingIcons, setMissingIcons] = useState<string[]>([])
  const [lastChange, setLastChange] = useState('')
  const [reply, setReply] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (imageURL) URL.revokeObjectURL(imageURL) }, [imageURL])

  const scriptName = (() => {
    const meta = script.find((it) => it.id === '_meta')
    const name = str(meta?.name)
    return name === '' ? '剧本' : name
  })()

  const count = (team: string) => script.filter((it) => it.team === team).length

  const countsLine = (() => {
    const parts = [`镇民 ${count('townsfolk')}`, `外来者 ${count('outsider')}`, `爪牙 ${count('minion')}`, `恶魔 ${count('demon')}`]
    if (count('fabled') > 0) parts.push(`传奇 ${count('fabled')}`)
    return parts.join(' · ')
  })()

  const nightOrder = (key: string) => {
    const acting: [number, string][] = []
    for (const it of script) {
      const value = typeof it[key] === 'number' ? (it[key] as number) : 0
      if (value > 0 && typeof it.name === 'string') acting.push([value, it.name])
    }
    const names = acting.sort((a, b) => a[0] - b[0]).map((a) => a[1])
    return names.length === 0 ? '无' : names.join(' → ')
  }

  const setImage = (picked: File) => {
    setImageFile(picked)
    setImageURL(URL.createObjectURL(picked))
    setImageJPEG(null)
    setScript([])
    setNotes([])
    setMissingIcons([])
    setLastChange('')
    setErrorText('')
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f && (f.type.startsWith('image/') || f.type === '')) setImage(f)
  }

  const generate = async () => {
    const jpeg = image ? await aiPrepareImage(image) : null
    if (!jpeg) {
      setErrorText('请先选择一张剧本图片。')
      return
    }
    setImageJPEG(jpeg)
    setBusy(true)
    setErrorText('')
    setProgress('正在读图…')
    setScript([])
    setNotes([])
    setLastChange('')
    try {
      const answer = await aiSendStreaming({
        system: scriptImportSystem,
        messages: [chatMessage('user', scriptImportUser(''))],
        imageJPEG: jpeg, maxTokens: 32000, effort: 'low',
        onProgress: (partial) => {
          const found = partial.split('"ability"').length - 1
          setProgress(found > 0 ? `已写出 ${found} 个角色…` : '正在读图…')
        },
      })
      const parsed = aiExtractJSON(answer)
      let items: ScriptItem[] = []
      let parsedNotes: string[] = []
      if (isObject(parsed)) {
        items = (Array.isArray(parsed.script) ? parsed.script : []).filter(isObject)
        parsedNotes = strings(parsed.notes)
      } else if (Array.isArray(parsed)) {
        items = parsed.filter(isObject)
      }
      if (items.filter(isCharacter).length === 0) {
        throw new AIError('badFormat', '没有读出任何角色，请换一张更清晰的图片或换一个模型。')
      }
      setMissingIcons(fillIcons(items))
      setScript(items)
      setNotes(parsedNotes.slice(0, 5))
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    setBusy(false)
    setProgress('')
  }

  const refine = async () => {
    const instruction = reply.trim()
    if (instruction === '' || busy || script.length === 0) return
    setBusy(true)
    setErrorText('')
    setProgress('正在修改…')
    const current = script
    const pending = notes
    try {
      const answer = await aiSendStreaming({
        system: scriptRefineSystem,
        messages: [chatMessage('user', scriptRefineUser(compactJSON(current), pending, instruction))],
        imageJPEG, maxTokens: 16000, effort: 'low',
        onProgress: () => {},
      })
      const patch = aiExtractJSON(answer)
      if (!isObject(patch)) throw new AIError('badFormat', '不是 JSON')
      const items = current.map((it) => ({ ...it }))
      const changed = applyPatch(patch, items)
      setMissingIcons(fillIcons(items))
      setScript(items)
      setNotes(strings(patch.notes).slice(0, 5))
      const summary = str(patch.summary)
      setLastChange(summary === '' ? `改了 ${changed} 处` : summary)
      setReply('')
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    setBusy(false)
    setProgress('')
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${scriptName}.json`)
  }

  return (
    <div style={aiPanelStyle(14)}>
      <AIPanelHeader title="图片生成剧本" onClose={onClose} />
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        {/* 左边：图片和选图按钮 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            flex: 1, minHeight: 0, position: 'relative', background: 'var(--paper)', borderRadius: 14, border: '3px solid var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {imageURL ? (
              <img src={imageURL} alt="" draggable={false} style={{ position: 'absolute', inset: 6, width: 'calc(100% - 12px)', height: 'calc(100% - 12px)', objectFit: 'contain' }} />
            ) : (
              <span style={{ ...rounded(18), color: 'var(--ai-secondary)' }}>选择一张剧本图片</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => photoInput.current?.click()}><AIPillLabel text="从相册选" /></button>
            <button onClick={() => fileInput.current?.click()}><AIPillLabel text="从文件选" /></button>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPick} />
            <input ref={fileInput} type="file" accept="image/*,.heic,.heif" hidden onChange={onPick} />
          </div>
        </div>

        {/* 右边：生成、结果、修改 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AIPillButton text={script.length === 0 ? '生成剧本' : '整份重新生成'} filled={script.length === 0} onClick={generate} disabled={busy || image === null} />
            {busy ? (
              <>
                <Spinner />
                <span style={rounded(16, 600)}>{progress}</span>
              </>
            ) : null}
          </div>
          {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
          {script.length > 0 ? (
            <>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <div style={rounded(20, 900)}>{scriptName}</div>
                  <div style={{ ...rounded(15, 600), color: 'var(--ai-secondary)' }}>{countsLine}</div>
                  {lastChange !== '' ? <div style={{ ...rounded(15, 600), color: 'var(--ai-green)' }}>{`已修改：${lastChange}`}</div> : null}
                  {notes.length === 0 ? (
                    <div style={{ ...rounded(16), paddingTop: 4 }}>没有需要确认的地方。</div>
                  ) : (
                    <>
                      <div style={{ ...rounded(16, 700), paddingTop: 4 }}>需要你确认（点一下可以直接回复）</div>
                      {notes.map((note, i) => (
                        <button
                          key={i}
                          onClick={() => setReply(`关于“${note}”：`)}
                          style={{
                            ...rounded(16), color: 'var(--ink)', textAlign: 'left', width: '100%', padding: 8,
                            background: 'var(--paper)', borderRadius: 10, border: '2px solid var(--ink)',
                          }}
                        >{`${i + 1}. ${note}`}</button>
                      ))}
                    </>
                  )}
                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    style={{ ...rounded(15, 600), color: 'var(--ai-secondary)', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 4 }}
                  >
                    <SFIcon name={showDetails ? 'chevron.down' : 'chevron.right'} size={14} weight="semibold" />
                    <span>夜晚顺序和图标</span>
                  </button>
                  {showDetails ? (
                    <>
                      <div style={rounded(15)}>{`首夜：${nightOrder('firstNight')}`}</div>
                      <div style={rounded(15)}>{`其他夜晚：${nightOrder('otherNight')}`}</div>
                      <div style={rounded(15)}>{missingIcons.length === 0 ? '所有角色都有图标。' : `没有图标：${missingIcons.join('、')}`}</div>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AITextField
                  value={reply}
                  onChange={setReply}
                  placeholder="回复 AI 或者提修改，比如：作者是某某；把第二个爪牙的能力改成…"
                  maxLines={3}
                  fontSize={16}
                  onSubmit={refine}
                />
                <AIPillButton text="修改" onClick={refine} disabled={busy || reply.trim() === ''} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <AIPillButton
                  text="进入小镇"
                  filled
                  disabled={busy}
                  onClick={() => {
                    const items = script
                    onClose()
                    onEnter(items)
                  }}
                />
                <AIPillButton text="保存 JSON" onClick={exportJSON} disabled={busy} />
              </div>
            </>
          ) : <div style={{ flex: 1 }} />}
        </div>
      </div>
    </div>
  )
}
