// 小镇（主界面），对应 iPad 版 StoryTellerView.swift
import { useEffect, useLayoutEffect } from 'react'
import { warmIcons } from '../ui/iconData'
import { useNav } from '../nav'
import { initialGameState, setGame, useGame } from '../game/store'
import { defaultCharacter } from '../game/types'
import { loadGameData } from '../game/loadScript'
import { DemoTour } from '../tutorial/DemoTour'
import { applySaveData, archiveLoad, loadLastGame, makeSaveData, saveGame, saveLastGame, shouldArchive } from '../game/persistence'
import { clearUndo } from '../game/undo'
import { settings, useSettings } from '../settings/store'
import { showAlert } from '../ui/Alert'
import { rounded } from '../ui/kit'
import { MenuView } from '../town/MenuView'
import { SubMenuView } from '../town/SubMenuView'
import { PlayersView } from '../town/PlayersView'
import { FabledListView } from '../town/FabledListView'
import { TimerView } from '../town/TimerView'
import { FakeCover } from '../town/FakeCover'
import { PlayInfo, SurvivorInfo, TeamActualInfo, TeamInfo } from '../town/Infos'
import { UndoToast } from '../town/UndoToast'
import { CharacterSelection } from '../overlays/CharacterSelection'
import { TagPicker } from '../overlays/TagPicker'
import { Notepad } from '../overlays/Notepad'
import { Conversation } from '../overlays/Conversation'
import { AllCharacterInfos } from '../overlays/AllCharacterInfos'
import { FabledSelection } from '../overlays/FabledSelection'
import { OrderView } from '../panels/OrderView'
import { VotingView } from '../panels/VotingView'
import { ExtraCareView } from '../panels/ExtraCareView'
import { ExtraSetup } from '../panels/ExtraSetup'
import { SetupView } from '../setup/SetupView'
import { SettingsView } from '../settings/SettingsView'
import { ArchiveView } from '../settings/ArchiveView'
import { AIAdvisor, resetAIChat } from '../ai/AIAdvisor'
import { AIPostDrawSheet } from '../ai/AIPostDrawSheet'
import { uuid } from '../game/uuid'
import { useCompact } from '../ui/compact'
import { MobileTown } from '../mobile/MobileTown'
import { RoomPanel } from '../online/RoomPanel'
import { resumeHost, stopHost } from '../net/host'

/**
 * iPad Pro 11 寸横屏（iPadOS 26）的状态栏和底部横条留出的位置，界面和 iPad 上一样不顶到上下边。
 * 量的是模拟器里描边的外沿：上 31.5、下 809（iPad 的描边一半在框外，所以比安全区数值各差 1.5）
 */
const SAFE_TOP = 32
const SAFE_BOTTOM = 25

const townCSS = `
@keyframes st-submenu-in { from { opacity: 0; transform: scale(.9) } to { opacity: 1; transform: none } }
@keyframes st-toast-in { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: none } }
@keyframes st-slide-in { from { transform: translateX(100%) } to { transform: none } }
`

/** 框：圆角 10、3 粗的描边，很多块都这样 */
// iPad 的描边是 .overlay(stroke)：压在边框线上、一半在外，不占里面的位置
const box: React.CSSProperties = { background: 'var(--mainbg)', borderRadius: 10, outline: '3px solid var(--ink)', outlineOffset: -1.5, overflow: 'hidden' }

/** ZStack 里盖在上面的一层，和 iPad 一样居中摆放，空白处不挡点击 */
function Layer({ z, children }: { z: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: z, display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', animation: 'st-fade .3s ease-in-out',
    }}>
      <div style={{ display: 'contents', pointerEvents: 'auto' }}>{children}</div>
    </div>
  )
}

const setupButton = (width: number, marginLeft = 0): React.CSSProperties => ({
  ...rounded(20, 700), lineHeight: '24px', color: 'var(--ink)', width, padding: '19px 0', marginLeft,
  // 描边是 overlay，压在边上不占位置（按钮高 62，不是 68）
  background: 'var(--mainbg)', borderRadius: 30, outline: '3px solid var(--ink)', outlineOffset: -1.5, textAlign: 'center', flexShrink: 0,
})

