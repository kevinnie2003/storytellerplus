// 新手教程的演示小镇，对应 iPad 版 StoryTellerView 里“新手教程的演示小镇”那一段
import { game, setGame } from '../game/store'
import { makeLog } from '../game/log'
import { defaultCharacter, type Character } from '../game/types'
import { fillSetupBag, setSelectionState, useSetupFlow, scrollSetupDeal } from '../setup/flowState'
import { settings, useSettings } from '../settings/store'
import type { TourStep } from './TourOverlay'

/** 演示局用的 8 个角色（暗流涌动 8 人：5 镇民、1 外来者、1 爪牙、1 恶魔） */
function demoRoster(): Character[] {
  const { playableCharacters } = game()
  const wanted = ['共情者', '占卜师', '酒鬼', '投毒者', '洗衣妇', '小恶魔', '送葬者', '僧侣']
  const seats = wanted.map((n) => playableCharacters.find((c) => c.name === n)).filter((c): c is Character => !!c)
  for (const c of playableCharacters) {
    if (seats.length >= 8) break
    if (!seats.some((s) => s.name === c.name) && ['townsfolk', 'outsider', 'minion', 'demon'].includes(c.team)) seats.push(c)
  }
  return seats
}

const allDealt = () => {
  const p = game().playersAssignedCharacters
  return p.length > 0 && !p.some((c) => c.name === '')
}

const stage = () => useSetupFlow.getState().selectionState

/** 演示从一个空的 8 人小镇开始：还没配版、没发角色 */
export function setupDemo() {
  const count = 8
  setGame({
    playersAssignedCharacters: Array.from({ length: count }, () => defaultCharacter),
    playerCount: count,
    aliveCount: count,
    playersIsAlive: Array(count).fill(true),
    playersHasDeathVote: Array(count).fill(true),
    playersStates: Array.from({ length: count }, () => []),
    notPresentedGoodCharacters: [],
    gameState: 0,
    gameID: 'demo',
  })
}

/** 跳过发角色时，直接按演示阵容发好，配好恶魔伪装 */
function ensureDealt() {
  setGame({ showSetup: false })
  if (!allDealt()) setGame({ playersAssignedCharacters: demoRoster() })
  const s = game()
  if (s.notPresentedGoodCharacters.filter((c) => c.name !== '').length < 3) {
    const inPlay = new Set(s.playersAssignedCharacters.map((c) => c.name))
    setGame({ notPresentedGoodCharacters: s.playableCharacters.filter((c) => c.team === 'townsfolk' && !inPlay.has(c.name)).slice(0, 3) })
  }
}

function ensureStarted() {
  ensureDealt()
  if (game().gameState === 0) {
    setGame((s) => ({
      gameState: 1,
      allLogs: [...s.allLogs,
        makeLog({ message: '游戏开始', messager: 0, source: '说书人', type: 8 }),
        makeLog({ message: '第一夜', messager: 0, source: '说书人', type: 9 })],
    }))
  }
}

function goNight() {
  ensureStarted()
  if (game().gameState !== 3) {
    setGame((s) => ({ gameState: 3, firstNightOrder: false, allLogs: [...s.allLogs, makeLog({ message: '夜晚', messager: 0, source: '说书人', type: 11 })] }))
  }
}

function goDay() {
  ensureStarted()
  if (game().gameState !== 2) {
    setGame((s) => ({ gameState: 2, allLogs: [...s.allLogs, makeLog({ message: '白天', messager: 0, source: '说书人', type: 10 })] }))
  }
}

/** 打开配版并且停在某一步；跳过配版时直接塞一套抽卡堆 */
function openSetup(target?: number, fillBag = false) {
  setGame({ showMenu: false, selectNewReminder: false, showNotepad: false })
  if (game().gameState !== 0) return
  if (!game().showSetup) setGame({ showSetup: true })
  const filling = fillBag && stage() < 12
  window.setTimeout(() => { if (filling) fillSetupBag(demoRoster()) }, 400)
  window.setTimeout(() => { if (target !== undefined && stage() !== target) setSelectionState(target) }, filling ? 800 : 400)
}

