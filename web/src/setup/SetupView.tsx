// 说书人配版 + 玩家开抽的全屏流程，对应 SubViews/setup/SetupView.swift。
// selectionState：0/3/6/9 选数量，1/4/7/10 玩家盲选，2/5/8/11 检查，12 玩家开抽（状态在 flowState.ts）
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AISetupSheet } from '../ai/AISetupSheet'
import { game, setGame, useGame } from '../game/store'
import { HeaderButton, MobilePage } from '../mobile/MobilePage'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { usePresence } from './cards'
import { ExtraSetupForSetup } from './ExtraSetupForSetup'
import { fillSetupBag, startSetupFlow, teamNames, useSetupFlow } from './flowState'
import { SetupBlindPick } from './SetupBlindPick'
import { SetupCheck } from './SetupCheck'
import { SetupCount } from './SetupCount'
import { SetupPlayerPick } from './SetupPlayerPick'

type Kind = 'count' | 'blind' | 'check' | 'pick'
const kinds: Kind[] = ['count', 'blind', 'check', 'pick']
const kindOf = (s: number): Kind => (s >= 12 ? 'pick' : (['count', 'blind', 'check'] as const)[((s % 3) + 3) % 3])

/** 换步骤时新的一页淡入、旧的一页淡出（.animation(.easeInOut(duration: 0.5), value: selectionState)） */
function Layer({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setEntered(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [])
  return (
    <div style={{
      position: 'absolute', inset: 0, isolation: 'isolate', opacity: visible && entered ? 1 : 0, transition: 'opacity .5s ease-in-out',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {children}
    </div>
  )
}

/** 手机标题栏上写现在是哪一步 */
function phoneTitle(stage: number) {
  const kind = kindOf(stage)
  const team = teamNames[Math.min(Math.max(Math.floor(stage / 3), 0), 3)]
  return kind === 'count' ? `${team}数量` : kind === 'blind' ? `${team}盲选` : kind === 'check' ? '检查配置' : '玩家开抽'
}

function StagePage({ kind, stage }: { kind: Kind; stage: number }) {
  const compact = useCompact()
  // 手机：一页一列，操作条在各页自己的底部
  if (compact) {
    switch (kind) {
      case 'count':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div className="scroll-hidden" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ margin: 'auto 0', padding: '20px 0' }}>
                <SetupCount stage={stage} />
              </div>
            </div>
            <ExtraSetupForSetup />
          </div>
        )
      case 'blind':
        return <SetupBlindPick stage={stage} />
      case 'check':
        return <SetupCheck />
      case 'pick':
        return <SetupPlayerPick />
    }
  }
  switch (kind) {
    case 'count':
      return (
        <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SetupCount stage={stage} />
          </div>
          <ExtraSetupForSetup />
        </div>
      )
    case 'blind':
      return <SetupBlindPick stage={stage} />
    case 'check':
      return (
        <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
          <SetupCheck />
          <ExtraSetupForSetup />
        </div>
      )
    case 'pick':
      return <SetupPlayerPick />
  }
}

/** 当前这一页和正在淡出的上一页。同一种页面一直是同一个组件，淡出的那页停在离开时的阶段号 */
function SetupStages() {
  const stage = useSetupFlow((s) => s.selectionState)
  const kind = kindOf(stage)
  const [layers, setLayers] = useState<{ cur: { kind: Kind; stage: number }; leaving: { kind: Kind; stage: number } | null }>(
    { cur: { kind, stage }, leaving: null },
  )
  if (layers.cur.kind !== kind || layers.cur.stage !== stage) {
    setLayers({ cur: { kind, stage }, leaving: layers.cur.kind !== kind ? layers.cur : layers.leaving })
  }
  const leaving = layers.leaving
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setLayers((l) => (l.leaving === leaving ? { ...l, leaving: null } : l)), 500)
    return () => window.clearTimeout(t)
  }, [leaving])

  return (
    <>
      {kinds.map((k) => {
        if (k === kind) return <Layer key={k} visible><StagePage kind={k} stage={stage} /></Layer>
        if (leaving && leaving.kind === k) return <Layer key={k} visible={false}><StagePage kind={k} stage={leaving.stage} /></Layer>
        return null
      })}
    </>
  )
}