const everyoneHasCharacter = (names: { name: string }[]) => names.length > 0 && names.every((c) => c.name !== '')
const nameKey = (s: { playersAssignedCharacters: { name: string }[] }) => s.playersAssignedCharacters.map((c) => c.name).join('\u0000') + `#${s.playersAssignedCharacters.length}`

const prefetched = new Set<string>()
function prefetchImages(urls: string[]) {
  for (const url of urls) {
    if (!url || prefetched.has(url)) continue
    prefetched.add(url)
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.src = url
  }
}

const errorAlert = (message: string) => showAlert({ title: '错误', message, buttons: [{ label: '确定' }] })

/** 载入另一局：先保存当前这一局，再重新打开小镇 */
async function loadArchive(id: string) {
  saveGame()
  const data = await archiveLoad(id)
  if (!data) {
    errorAlert('读取存档失败。')
    return
  }
  useNav.setState({ loadLast: true, viewNumber: 0 })
  // 离开小镇时会再存一次当前这一局，等它存完再写入要载入的那一局
  window.setTimeout(() => {
    saveLastGame(data)
    useNav.setState({ viewNumber: 1 })
  }, 600)
}

function confirmExit() {
  showAlert({
    title: '确定离开当前城镇吗？',
    message: shouldArchive(makeSaveData()) ? '这一局已经存进存档，可以在存档里载入' : '还没分好角色，这个城镇不会保存',
    buttons: [
      { label: '取消', role: 'cancel' },
      { label: '确定', role: 'destructive', action: () => { useSettings.getState().set('gameIsNight', false); useNav.setState({ viewNumber: 0, demo: false }) } },
    ],
  })
}

/** 进小镇：读新剧本，或者载入上一局 */
function initTown() {
  const nav = useNav.getState()
  const base = { ...initialGameState, predefinedTags: settings().notepadTags }
  if (!nav.loadLast) {
    const loaded = loadGameData(nav.playJSON)
    // 按设置预设玩家人数
    const count = settings().defaultPlayerCount
    const seats = count > 0 ? {
      playerCount: count,
      aliveCount: count,
      playersAssignedCharacters: Array.from({ length: count }, () => defaultCharacter),
      playersStates: Array.from({ length: count }, () => []),
      playersIsAlive: Array.from({ length: count }, () => true),
      playersHasDeathVote: Array.from({ length: count }, () => true),
    } : {}
    // 新手教程的演示小镇用固定的 gameID，saveGame 看到它就不存，不会盖掉你的上一局
    setGame({ ...base, ...loaded, ...seats, gameID: nav.demo ? 'demo' : uuid() })
    if (loaded.alertMessage) errorAlert(loaded.alertMessage)
  } else {
    setGame(base)
    const raw = (() => { try { return localStorage.getItem('SavedGameState') } catch { return null } })()
    const data = loadLastGame()
    if (data) applySaveData(data)
    else errorAlert(raw ? '读取存档失败。' : '没有找到存档。')
  }
}