/** 小镇的卡片区滚到最上面，或者滚到配版按钮 */
function scrollTown(to: 'top' | 'setup') {
  window.setTimeout(() => {
    // 只滚卡片那一栏（scrollIntoView 会顶掉上面留给状态栏的空白，还可能带着外层一起滚）。
    // iPad 版是 scrollTo("demo.top", .top) / scrollTo(配版按钮, .bottom)：也就是滚到最上面 / 最下面
    const el = document.querySelector<HTMLElement>('[data-tour="globalTags"]')
    let box = el?.parentElement ?? null
    while (box && !(box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY !== 'visible')) box = box.parentElement
    if (!box) return
    box.scrollTo({ top: to === 'setup' ? box.scrollHeight : 0, behavior: 'smooth' })
  }, 50)
}

function closePanels(menu = false, scroll: 'top' | 'setup' = 'top') {
  scrollTown(scroll)
  setGame({ showMenu: menu, selectNewReminder: false, showNotepad: false, showConversation: false })
}

export function finishDemoState() {
  useSettings.getState().set('gameIsNight', false)
}

/** 教程的每一步：圈哪里、怎么操作。动手的步骤做完自动下一步，点“帮我做”由下一步的 prepare 补上结果 */
export function tourSteps(): TourStep[] {
  const players = () => game().playersAssignedCharacters
  const minionText = () => {
    const seats = players().map((c, i) => (c.team === 'minion' ? `“${i + 1}号”` : '')).filter(Boolean)
    return seats.length ? seats.join('') : '爪牙的座位号'
  }
  const demonText = () => {
    const i = players().findIndex((c) => c.team === 'demon')
    return i >= 0 ? `“${i + 1}号”` : '恶魔的座位号'
  }
  // 文字里要用到当时的座位号，所以拼一句话这一步的文字在用到时才算
  const steps: TourStep[] = [
    { title: '带你完整走一局', lines: [
      '这是一个用《暗流涌动》开的 8 人演示局，从配版、玩家抽卡一直走到夜里。',
      '演示不会存档，也不会影响你的上一局，随时可以点“退出教程”。',
      '有“照着做”的步骤，请直接在圈出来的地方操作；不想动手就点“帮我做”。',
      '开新局时：开始页点“开始游戏”，上传剧本 JSON，或者用“图片生成剧本”让 AI 读剧本图。',
    ], prepare: () => closePanels() },
    { targets: ['menu.gear', 'gear.players'], title: '先定人数', lines: [
      '点左边的齿轮打开面板（再点一下收起），用 + − 调玩家人数。',
      '演示局已经是 8 人。面板里还有随机分配角色、隐藏阵营颜色、存档和设置。',
    ], prepare: () => closePanels(true) },
    { targets: ['setup.buttons'], title: '开始配版', lines: [
      '玩家卡片下面有三个按钮：',
      '说书人配版：自己定数量、抽牌。',
      'AI配版：让 AI 按剧本和人数直接配好（要先填 AI Key）。',
      'AI补完配版：发完角色后，让 AI 安排醉酒、红鲱鱼、恶魔伪装。',
      '现在点“说书人配版”。',
    ], prepare: () => closePanels(false, 'setup'), interactive: true, done: () => game().showSetup },
    { targets: ['setup.count', 'setup.panelButtons'], title: '配版 1：各阵营数量', lines: [
      '不需要玩家参与配版，就直接点右下角“确认”。',
      '这里的数量只在“让玩家自己抽角色”时有用：想让玩家参与，就先定每个阵营抽几张。',
    ], prepare: () => openSetup(0), interactive: true, done: () => game().showSetup && stage() >= 1, skipSteps: 3, skipLabel: '帮我配好' },
    { targets: ['setup.pickCards', 'setup.pickButtons'], title: '配版 2：让玩家抽（可跳过）', lines: [
      '不需要玩家参与配版，就直接点“确认”，到下一页由你自己选角色。',
      '想让玩家参与时，把 iPad 递给玩家，让他在背面朝上的牌里点几张，选够数量就行。',
    ], prepare: () => openSetup(1), interactive: true, done: () => game().showSetup && stage() >= 2, skipSteps: 2, skipLabel: '帮我配好' },
    { targets: ['setup.check'], title: '配版 3：自己选角色', lines: [
      '这一页四个阵营的牌都翻开了，点一下牌选中，再点一下去掉。按每个阵营标题写的“应选几张”选够：8 人局是 1 恶魔、1 爪牙、1 外来者、5 镇民。',
      '要放两张同样的角色就点 ⊕。最上面会显示已经选了几张。',
      '选够 8 张后往下滑，点最下面的“玩家开抽”。牌数和人数不一样时开不了抽，会提示你。右下角的“确认”会去下一个阵营的数量页，这里不用点。',
    ], prepare: () => openSetup(2), interactive: true, done: () => game().showSetup && stage() === 12, skipLabel: '帮我配好' },
    { targets: ['deal.seats', 'deal.cards'], title: '抽卡：第一位玩家', lines: [
      '双击右边列表里的“1号”，选中他。',
      '然后让 1 号长按一张牌，牌会翻开，显示他的角色。看完把 iPad 传给下一位。',
      '长按列表里的号码，可以提前给这个座位指定一张牌，比如想让酒鬼坐某个位置。',
    ], prepare: () => openSetup(12, true), interactive: true, done: () => (players()[0]?.name ?? '') !== '' },
    { targets: ['deal.seats', 'deal.cards', 'deal.buttons'], title: '抽卡：其他玩家', lines: [
      '其他人照样：双击号码，再长按一张牌。号码后面变成 ✓ 就是抽好了。',
      '全部抽完点“确认”回到小镇。',
    ], prepare: () => openSetup(12), interactive: true, done: () => !game().showSetup && allDealt() },
    { targets: ['card.icon'], title: '直接给座位换角色', lines: [
      '回到小镇，每张卡片就是一个座位。',
      '要改某个座位的角色，点卡片右上角的头像，在弹出的列表里点一下新角色。',
      '这类弹出的面板，都是双击空白的地方关掉。',
    ], prepare: () => { ensureDealt(); closePanels() } },
    { targets: ['bluffs'], title: '恶魔伪装', lines: [
      '首夜给恶魔看的三个不在场的善良角色。',
      '点一个格子，在列表里选角色。用 AI补完配版的话，AI 会帮你选好。',
    ], prepare: () => { ensureDealt(); closePanels() } },
    { targets: ['menu.gear', 'gear.start'], title: '开始游戏', lines: [
      '所有人都有角色后，打开齿轮面板，点“开始游戏”，进入第一夜。',
      '分好角色就会自动存档，不用手动保存。现在点“开始游戏”。',
    ], prepare: () => { ensureDealt(); closePanels(true) }, interactive: true, done: () => game().gameState !== 0 },
    { targets: ['rightPanel'], title: '首夜：按顺序唤醒', lines: [
      '右边按顺序列出今晚要唤醒的角色和该说的话，已死亡的会标出来。顶部可以切换“第一晚”“其他晚”。',
      '现在双击列表里的一项，表示正在唤醒他，会记进整局记录。',
    ], prepare: () => { ensureStarted(); closePanels() }, interactive: true, done: () => game().allLogs.some((l) => l.type === 2) },
    { targets: ['menu.notepad'], title: '给玩家看信息：打开记事本', lines: [
      '首夜先唤醒爪牙，告诉他们谁是恶魔；再唤醒恶魔，告诉他谁是爪牙，再给他三个不在场的角色当伪装。这种时候用记事本拼出来举给玩家看。',
      '点左边的记事本图标。',
    ], prepare: () => { ensureStarted(); closePanels() }, interactive: true, done: () => game().showNotepad },
    { targets: ['notepad.panel'], title: '给玩家看信息：拼一句话', lines: [], prepare: () => {
      ensureStarted()
      setGame({ selectNewReminder: false, showMenu: false })
      if (!game().showNotepad) setGame({ showNotepad: true })
    }, interactive: true, freeTaps: true, cardCorner: 'topTrailing',
    // 双击外面关掉记事本，就自动进入下一步
    done: () => !game().showNotepad, skipLabel: '下一步' },
    { targets: ['card.plus'], title: '加标签', lines: [
      '夜里有人中毒、醉酒，就给他挂标签。',
      '点 1 号卡片下方的 ⊕。',
    ], prepare: () => { ensureStarted(); closePanels() }, interactive: true, done: () => game().selectNewReminder },
    { targets: ['tag.panel'], title: '选一个标签', lines: [
      '这里是这个剧本所有的提醒标签，前面的号码和图标是它来自哪个角色。',
      '点一下选中一个标签，再点“确认”加上。点“返回”不加。',
    ], prepare: () => {
      ensureStarted()
      setGame({ showNotepad: false })
      if (!game().selectNewReminder) setGame({ currentSelectedPlayerIDForReminder: 0, selectedReminderIndex: -1, selectNewReminder: true })
    }, interactive: true, done: () => !game().selectNewReminder },
    { targets: ['card.tags'], title: '删除和倒置标签', lines: [
      '标签显示在卡片下方。',
      '双击一个标签：删掉它。长按一个标签 1 秒：把它倒置，表示效果暂时失效之类。',
      '删错了点屏幕底部的“撤销”。',
    ], prepare: () => { ensureStarted(); closePanels() } },
    { targets: ['globalTags'], title: '全局标签', lines: [
      '左边这一栏给全场的效果挂标签。点 ⊕ 添加，双击删除，长按 1 秒倒置。',
    ], prepare: () => { ensureStarted(); closePanels() } },
    { targets: ['menu.sun'], title: '天亮', lines: [
      '夜里的事都做完了，点太阳天亮。',
      '第一夜恶魔不杀人（能力里带 * 的表示首夜不发动），所以第一天早上没有人死。',
    ], prepare: () => { ensureStarted(); closePanels() }, interactive: true, done: () => game().gameState === 2 },
    { targets: ['rightPanel'], title: '提名', lines: [
      '白天右边是投票面板。先点提名者的号码，点“确认”；再点被提名者的号码，点“确认”。',
      '已经提名过、被提名过的人会被分到下面，同一天不能再提名。',
    ], prepare: () => { goDay(); closePanels(); setGame({ nominationPhase: 0, votingPhase: 0 }) }, interactive: true, done: () => game().votingPhase === 1 },
    { targets: ['rightPanel'], title: '投票', lines: [
      '从提示的座位开始，逐个点举手的人，再点一下取消。死人投票会用掉他的死人票。',
      '上面“从几号开始投票”后面会实时显示当前几票。点“投票”记下这次提名。',
    ], prepare: () => { goDay(); closePanels() }, interactive: true, done: () => game().votingPhase === 2 },
    { targets: ['rightPanel'], title: '处决', lines: [
      '“处决”页列出今天所有提名和票数，票数最高且过半的会反色显示，就是今天要处决的人。',
      '要处决谁，就点一下他的座位号让他死亡，白天处决和夜里被杀都是这样标记。',
    ], prepare: () => { goDay(); closePanels(); setGame({ votingPhase: 2 }) } },
    { targets: ['timer'], title: '计时器', lines: [
      '上面是整局和当前白天或夜晚的时长。',
      '下面的计时器：点一下暂停或继续，双击归零。',
      '长按计时器：选 1 到 10 分钟倒计时或者自定义，选好直接开始，时间到会闪红。',
    ], prepare: () => closePanels() },
    { targets: ['info', 'extraCare'], title: '局势和相克', lines: [
      '上面是剧本名、各阵营应有和实有的数量、存活人数。',
      '下面自动列出相克规则，以及和提名、被提、投票、处决有关的能力，点顶部切换。',
    ], prepare: () => closePanels() },
    { targets: ['fabled'], title: '传奇角色', lines: [
      '点 ⊕ 选这局用的传奇角色，双击已选的移除。',
    ], prepare: () => closePanels() },
    { targets: ['menu.ai'], title: 'AI 说书', lines: [
      '局中随时问 AI，比如“给占卜师编今晚的信息”“今晚怎么安排”，它会结合魔典和整局记录回答。',
      '要先在设置里填好自己的 AI Key。',
    ], prepare: () => closePanels() },
    { targets: ['menu.infos'], title: '角色能力', lines: [
      '这里能看到剧本里所有角色的能力，双击空白处关掉。',
    ], prepare: () => closePanels() },
    { targets: ['menu.log'], title: '整局记录', lines: [
      '发角色、标签、死亡、提名投票都会自动记下来。点这个图标打开看看。',
    ], prepare: () => closePanels(), interactive: true, done: () => game().showConversation },
    { targets: ['log.panel'], title: '记发言、存长图', lines: [
      '下面选一个玩家，输入他说的话点“发送”，就会记进去，比如他声称的身份。',
      '右上角“存成长图”：确认后把整局记录画成一张长图存进相册。',
      '看完双击记录外面的空白处关掉，会自动进入下一步。',
    ], prepare: () => { closePanels(); setGame({ showConversation: true }) }, interactive: true, freeTaps: true,
    done: () => !game().showConversation, skipLabel: '下一步' },
    { targets: ['menu.moon'], title: '入夜', lines: [
      '一天结束，点月亮入夜。右边会换成“其他晚”的唤醒顺序。',
    ], prepare: () => { goDay(); closePanels() }, interactive: true, done: () => game().gameState === 3 },
    { targets: ['card.number'], title: '夜里有人死了', lines: [
      '从第二夜开始恶魔每晚杀一个人。',
      settings().confirmDeath
        ? '点一下被杀那人的座位号，在弹出的确认框里点“确定”，他就死了，卡片会变暗。复活也是一样。'
        : '点一下被杀那人的座位号，他就死了，卡片会变暗。再点一下就复活。',
      '设置里可以开关确认框。试试让 1 号死亡，天亮时就宣布他的死讯。',
    ], prepare: () => { goNight(); closePanels() }, interactive: true, done: () => game().playersIsAlive.includes(false) },
    { targets: ['menu.gear', 'menu.exit'], title: '存档、复盘和离开', lines: [
      '齿轮面板里的“存档”能看到所有局，可以载入继续；点“复盘”看整局时间线，还能让 AI 生成复盘长图发给玩家。',
      '右下角的 ✕ 回到开始页。分好角色的局都会自动存档。',
      '大部分操作之后屏幕底部会出现“撤销”，点错了不用慌。教程到这里结束，祝你带局顺利。',
    ], prepare: () => closePanels() },
  ]
  // 拼一句话这一步：座位号要按这局实际抽到的角色填
  const notepadStep = steps.find((s) => s.title === '给玩家看信息：拼一句话')!
  Object.defineProperty(notepadStep, 'lines', {
    get: () => [
      '左边是词块：座位号、恶魔伪装、其他角色、常用词，点一下就加到大字区。',
      `给爪牙看：点恶魔的座位号${demonText()}就够了。`,
      `给恶魔看：点“清空”，再依次点${minionText()}“是”“爪牙”，再点恶魔伪装那一栏的三个角色。`,
      '举给玩家看之前，先点下面的“收起”把左边的词块藏起来，免得他看到伪装和其他角色。',
      '用完双击记事本外面的空白处关掉，会自动进入下一步。',
    ],
  })
  void scrollSetupDeal
  return steps
}