function SetupFlow() {
  const playableCharacters = useGame((s) => s.playableCharacters)
  const playerCount = useGame((s) => s.playerCount)
  const stage = useSetupFlow((s) => s.selectionState)
  const aiButton = usePresence(stage < 12, 500)
  const [ready, setReady] = useState(false)
  const [showAISetup, setShowAISetup] = useState(false)
  // 从主界面点“AI 配版”进来时，直接弹出 AI 配版
  const openAIOnAppear = useRef(game().openAISetupOnAppear)

  // onAppear：洗牌，清空选择
  useLayoutEffect(() => {
    startSetupFlow()
    setReady(true)
  }, [])
  useEffect(() => {
    if (!openAIOnAppear.current) return
    setGame({ openAISetupOnAppear: false })
    const t = window.setTimeout(() => setShowAISetup(true), 600)
    return () => window.clearTimeout(t)
  }, [])

  const compact = useCompact()
  const aiSheet = (
    <AISetupSheet
      open={showAISetup}
      onClose={() => setShowAISetup(false)}
      playableCharacters={playableCharacters}
      playerCount={playerCount}
      onApply={(bag, notes) => { setShowAISetup(false); fillSetupBag(bag, notes) }}
    />
  )

  // 手机：整屏一页，标题栏写第几步，右上 AI 配版和 ✕（✕ 就是“退出”）
  if (compact) {
    return (
      <>
        <MobilePage
          title={phoneTitle(stage)}
          onClose={() => setGame({ showSetup: false })}
          zIndex={117}
          scroll={false}
          right={stage < 12 ? <HeaderButton icon="sparkles" label="AI配版" onClick={() => setShowAISetup(true)} /> : null}
          bodyStyle={{ paddingBottom: 0, paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
        >
          <div className="dot-bg" style={{ position: 'relative', flex: '1 1 0', minHeight: 0, lineHeight: 1.2 }}>
            {ready ? <SetupStages /> : null}
          </div>
        </MobilePage>
        {aiSheet}
      </>
    )
  }

  return (
    <div className="dot-bg" style={{ position: 'absolute', inset: 0, color: 'var(--ink)', lineHeight: 1.2 }}>
      <div style={{
        position: 'absolute', inset: 0,
        // 和小镇一样按 iPad 横屏的安全区留出上下（模拟器量的：上 32、下 25）
        padding: 'max(32px, env(safe-area-inset-top)) env(safe-area-inset-right) max(25px, env(safe-area-inset-bottom)) env(safe-area-inset-left)',
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {ready ? <SetupStages /> : null}
          {aiButton.mounted ? (
            <button
              onClick={() => setShowAISetup(true)}
              style={{
                position: 'absolute', top: 18.5, left: 18.5, zIndex: 5,
                display: 'flex', alignItems: 'center', gap: 6, ...rounded(20, 700), color: 'var(--ink)',
                padding: '10.5px 16.5px', background: 'var(--paper)', borderRadius: 30, border: '3px solid var(--ink)',
                opacity: aiButton.shown ? 1 : 0, transition: 'opacity .5s ease-in-out',
                pointerEvents: stage < 12 ? 'auto' : 'none',
              }}
            >
              <SFIcon name="sparkles" size={20} weight="bold" />
              <span>AI 配版</span>
            </button>
          ) : null}
        </div>
      </div>
      {aiSheet}
    </div>
  )
}

/** useGame 的 showSetup 为真时盖住整个小镇（iPad 版 zIndex 17），出现消失都淡入淡出 */
export function SetupView() {
  const showSetup = useGame((s) => s.showSetup)
  const p = usePresence(showSetup, 500)
  const compact = useCompact()
  if (!p.mounted) return null
  // 手机上 SetupFlow 自己是全屏的一页（zIndex 117），外面这层不起作用；还是同一个外层，屏幕宽窄变了也不会重新洗牌
  return (
    <div style={compact ? { display: 'contents' } : {
      position: 'fixed', inset: 0, zIndex: 17, opacity: p.shown ? 1 : 0, transition: 'opacity .5s ease-in-out',
      pointerEvents: showSetup ? 'auto' : 'none',
    }}>
      <SetupFlow />
    </div>
  )
}