export function TownScreen() {
  const gameState = useGame((s) => s.gameState)
  const gameID = useGame((s) => s.gameID)
  const cardsPerRow = useSettings((s) => s.cardsPerRow)
  const demo = useNav((s) => s.demo)
  const selectNewCharacter = useGame((s) => s.selectNewCharacter)
  const showMenu = useGame((s) => s.showMenu)
  const selectNewReminder = useGame((s) => s.selectNewReminder)
  const showNotepad = useGame((s) => s.showNotepad)
  const showConversation = useGame((s) => s.showConversation)
  const showAllCharacterInfos = useGame((s) => s.showAllCharacterInfos)
  const showFabledCharactersSelection = useGame((s) => s.showFabledCharactersSelection)
  const showSetup = useGame((s) => s.showSetup)
  const characters = useGame((s) => s.characters)
  // 生成长图、复盘图时要把图标画进去：进小镇就在后台把这个剧本的图标取好（ui/iconData.ts）
  useEffect(() => { warmIcons(characters.map((c) => c.imageURL)) }, [characters])
  const showSettings = useGame((s) => s.showSettings)
  const showArchive = useGame((s) => s.showArchive)
  const showAIAdvisor = useGame((s) => s.showAIAdvisor)
  const showAIPostDraw = useGame((s) => s.showAIPostDraw)
  const compact = useCompact()

  // onAppear / onDisappear，以及各种时候存档
  useLayoutEffect(() => {
    initTown()
    // 说书人联机：这一局开过房间就连回去
    resumeHost()
    const s0 = useGame.getState()
    settings().set('gameIsNight', s0.gameState === 1 || s0.gameState === 3)
    prefetchImages([...s0.characters.map((c) => c.imageURL), ...s0.selectedFabledCharacters.map((c) => c.imageURL)])

    const timers: number[] = []
    const unsub = useGame.subscribe((s, prev) => {
      if (s.gameState !== prev.gameState) {
        // 开始游戏、天亮、入夜时各存一次
        saveGame()
        settings().set('gameIsNight', s.gameState === 1 || s.gameState === 3)
      } else if (nameKey(s) !== nameKey(prev)) {
        // 发角色、换角色、加减人时存一次，保证配完版就有存档
        saveGame()
      }
      // 打开存档前先存一次，列表里就是最新的状态
      if (s.showArchive && !prev.showArchive) saveGame()
      if (s.characters.length !== prev.characters.length) prefetchImages(s.characters.map((c) => c.imageURL))
      // 记事本里新加的常用词也记到设置里
      if (s.predefinedTags !== prev.predefinedTags && JSON.stringify(s.predefinedTags) !== JSON.stringify(settings().notepadTags)) {
        settings().set('notepadTags', s.predefinedTags)
      }
      // 用 AI 配的版，玩家抽完卡回到主界面时，直接接上“AI补完配版”
      if (!s.showSetup && prev.showSetup && s.gameState === 0 && s.aiSetupNotes !== '' && everyoneHasCharacter(s.playersAssignedCharacters)) {
        timers.push(window.setTimeout(() => setGame({ showAIPostDraw: true }), 600))
      }
    })
    const minute = window.setInterval(saveGame, 60_000)
    const onHide = () => { if (document.visibilityState === 'hidden') saveGame() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', saveGame)
    return () => {
      unsub()
      timers.forEach((t) => window.clearTimeout(t))
      window.clearInterval(minute)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', saveGame)
      settings().set('gameIsNight', false)
      saveGame()
      clearUndo()
      stopHost()
      // iPad 版的 AI 对话是 StoryTellerView 的 @State，离开小镇就没了
      resetAIChat()
    }
  }, [])

  const panelKind = gameState === 0 ? 'setup' : gameState === 1 || gameState === 3 ? 'order' : gameState === 2 ? 'voting' : 'none'

  // iPad 版小镇本身是透明的，底下是 ContentView 的圆点底纹（圆桌摆法、卡片缝隙里都看得到）；新手教程的演示小镇是纯色底
  return (
    <div className={demo ? undefined : 'dot-bg'} style={{ position: 'relative', width: '100%', height: '100%', background: demo ? 'var(--mainbg)' : undefined, color: 'var(--ink)', paddingTop: compact ? 0 : SAFE_TOP, paddingBottom: compact ? 0 : SAFE_BOTTOM, overflow: 'hidden' }}>
      <style>{townCSS}</style>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 手机版另有一套摆法（mobile/MobileTown.tsx），下面盖着的面板两边共用 */}
        {compact ? <MobileTown onExit={confirmExit} /> : null}
        {/* 主界面：左边菜单、中间卡片、传奇/计时器/伪装、右边信息和面板 */}
        {compact ? null : <div style={{ display: 'flex', gap: 8, height: '100%', alignItems: 'stretch' }}>
          <MenuView onExit={confirmExit} />

          <div className="scroll-hidden" style={{
            flex: '1 1 0', minWidth: 0, overflowY: 'auto', overflowX: 'hidden',
            // 和 iPad 一样，卡片滚动时会滚到状态栏和底部横条下面
            marginTop: -SAFE_TOP, marginBottom: -SAFE_BOTTOM, paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, filter: 'drop-shadow(3px 5px 5px rgba(0,0,0,0.2))' }}>
              {/* iPad 版 ScrollView 里第一个是高度 0 的 Color.clear（滚动锚点），和卡片之间也隔着默认的 8 */}
              <div style={{ height: 0, alignSelf: 'stretch' }} />
              {/* 新手教程的演示小镇固定用每行 3 张的网格，方便圈出卡片 */}
              <PlayersView numCols={demo ? 3 : cardsPerRow} forceGrid={demo} />
              {/* 教程圈的是这一排按钮本身的宽度（iPad 上 tutorialAnchor 在 .frame(maxWidth:) 之前），不是整行 */}
              {gameState === 0 ? (
                <div data-tour="setup.buttons" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 30 }}>
                  <button style={setupButton(150)} onClick={() => setGame({ showSetup: true })}>说书人配版</button>
                  <button style={setupButton(130, 20)} onClick={() => setGame({ openAISetupOnAppear: true, showSetup: true })}>AI配版</button>
                  <button style={setupButton(170, 20)} onClick={() => setGame({ showAIPostDraw: true })}>AI补完配版</button>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 110, flexShrink: 0, height: '100%', position: 'relative', zIndex: 1 }}>
            <div data-tour="fabled" style={{ ...box, flex: '1 1 0', minHeight: 0 }}>
              <FabledListView />
            </div>
            <div data-tour="timer" style={{ ...box, flex: '1 1 0', minHeight: 0 }}>
              <TimerView />
            </div>
            <div data-tour="bluffs" style={{ ...box, flexShrink: 0, padding: '20px 0' }}>
              <FakeCover />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 260, flexShrink: 0, marginRight: 10, height: '100%' }}>
            <div data-tour="info" style={{ ...box, height: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
              <div style={{ padding: '10px 10px 5px' }}><PlayInfo /></div>
              <div style={{ padding: '2px 10px' }}><TeamInfo /></div>
              <div style={{ padding: '2px 10px' }}><TeamActualInfo /></div>
              <div style={{ padding: '0 10px 10px' }}><SurvivorInfo /></div>
            </div>
            <div data-tour="extraCare" style={{ ...box, background: undefined, flex: '1 1 0', minHeight: 0, marginTop: 10 }}>
              <ExtraCareView />
            </div>
            <div data-tour="rightPanel" style={{ ...box, flex: '1 1 0', minHeight: 0, marginTop: 10 }}>
              <div key={panelKind} style={{ width: '100%', height: '100%', animation: 'st-slide-in .3s ease-in-out' }}>
                {panelKind === 'setup' ? <ExtraSetup /> : panelKind === 'order' ? <OrderView /> : panelKind === 'voting' ? <VotingView /> : null}
              </div>
            </div>
          </div>
        </div>}

        {/* 盖在上面的面板，层次和 iPad 版一样 */}
        {selectNewCharacter ? <Layer z={11}><CharacterSelection /></Layer> : null}
        {showMenu ? <Layer z={10}><SubMenuView /></Layer> : null}
        {selectNewReminder ? <Layer z={12}><TagPicker /></Layer> : null}
        {showNotepad ? <Layer z={13}><Notepad /></Layer> : null}
        {showConversation ? <Layer z={14}><Conversation /></Layer> : null}
        {showAllCharacterInfos ? <Layer z={15}><AllCharacterInfos /></Layer> : null}
        {showFabledCharactersSelection ? <Layer z={16}><FabledSelection /></Layer> : null}
        {showSetup ? <Layer z={17}><SetupView /></Layer> : null}

        {compact ? null : (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}><UndoToast /></div>
          </div>
        )}
      </div>

      <AIAdvisor open={showAIAdvisor} onClose={() => setGame({ showAIAdvisor: false })} />
      <AIPostDrawSheet open={showAIPostDraw} onClose={() => setGame({ showAIPostDraw: false })} />
      <SettingsView open={showSettings} onClose={() => setGame({ showSettings: false, predefinedTags: settings().notepadTags })} />
      {demo ? <DemoTour /> : null}
      <RoomPanel />
      <ArchiveView open={showArchive} onClose={() => setGame({ showArchive: false })} currentGameID={gameID} onLoad={(id) => { void loadArchive(id) }} />
    </div>
  )
}
