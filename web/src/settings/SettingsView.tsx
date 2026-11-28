// 设置页，对应 iPad 版 Settings/SettingsView.swift
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { showAlert } from '../ui/Alert'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'
import { rounded, STChoice, STChoiceRow, STPageHeader, STRow, STSection } from '../ui/kit'
import { AISettingsView } from '../ai/AISettingsView'
import { defaultNotepadTags, useSettings } from './store'
import { aiSettingsHint } from './aiHint'
import { clearIconCache, iconCacheUsage } from '../pwa'

/** 某个总条数下三种真假分法对应的真的条数：真的多一些、一半一半、假的多一些 */
function savantTruths(total: number): number[] {
  const half = Math.floor(total / 2)
  const step = Math.max(1, Math.floor(total / 8))
  return [Math.min(total - 1, half + step), half, Math.max(1, half - step)]
}

const set = useSettings.getState().set

/** 卡片布局的小示意图：每行 n 张 */
function CardLayoutPreview({ perRow, selected, width = 96 }: { perRow: number; selected: boolean; width?: number }) {
  const ink = selected ? 'var(--paper)' : 'var(--ink)'
  const gap = width < 96 ? 3 : 4
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap }}>
      {[0, 1].map((r) => (
        <div key={r} style={{ display: 'flex', gap }}>
          {Array.from({ length: perRow }, (_, i) => (
            <div key={i} style={{ flex: 1, height: width < 96 ? 16 : 22, borderRadius: 3, background: ink, opacity: 0.85 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

const label17 = rounded(17, 700)
const fieldBg = 'color-mix(in srgb, var(--mainbg) 50%, transparent)'

export function SettingsView({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <SettingsContent onClose={onClose} /> : null}
    </Sheet>
  )
}

function SettingsContent({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const compact = useCompact()
  const [showAISettings, setShowAISettings] = useState(false)
  const [aiHint, setAIHint] = useState(aiSettingsHint)
  const [newTag, setNewTag] = useState('')
  const [iconCacheSize, setIconCacheSize] = useState({ bytes: 0, count: 0 })

  const refreshIconCache = () => { void iconCacheUsage().then(setIconCacheSize) }
  useEffect(refreshIconCache, [])

  const addTag = () => {
    const tag = newTag.trim()
    const tags = useSettings.getState().notepadTags
    if (tag && !tags.includes(tag)) set('notepadTags', [...tags, tag])
    setNewTag('')
  }

  const t = savantTruths(s.savantBatchTotal)
  const savantTrueOptions: [number, string][] = [[t[0], '真的多一些'], [t[1], '一半一半'], [t[2], '假的多一些']]

  return (
    <div style={{ flex: 1, minHeight: 0, padding: compact ? '12px 16px 0' : 28, display: 'flex', flexDirection: 'column', gap: compact ? 12 : 18 }}>
      <STPageHeader title="设置" onClose={onClose} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: compact ? 'hidden' : undefined }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 22 : 28, paddingBottom: 30 }}>
          <STSection title="外观">
            <STRow title="深色模式" hint={s.appearance === 'game' ? '入夜自动变深色，天亮变回浅色' : ''}>
              <STChoiceRow<'light' | 'dark' | 'game'>
                options={[['light', '浅色'], ['dark', '深色'], ['game', '跟随昼夜']]}
                value={s.appearance}
                onChange={(v) => set('appearance', v)}
              />
            </STRow>
          </STSection>

          <STSection title="玩家卡片">
            <STRow title="摆法">
              <STChoiceRow options={[[false, '网格'], [true, '圆桌']]} value={s.circleLayout} onChange={(v) => set('circleLayout', v)} />
            </STRow>
            {/* 手机上卡片固定两列，不显示这一项 */}
            {!s.circleLayout && !compact ? (
              <STRow title="每行几张">
                {/* 手机上四个选项平分一行，示意图缩小 */}
                <div style={{ display: 'flex', gap: compact ? 6 : 12 }}>
                  {[2, 3, 4, 5].map((n) => (
                    <STChoice
                      key={n}
                      selected={s.cardsPerRow === n}
                      onClick={() => set('cardsPerRow', n)}
                      style={compact ? { flex: '1 1 0', minWidth: 0, padding: '6px 4px' } : undefined}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 6 : 8, padding: '4px 0' }}>
                        <CardLayoutPreview perRow={n} selected={s.cardsPerRow === n} width={compact ? 48 : 96} />
                        <span style={rounded(compact ? 15 : 16, 700)}>{n} 张</span>
                      </div>
                    </STChoice>
                  ))}
                </div>
              </STRow>
            ) : null}
            <STRow title="字号">
              <div style={{ display: 'flex', gap: compact ? 8 : 10, flexWrap: compact ? 'wrap' : undefined }}>
                {([[0.85, '小'], [1.0, '中'], [1.15, '大']] as const).map(([scale, name]) => (
                  <STChoice key={name} selected={s.cardFontScale === scale} onClick={() => set('cardFontScale', scale)}>
                    <span style={{ ...rounded(17 * scale, 700), whiteSpace: 'pre' }}>{`${name}  占卜师`}</span>
                  </STChoice>
                ))}
              </div>
            </STRow>
          </STSection>

          <STSection title="死亡和复活">
            <STRow title="点号码切换死亡、复活前先确认">
              <STChoiceRow options={[[true, '要确认'], [false, '不用']]} value={s.confirmDeath} onChange={(v) => set('confirmDeath', v)} />
            </STRow>
            <STRow title="死亡、复活、删标签后显示撤销">
              <STChoiceRow options={[[true, '显示'], [false, '不用']]} value={s.undoEnabled} onChange={(v) => set('undoEnabled', v)} />
            </STRow>
          </STSection>

          <STSection title="带局习惯">
            <STRow title="新开一局时预设几名玩家">
              <div className="scroll-hidden" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 8, padding: 2, width: 'max-content' }}>
                  <STChoice selected={s.defaultPlayerCount === 0} onClick={() => set('defaultPlayerCount', 0)}>
                    <span style={label17}>不预设</span>
                  </STChoice>
                  {Array.from({ length: 11 }, (_, i) => i + 5).map((n) => (
                    <STChoice key={n} selected={s.defaultPlayerCount === n} onClick={() => set('defaultPlayerCount', n)}>
                      <span style={{ ...label17, display: 'inline-block', minWidth: 22, textAlign: 'center' }}>{n}</span>
                    </STChoice>
                  ))}
                </div>
              </div>
            </STRow>
            <STRow title="记事本常用词">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {s.notepadTags.map((tag) => (
                  <div key={tag} style={{
                    display: 'flex', alignItems: 'center', gap: compact ? 0 : 6, padding: compact ? '0 0 0 10px' : '4px 8px',
                    borderRadius: 10, border: '2px solid var(--ink)',
                  }}>
                    <span style={rounded(compact ? 16 : 17, 600)}>{tag}</span>
                    <button
                      onClick={() => set('notepadTags', useSettings.getState().notepadTags.filter((x) => x !== tag))}
                      // 手机上叉号的点击区域放大到 36
                      style={compact
                        ? { color: 'var(--ink)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }
                        : { color: 'var(--ink)' }}
                      aria-label={`删掉${tag}`}
                    >
                      <SFIcon name="xmark" size={12} weight="black" />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: compact ? 'wrap' : undefined }}>
                <input
                  value={newTag}
                  placeholder="加一个常用词"
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag() }}
                  style={{
                    ...rounded(17), flex: compact ? '1 1 0' : '1 1 320px', minWidth: 0, maxWidth: compact ? undefined : 320, padding: 8, outline: 'none',
                    background: fieldBg, borderRadius: 12, border: '2px solid var(--ink)',
                  }}
                />
                <STChoice selected onClick={addTag}>
                  <span style={label17}>添加</span>
                </STChoice>
                {compact ? null : <div style={{ flex: 1 }} />}
                <button
                  onClick={() => showAlert({
                    title: '恢复成默认的常用词吗？',
                    message: '你加过的词会被删掉。',
                    buttons: [
                      { label: '取消', role: 'cancel' },
                      { label: '恢复', role: 'destructive', action: () => set('notepadTags', defaultNotepadTags) },
                    ],
                  })}
                  style={{
                    ...rounded(16, 600), color: 'color-mix(in srgb, var(--ink) 60%, transparent)',
                    ...(compact ? { minHeight: 36, padding: '0 4px' } : null),
                  }}
                >恢复默认</button>
              </div>
            </STRow>
          </STSection>

          <STSection title="AI">
            <STRow title="提供商、Key 和模型" hint={aiHint}>
              <div style={{ display: 'flex' }}>
                <STChoice selected={false} onClick={() => setShowAISettings(true)}>
                  <span style={label17}>打开 AI 设置</span>
                </STChoice>
              </div>
            </STRow>
            <STRow title="本店规矩">
              <HouseRulesEditor value={s.houseRules} onChange={(v) => set('houseRules', v)} />
            </STRow>
            <STRow title="“一批博学者信息”一次给几条">
              <STChoiceRow
                options={[[8, '8 条'], [14, '14 条'], [20, '20 条']]}
                value={s.savantBatchTotal}
                onChange={(total) => {
                  // 换总条数时保持同一种真假分法
                  const st = useSettings.getState()
                  const mode = Math.max(0, savantTruths(st.savantBatchTotal).indexOf(st.savantBatchTrue))
                  set('savantBatchTotal', total)
                  set('savantBatchTrue', savantTruths(total)[mode])
                }}
              />
            </STRow>
            <STRow title="其中真假怎么分" hint={`现在是 ${s.savantBatchTrue} 条真的、${s.savantBatchTotal - s.savantBatchTrue} 条假的。`}>
              <STChoiceRow options={savantTrueOptions} value={s.savantBatchTrue} onChange={(v) => set('savantBatchTrue', v)} />
            </STRow>
          </STSection>

          <STSection title="存储">
            <STRow
              title="图标缓存"
              hint={iconCacheSize.count === 0 ? '空' : `${iconCacheSize.count} 个图标，${(iconCacheSize.bytes / 1_048_576).toFixed(1)} MB`}
            >
              <div style={{ display: 'flex' }}>
                <STChoice
                  selected={false}
                  disabled={iconCacheSize.count === 0}
                  onClick={() => showAlert({
                    title: '清除图标缓存吗？',
                    message: '清除后，没网时图标会显示成问号，下次有网开局时会重新下载。',
                    buttons: [
                      { label: '取消', role: 'cancel' },
                      { label: '清除', role: 'destructive', action: () => { void clearIconCache().then(refreshIconCache) } },
                    ],
                  })}
                >
                  <span style={label17}>清除</span>
                </STChoice>
              </div>
            </STRow>
          </STSection>
        </div>
      </div>
      <AISettingsView open={showAISettings} onClose={() => { setShowAISettings(false); setAIHint(aiSettingsHint()) }} />
    </div>
  )
}

/** 本店规矩的多行输入框，随内容变高，最矮 110 */
function HouseRulesEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(110, el.scrollHeight + 4)}px`
  }, [value])
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...rounded(17), display: 'block', width: '100%', minHeight: 110, resize: 'none', overflow: 'hidden', outline: 'none',
          padding: '14px 11px', lineHeight: 1.3, background: fieldBg, borderRadius: 12, border: '2px solid var(--ink)',
        }}
      />
      {value === '' ? (
        <div style={{
          ...rounded(17), lineHeight: 1.3, position: 'absolute', left: 0, top: 0, padding: '16px 13px', pointerEvents: 'none',
          color: 'color-mix(in srgb, var(--ink) 35%, transparent)',
        }}>比如：邪恶玩家伪装成某个角色来问信息，说书人照样给。</div>
      ) : null}
    </div>
  )
}
