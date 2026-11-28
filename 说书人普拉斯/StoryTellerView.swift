//
//  StoryTellerView.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/21/25.
//

import SwiftUI
import Flow

struct StoryTellerView: View {
  @Binding var currentView: Int
  @Binding var loadLast: Bool // if we just load the last game
  let playJSON: [[String: Any]]
  /// 新手教程用的演示小镇：不存档，界面上盖一层教程
  var demo: Bool = false
  var onDemoFinished: () -> Void = {}
  @State private var demoScrollTarget: String? = nil
  @State private var demoSetupStage = 0
  @State private var demoBag: [Character]? = nil
  @State private var demoStageRequest: Int? = nil
  @State private var showExitConfirmation = false
  @State private var showMenu = false
  @State private var playerCount: Int = 0
  
  @State private var aliveCount: Int = 0
  @State private var playName: String = ""
  @State private var playAuthor: String = ""
  @State private var characters: [Character] = [] // store all the characters, this is for us to access the image urls
  @State private var playableCharacters: [Character] = [] // store all the characters accessible to players
  @State private var travelers: [Character] = [] // store all the traverlers accessible to players
  @State private var fabled: [Character] = []
  @State private var playersAssignedCharacters: [Character] = []
  
  @State private var playersIsAlive: [Bool] = []
  
  @State private var notPresentedGoodCharacters: [Character] = [defaultCharacter, defaultCharacter, defaultCharacter]
  
  // FOR ALERTS
  @State private var alertMessage: String = ""
  @State private var showAlert: Bool = false
  
  @State private var gameState: Int = 0 // 0 for setup, 1 for first night, 2 for day, 3 for night, 4 for voting
  
  // FOR SELECTING NEW CHARACTERS
  @State private var selectNewCharacter: Bool = false
  @State private var currentSelectedPlayerID: Int = 0
  
  // FOR JINXES
  @State private var jinxList: [Jinx] = []
  
  // FOR REMINDERS
  @State private var allReminders: [Reminder] = []
  @State private var playersStates: [[Reminder]] = [[]]
  @State private var globalStates: [Reminder] = []
  @State private var selectNewReminder: Bool = false
  @State private var currentSelectedPlayerIDForReminder: Int = 0
  @State private var selectedReminderIndex: Int = 0
  
  // FOR THE SETUP PART
  @State private var showSetup: Bool = false
  
  // FOR CONVENIENCE
  var selectedCharacterNames: [String] {
    playersAssignedCharacters.map { $0.name }
  }
  
  // FOR THE LOG
  @State private var allLogs: [GameLogEntry] = []
  
  // FOR THE ORDER CHECKING
  @State private var firstNightOrder: Bool = true
  @State private var currentlyAwakePlayerIndex: Int = -666
  
  // FOR THE NOTEPAD
  @State private var showNotepad: Bool = false
  @State private var predefinedTags: [String] = AppSettings.shared.notepadTags
  
  // FOR LISTING THE CHARACTER AND THEIR ABILITIES
  @State private var showCharacterAndAbilities: Bool = false
  
  // FOR CONVERSATIONS
  @State private var showConversation: Bool = false
//  @State private var recorder: AudioRecorder = AudioRecorder()
  
  // FOR SHOWING ALL CHARACTER INFOS
  @State private var showAllCharacterInfos: Bool = false
  
  // FOR VOTING
  @State private var playersHasDeathVote: [Bool] = []
  @State private var votingPhase: Int = 2
  @State private var nominationPhase: Int = 0
  
  // FOR FABLED CHARACTERS
  @State private var showFabledCharactersSelection: Bool = false
  @State private var selectedFabledCharacters: [Character] = []
  
  // FOR SETTINGS AND ARCHIVE
  @State private var showSettings: Bool = false
  @State private var showArchive: Bool = false
  @State private var gameID: String = UUID().uuidString
  @ObservedObject private var appSettings = AppSettings.shared
  
  private func makeSaveData() -> GameSaveData {
    GameSaveData(
      playName: playName,
      playAuthor: playAuthor,
      gameState: gameState,
      characters: characters,
      playersAssignedCharacters: playersAssignedCharacters,
      playersIsAlive: playersIsAlive,
      playersHasDeathVote: playersHasDeathVote,
      aliveCount: aliveCount,
      playableCharacters: playableCharacters,
      travelers: travelers,
      fabled: fabled,
      notPresentedGoodCharacters: notPresentedGoodCharacters,
      jinxList: jinxList,
      allReminders: allReminders,
      playersStates: playersStates,
      currentSelectedPlayerID: currentSelectedPlayerID,
      selectNewCharacter: selectNewCharacter,
      currentSelectedPlayerIDForReminder: currentSelectedPlayerIDForReminder,
      selectNewReminder: selectNewReminder,
      selectedReminderIndex: selectedReminderIndex,
      allLogs: allLogs,
      firstNightOrder: firstNightOrder,
      currentlyAwakePlayerIndex: currentlyAwakePlayerIndex,
      selectedFabledCharacters: selectedFabledCharacters,
      globalStates: globalStates,
      gameID: gameID
    )
  }
  
  /// 保存当前这一局：一份作为“返回小镇”用的最近存档，分好角色或开始游戏之后再在存档列表里存一份
  private func saveGame() {
    if demo { return }
    let saveData = makeSaveData()
    if let encoded = try? JSONEncoder().encode(saveData) {
      UserDefaults.standard.set(encoded, forKey: "SavedGameState")
    }
    GameArchive.save(saveData)
  }
  
  /// 载入另一局：先保存当前这一局，再重新打开小镇
  private func loadArchive(_ id: String) {
    saveGame()
    guard let data = GameArchive.load(id) else {
      alertMessage = "读取存档失败。"
      showAlert = true
      return
    }
    UserDefaults.standard.set(data, forKey: "SavedGameState")
    loadLast = true
    currentView = 0
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
      currentView = 1
    }
  }
  
  // FOR AI
  @State private var showAIAdvisor: Bool = false
  @State private var showAIPostDraw: Bool = false
  @State private var aiChat: [AIChatMessage] = []
  @State private var aiSetupNotes: String = ""
  @State private var openAISetupOnAppear: Bool = false
  
  private func makeAIContext() -> AIGameContext {
    AIGameContext(
      playName: playName,
      gameState: gameState,
      playableCharacters: playableCharacters,
      players: playersAssignedCharacters,
      alive: playersIsAlive,
      deathVote: playersHasDeathVote,
      playerTags: playersStates,
      globalTags: globalStates,
      bluffs: notPresentedGoodCharacters,
      fabled: selectedFabledCharacters,
      jinxes: jinxList,
      logs: allLogs,
      allReminders: allReminders,
      setupNotes: aiSetupNotes
    )
  }
  
  // 把 AI 建议的开局标记和恶魔伪装写进魔典
  private func applyAIPostDraw(tags: [AIPostDrawTag], bluffs: [Character]) {
    for tag in tags where tag.playerIndex >= 0 && tag.playerIndex < playersStates.count {
      let template = allReminders.first(where: { $0.from == tag.from && $0.effect == tag.effect })
      let sourceTeam = characters.first(where: { $0.name == tag.from })?.team ?? ""
      let sourcePlayer = playersAssignedCharacters.firstIndex(where: { $0.name == tag.from }) ?? -1
      let reminder = Reminder(from: tag.from, effect: tag.effect, team: template?.team ?? team2Int(sourceTeam), isGlobal: template?.isGlobal ?? false, playerId: sourcePlayer)
      if !playersStates[tag.playerIndex].contains(where: { $0.from == reminder.from && $0.effect == reminder.effect }) {
        playersStates[tag.playerIndex].append(reminder)
      }
    }
    if bluffs.count == 3 {
      notPresentedGoodCharacters = bluffs
    }
  }
  
  // MARK: 新手教程的演示小镇
  
  /// 演示局用的 8 个角色（暗流涌动 8 人：5 镇民、1 外来者、1 爪牙、1 恶魔）
  private var demoRoster: [Character] {
    let wanted = ["共情者", "占卜师", "酒鬼", "投毒者", "洗衣妇", "小恶魔", "送葬者", "僧侣"]
    var seats: [Character] = wanted.compactMap { name in playableCharacters.first(where: { $0.name == name }) }
    for c in playableCharacters where seats.count < 8 && !seats.contains(where: { $0.name == c.name }) && ["townsfolk", "outsider", "minion", "demon"].contains(c.team) {
      seats.append(c)
    }
    return seats
  }
  
  private var demoAllDealt: Bool {
    !playersAssignedCharacters.isEmpty && !playersAssignedCharacters.contains(where: { $0.name.isEmpty })
  }
  
  /// 演示从一个空的 8 人小镇开始：还没配版、没发角色
  private func setupDemo() {
    let count = 8
    playersAssignedCharacters = Array(repeating: defaultCharacter, count: count)
    playerCount = count
    aliveCount = count
    playersIsAlive = Array(repeating: true, count: count)
    playersHasDeathVote = Array(repeating: true, count: count)
    playersStates = Array(repeating: [Reminder](), count: count)
    notPresentedGoodCharacters = []
    gameState = 0
  }
  
  /// 跳过发角色时，直接按演示阵容发好，配好恶魔伪装
  private func demoEnsureDealt() {
    showSetup = false
    if !demoAllDealt {
      playersAssignedCharacters = demoRoster
    }
    if notPresentedGoodCharacters.filter({ !$0.name.isEmpty }).count < 3 {
      let inPlay = Set(playersAssignedCharacters.map { $0.name })
      notPresentedGoodCharacters = Array(playableCharacters.filter { $0.team == "townsfolk" && !inPlay.contains($0.name) }.prefix(3))
    }
  }
  
  private func demoEnsureStarted() {
    demoEnsureDealt()
    if gameState == 0 {
      gameState = 1
      allLogs.append(GameLogEntry(message: "游戏开始", messager: 0, source: "说书人", type: 8, characterName: ""))
      allLogs.append(GameLogEntry(message: "第一夜", messager: 0, source: "说书人", type: 9, characterName: ""))
    }
  }
  
  private func demoGoNight() {
    demoEnsureStarted()
    if gameState != 3 {
      gameState = 3
      firstNightOrder = false
      allLogs.append(GameLogEntry(message: "夜晚", messager: 0, source: "说书人", type: 11, characterName: ""))
    }
  }
  
  private func demoGoDay() {
    demoEnsureStarted()
    if gameState != 2 {
      gameState = 2
      allLogs.append(GameLogEntry(message: "白天", messager: 0, source: "说书人", type: 10, characterName: ""))
    }
  }
  
  /// 打开配版并且停在某一步；跳过配版时直接塞一套抽卡堆
  private func demoOpenSetup(stage: Int? = nil, fillBag: Bool = false) {
    showMenu = false
    selectNewReminder = false
    showNotepad = false
    if gameState != 0 { return }
    if !showSetup { showSetup = true }
    // 跳过配版时塞一套演示阵容，塞完再跳到要去的那一步
    let filling = fillBag && demoSetupStage < 12
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
      if filling {
        demoBag = demoRoster
      }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + (filling ? 0.8 : 0.4)) {
      if let stage = stage, demoSetupStage != stage {
        demoStageRequest = stage
      }
    }
  }
  
  private func demoClosePanels(menu: Bool = false, scroll: String = "demo.top") {
    demoScrollTarget = scroll
    showMenu = menu
    selectNewReminder = false
    showNotepad = false
    showConversation = false
  }
  
  private func finishDemo() {
    appSettings.gameIsNight = false
    onDemoFinished()
  }
  
  /// 教程的每一步：圈哪里、怎么操作。动手的步骤做完自动下一步，点“帮我做”由下一步的 prepare 补上结果
  private var tourSteps: [TourStep] {
    let minionSeats = playersAssignedCharacters.indices.filter { playersAssignedCharacters[$0].team == "minion" }.map { "“\($0 + 1)号”" }
    let minionText = minionSeats.isEmpty ? "爪牙的座位号" : minionSeats.joined()
    let demonText = playersAssignedCharacters.firstIndex(where: { $0.team == "demon" }).map { "“\($0 + 1)号”" } ?? "恶魔的座位号"
    return [
      TourStep(title: "带你完整走一局", lines: [
        "这是一个用《暗流涌动》开的 8 人演示局，从配版、玩家抽卡一直走到夜里。",
        "演示不会存档，也不会影响你的上一局，随时可以点“退出教程”。",
        "有“照着做”的步骤，请直接在圈出来的地方操作；不想动手就点“帮我做”。",
        "开新局时：开始页点“开始游戏”，上传剧本 JSON，或者用“图片生成剧本”让 AI 读剧本图。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["menu.gear", "gear.players"], title: "先定人数", lines: [
        "点左边的齿轮打开面板（再点一下收起），用 + − 调玩家人数。",
        "演示局已经是 8 人。面板里还有随机分配角色、隐藏阵营颜色、存档和设置。"
      ], prepare: { demoClosePanels(menu: true) }),
      TourStep(targets: ["setup.buttons"], title: "开始配版", lines: [
        "玩家卡片下面有三个按钮：",
        "说书人配版：自己定数量、抽牌。",
        "AI配版：让 AI 按剧本和人数直接配好（要先填 AI Key）。",
        "AI补完配版：发完角色后，让 AI 安排醉酒、红鲱鱼、恶魔伪装。",
        "现在点“说书人配版”。"
      ], prepare: { demoClosePanels(scroll: "demo.setup") }, interactive: true, done: { showSetup }),
      TourStep(targets: ["setup.count", "setup.panelButtons"], title: "配版 1：各阵营数量", lines: [
        "不需要玩家参与配版，就直接点右下角“确认”。",
        "这里的数量只在“让玩家自己抽角色”时有用：想让玩家参与，就先定每个阵营抽几张。"
      ], prepare: { demoOpenSetup(stage: 0) }, interactive: true, done: { showSetup && demoSetupStage >= 1 }, skipSteps: 3, skipLabel: "帮我配好"),
      TourStep(targets: ["setup.pickCards", "setup.pickButtons"], title: "配版 2：让玩家抽（可跳过）", lines: [
        "不需要玩家参与配版，就直接点“确认”，到下一页由你自己选角色。",
        "想让玩家参与时，把 iPad 递给玩家，让他在背面朝上的牌里点几张，选够数量就行。"
      ], prepare: { demoOpenSetup(stage: 1) }, interactive: true, done: { showSetup && demoSetupStage >= 2 }, skipSteps: 2, skipLabel: "帮我配好"),
      TourStep(targets: ["setup.check"], title: "配版 3：自己选角色", lines: [
        "这一页四个阵营的牌都翻开了，点一下牌选中，再点一下去掉。按每个阵营标题写的“应选几张”选够：8 人局是 1 恶魔、1 爪牙、1 外来者、5 镇民。",
        "要放两张同样的角色就点 ⊕。最上面会显示已经选了几张。",
        "选够 8 张后往下滑，点最下面的“玩家开抽”。牌数和人数不一样时开不了抽，会提示你。右下角的“确认”会去下一个阵营的数量页，这里不用点。"
      ], prepare: { demoOpenSetup(stage: 2) }, interactive: true, done: { showSetup && demoSetupStage == 12 }, skipLabel: "帮我配好"),
      TourStep(targets: ["deal.seats", "deal.cards"], title: "抽卡：第一位玩家", lines: [
        "双击右边列表里的“1号”，选中他。",
        "然后让 1 号长按一张牌，牌会翻开，显示他的角色。看完把 iPad 传给下一位。",
        "长按列表里的号码，可以提前给这个座位指定一张牌，比如想让酒鬼坐某个位置。"
      ], prepare: { demoOpenSetup(stage: 12, fillBag: true) }, interactive: true, done: { playersAssignedCharacters.first.map { !$0.name.isEmpty } ?? false }),
      TourStep(targets: ["deal.seats", "deal.cards", "deal.buttons"], title: "抽卡：其他玩家", lines: [
        "其他人照样：双击号码，再长按一张牌。号码后面变成 ✓ 就是抽好了。",
        "全部抽完点“确认”回到小镇。"
      ], prepare: { demoOpenSetup(stage: 12) }, interactive: true, done: { !showSetup && demoAllDealt }),
      TourStep(targets: ["card.icon"], title: "直接给座位换角色", lines: [
        "回到小镇，每张卡片就是一个座位。",
        "要改某个座位的角色，点卡片右上角的头像，在弹出的列表里点一下新角色。",
        "这类弹出的面板，都是双击空白的地方关掉。"
      ], prepare: { demoEnsureDealt(); demoClosePanels() }),
      TourStep(targets: ["bluffs"], title: "恶魔伪装", lines: [
        "首夜给恶魔看的三个不在场的善良角色。",
        "点一个格子，在列表里选角色。用 AI补完配版的话，AI 会帮你选好。"
      ], prepare: { demoEnsureDealt(); demoClosePanels() }),
      TourStep(targets: ["menu.gear", "gear.start"], title: "开始游戏", lines: [
        "所有人都有角色后，打开齿轮面板，点“开始游戏”，进入第一夜。",
        "分好角色就会自动存档，不用手动保存。现在点“开始游戏”。"
      ], prepare: { demoEnsureDealt(); demoClosePanels(menu: true) }, interactive: true, done: { gameState != 0 }),
      TourStep(targets: ["rightPanel"], title: "首夜：按顺序唤醒", lines: [
        "右边按顺序列出今晚要唤醒的角色和该说的话，已死亡的会标出来。顶部可以切换“第一晚”“其他晚”。",
        "现在双击列表里的一项，表示正在唤醒他，会记进整局记录。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }, interactive: true, done: { allLogs.contains(where: { $0.type == 2 }) }),
      TourStep(targets: ["menu.notepad"], title: "给玩家看信息：打开记事本", lines: [
        "首夜先唤醒爪牙，告诉他们谁是恶魔；再唤醒恶魔，告诉他谁是爪牙，再给他三个不在场的角色当伪装。这种时候用记事本拼出来举给玩家看。",
        "点左边的记事本图标。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }, interactive: true, done: { showNotepad }),
      TourStep(targets: ["notepad.panel"], title: "给玩家看信息：拼一句话", lines: [
        "左边是词块：座位号、恶魔伪装、其他角色、常用词，点一下就加到大字区。",
        "给爪牙看：点恶魔的座位号\(demonText)就够了。",
        "给恶魔看：点“清空”，再依次点\(minionText)“是”“爪牙”，再点恶魔伪装那一栏的三个角色。",
        "举给玩家看之前，先点下面的“收起”把左边的词块藏起来，免得他看到伪装和其他角色。",
        "用完双击记事本外面的空白处关掉，会自动进入下一步。"
      ], prepare: {
        demoEnsureStarted()
        selectNewReminder = false
        showMenu = false
        if !showNotepad { showNotepad = true }
      }, interactive: true, done: { !showNotepad }, skipLabel: "下一步", cardCorner: .topTrailing, freeTaps: true),
      TourStep(targets: ["card.plus"], title: "加标签", lines: [
        "夜里有人中毒、醉酒，就给他挂标签。",
        "点 1 号卡片下方的 ⊕。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }, interactive: true, done: { selectNewReminder }),
      TourStep(targets: ["tag.panel"], title: "选一个标签", lines: [
        "这里是这个剧本所有的提醒标签，前面的号码和图标是它来自哪个角色。",
        "点一下选中一个标签，再点“确认”加上。点“返回”不加。"
      ], prepare: {
        demoEnsureStarted()
        showNotepad = false
        if !selectNewReminder {
          currentSelectedPlayerIDForReminder = 0
          selectedReminderIndex = -1
          selectNewReminder = true
        }
      }, interactive: true, done: { !selectNewReminder }),
      TourStep(targets: ["card.tags"], title: "删除和倒置标签", lines: [
        "标签显示在卡片下方。",
        "双击一个标签：删掉它。长按一个标签 1 秒：把它倒置，表示效果暂时失效之类。",
        "删错了点屏幕底部的“撤销”。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }),
      TourStep(targets: ["globalTags"], title: "全局标签", lines: [
        "左边这一栏给全场的效果挂标签。点 ⊕ 添加，双击删除，长按 1 秒倒置。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }),
      TourStep(targets: ["menu.sun"], title: "天亮", lines: [
        "夜里的事都做完了，点太阳天亮。",
        "第一夜恶魔不杀人（能力里带 * 的表示首夜不发动），所以第一天早上没有人死。"
      ], prepare: { demoEnsureStarted(); demoClosePanels() }, interactive: true, done: { gameState == 2 }),
      TourStep(targets: ["rightPanel"], title: "提名", lines: [
        "白天右边是投票面板。先点提名者的号码，点“确认”；再点被提名者的号码，点“确认”。",
        "已经提名过、被提名过的人会被分到下面，同一天不能再提名。"
      ], prepare: {
        demoGoDay(); demoClosePanels()
        nominationPhase = 0
        votingPhase = 0
      }, interactive: true, done: { votingPhase == 1 }),
      TourStep(targets: ["rightPanel"], title: "投票", lines: [
        "从提示的座位开始，逐个点举手的人，再点一下取消。死人投票会用掉他的死人票。",
        "上面“从几号开始投票”后面会实时显示当前几票。点“投票”记下这次提名。"
      ], prepare: { demoGoDay(); demoClosePanels() }, interactive: true, done: { votingPhase == 2 }),
      TourStep(targets: ["rightPanel"], title: "处决", lines: [
        "“处决”页列出今天所有提名和票数，票数最高且过半的会反色显示，就是今天要处决的人。",
        "要处决谁，就点一下他的座位号让他死亡，白天处决和夜里被杀都是这样标记。"
      ], prepare: { demoGoDay(); demoClosePanels(); votingPhase = 2 }),
      TourStep(targets: ["timer"], title: "计时器", lines: [
        "上面是整局和当前白天或夜晚的时长。",
        "下面的计时器：点一下暂停或继续，双击归零。",
        "长按计时器：选 1 到 10 分钟倒计时或者自定义，选好直接开始，时间到会闪红。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["info", "extraCare"], title: "局势和相克", lines: [
        "上面是剧本名、各阵营应有和实有的数量、存活人数。",
        "下面自动列出相克规则，以及和提名、被提、投票、处决有关的能力，点顶部切换。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["fabled"], title: "传奇角色", lines: [
        "点 ⊕ 选这局用的传奇角色，双击已选的移除。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["menu.ai"], title: "AI 说书", lines: [
        "局中随时问 AI，比如“给占卜师编今晚的信息”“今晚怎么安排”，它会结合魔典和整局记录回答。",
        "要先在设置里填好自己的 AI Key。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["menu.infos"], title: "角色能力", lines: [
        "这里能看到剧本里所有角色的能力，双击空白处关掉。"
      ], prepare: { demoClosePanels() }),
      TourStep(targets: ["menu.log"], title: "整局记录", lines: [
        "发角色、标签、死亡、提名投票都会自动记下来。点这个图标打开看看。"
      ], prepare: { demoClosePanels() }, interactive: true, done: { showConversation }),
      TourStep(targets: ["log.panel"], title: "记发言、存长图", lines: [
        "下面选一个玩家，输入他说的话点“发送”，就会记进去，比如他声称的身份。",
        "右上角“存成长图”：确认后把整局记录画成一张长图存进相册。",
        "看完双击记录外面的空白处关掉，会自动进入下一步。"
      ], prepare: {
        demoClosePanels()
        showConversation = true
      }, interactive: true, done: { !showConversation }, skipLabel: "下一步", freeTaps: true),
      TourStep(targets: ["menu.moon"], title: "入夜", lines: [
        "一天结束，点月亮入夜。右边会换成“其他晚”的唤醒顺序。"
      ], prepare: { demoGoDay(); demoClosePanels() }, interactive: true, done: { gameState == 3 }),
      TourStep(targets: ["card.number"], title: "夜里有人死了", lines: [
        "从第二夜开始恶魔每晚杀一个人。",
        appSettings.confirmDeath
          ? "点一下被杀那人的座位号，在弹出的确认框里点“确定”，他就死了，卡片会变暗。复活也是一样。"
          : "点一下被杀那人的座位号，他就死了，卡片会变暗。再点一下就复活。",
        "设置里可以开关确认框。试试让 1 号死亡，天亮时就宣布他的死讯。"
      ], prepare: { demoGoNight(); demoClosePanels() }, interactive: true, done: { playersIsAlive.contains(false) }),
      TourStep(targets: ["menu.gear", "menu.exit"], title: "存档、复盘和离开", lines: [
        "齿轮面板里的“存档”能看到所有局，可以载入继续；点“复盘”看整局时间线，还能让 AI 生成复盘长图发给玩家。",
        "右下角的 ✕ 回到开始页。分好角色的局都会自动存档。",
        "大部分操作之后屏幕底部会出现“撤销”，点错了不用慌。教程到这里结束，祝你带局顺利。"
      ], prepare: { demoClosePanels() })
    ]
  }
  
  // FOR TIMER
  
  
  var body: some View {
    ZStack{
      if (selectNewCharacter){
        CharacterSelectionView(playableCharacters: $playableCharacters, travelersInPlay: $travelers, currentSelectedPlayerID: $currentSelectedPlayerID, selectNewCharacter: $selectNewCharacter, playersAssignedCharacters: $playersAssignedCharacters, notPresentedGoodCharacters: $notPresentedGoodCharacters, gameState: $gameState, allLogs: $allLogs)
          .zIndex(11)
      }
      
      // here we put a menu bar
      if showMenu{
        SubMenuView(showSettings: $showSettings, showArchive: $showArchive, playersAssignedCharacters: $playersAssignedCharacters, playersStates: $playersStates, playersIsAlive: $playersIsAlive, playersHasDeathVote: $playersHasDeathVote, playerCount: $playerCount, aliveCount: $aliveCount, playableCharacters: $playableCharacters, notPresentedGoodCharacters: $notPresentedGoodCharacters, showMenu: $showMenu, gameState: $gameState, allLogs: $allLogs)
          .offset(x: 65)
          .zIndex(10)
      }// end of the if loop for showing menu
      
      if selectNewReminder{
        TagView(allReminders: $allReminders, playersAssignedCharacters: $playersAssignedCharacters, playersStates: $playersStates, currentSelectedPlayerIDForReminder: $currentSelectedPlayerIDForReminder, selectNewReminder: $selectNewReminder, selectedReminderIndex: $selectedReminderIndex, characters: $characters, gameState: $gameState, allLogs: $allLogs, selectedFabledCharacters: $selectedFabledCharacters, globalStates: $globalStates)
          .zIndex(12)
      }
      
      if showNotepad{
        NotepadView(playersAssignedCharacters: $playersAssignedCharacters, playableCharacters: $playableCharacters, showNotepad: $showNotepad, notPresentedGoodCharacters: $notPresentedGoodCharacters, predefinedTags: $predefinedTags)
          .zIndex(13)
      }
      if showConversation{
        ConversationView(playersAssignedCharacters: $playersAssignedCharacters, showConversation: $showConversation, allLogs: $allLogs)
          .zIndex(14)
      }
      if showAllCharacterInfos{
        AllCharacterInfosView(playableCharacters: $playableCharacters, showAllCharacterInfos: $showAllCharacterInfos, travelersInPlay: $travelers, fabledInPlay: $fabled)
          .zIndex(15)
      }
      
      if showFabledCharactersSelection{
        FabledSelectionView(fabledInPlay: $fabled, characters: $characters, selectedFabledCharacters: $selectedFabledCharacters, showFabledCharactersSelection: $showFabledCharactersSelection)
          .zIndex(16)
      }
      
      if showSetup{
        SetupView(playableCharacters: $playableCharacters, playersAssignedCharacters: $playersAssignedCharacters, playerCount: $playerCount, showSetup: $showSetup, aiSetupNotes: $aiSetupNotes, openAISetupOnAppear: $openAISetupOnAppear, onStage: { demoSetupStage = $0 }, demoBag: $demoBag, demoStage: $demoStageRequest)
          .zIndex(17)
      }
        
      
      HStack{
        // we do a menu bar here
        MenuView(firstNightOrder: $firstNightOrder, showMenu: $showMenu, showNotepad: $showNotepad, showConversation: $showConversation, showAllCharacterInfos: $showAllCharacterInfos, showAIAdvisor: $showAIAdvisor, showExitConfirmation: $showExitConfirmation, currentView: $currentView, gameState: $gameState, allLogs: $allLogs, votingPhase: $votingPhase, nominationPhase: $nominationPhase, playersAssignedCharacters: $playersAssignedCharacters)
          .alert("确定离开当前城镇吗？", isPresented: $showExitConfirmation) {
            Button("取消", role: .cancel) { }
            Button("确定", role: .destructive) {
              currentView = 0
            }
          } message: {
            Text(GameArchive.shouldSave(makeSaveData()) ? "这一局已经存进存档，可以在存档里载入" : "还没分好角色，这个城镇不会保存")
          }
          .background(RoundedRectangle(cornerRadius: 10).fill(Color.mainbg))
          .overlay(RoundedRectangle(cornerRadius: 10)
            .stroke(Color.ink.opacity(1), lineWidth: 3))
        ScrollViewReader { scrollProxy in
        ScrollView(showsIndicators: false) {
          Color.clear.frame(height: 0).id("demo.top")
          PlayersView(playersAssignedCharacters: $playersAssignedCharacters,
                      playersStates: $playersStates,
                      characters: $characters,
                      currentSelectedPlayerID: $currentSelectedPlayerID,
                      selectNewCharacter: $selectNewCharacter,
                      currentSelectedPlayerIDForReminder: $currentSelectedPlayerIDForReminder,
                      selectNewReminder: $selectNewReminder,
                      selectedReminderIndex: $selectedReminderIndex,
                      playersIsAlive: $playersIsAlive,
                      playersHasDeathVote: $playersHasDeathVote,
                      aliveCount: $aliveCount,
                      gameState: $gameState,
                      allLogs: $allLogs,
                      globalStates: $globalStates,
                      numCols: demo ? 3 : appSettings.cardsPerRow,
                      forceGrid: demo
          )
          if (gameState == 0){
            HStack{
              Button(action: {showSetup = true}){
                Text("说书人配版")
                  .font(.system(size: 20,  design: .rounded))
                  .fontWeight(.bold)
                  .padding()
                  .foregroundColor(.ink)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 150)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.ink, lineWidth: 3))
                  .contentShape(RoundedRectangle(cornerRadius: 30))
              }
              .padding(.top, 30)
              Button(action: {
                openAISetupOnAppear = true
                showSetup = true
              }){
                Text("AI配版")
                  .font(.system(size: 20,  design: .rounded))
                  .fontWeight(.bold)
                  .padding()
                  .foregroundColor(.ink)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 130)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.ink, lineWidth: 3))
                  .contentShape(RoundedRectangle(cornerRadius: 30))
              }
              .padding(.top, 30)
              .padding(.leading, 20)
              Button(action: {showAIPostDraw = true}){
                Text("AI补完配版")
                  .font(.system(size: 20,  design: .rounded))
                  .fontWeight(.bold)
                  .padding()
                  .foregroundColor(.ink)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 170)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.ink, lineWidth: 3))
                  .contentShape(RoundedRectangle(cornerRadius: 30))
              }
              .padding(.top, 30)
              .padding(.leading, 20)
            }
            .tutorialAnchor("setup.buttons")
            .frame(maxWidth: .infinity)
            .id("demo.setup")
          }
        }
        .frame(maxWidth: .infinity)
//        .padding(.horizontal, 10)
        .animation(.easeInOut(duration: 0.3), value: playersAssignedCharacters)
        .onChange(of: demoScrollTarget) { _, target in
          if let target = target {
            withAnimation(.easeInOut(duration: 0.35)) { scrollProxy.scrollTo(target, anchor: target == "demo.top" ? .top : .bottom) }
          }
        }
        }
        .shadow(color: .black.opacity(0.2), radius: 5, x: 3, y: 5)
        //        Spacer()
        VStack{
          FabledListView(selectedFabledCharacters: $selectedFabledCharacters, showFabledCharactersSelection: $showFabledCharactersSelection)
            .animation(.easeInOut(duration: 0.3), value: selectedFabledCharacters)
            .padding(.horizontal)
            .frame(width: 110)
//            .frame(maxHeight: .infinity)
            .background(Color.mainbg)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.ink.opacity(1), lineWidth: 3)
            )
            .tutorialAnchor("fabled")
          TimerView(gameState: $gameState)
            .animation(.easeInOut(duration: 0.3), value: gameState)
            .frame(width: 110)
            .background(Color.mainbg)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.ink.opacity(1), lineWidth: 3)
            )
            .tutorialAnchor("timer")
////            .frame(maxHeight: .infinity)
          FakeCover(playersAssignedCharacters: $playersAssignedCharacters, notPresentedGoodCharacters: $notPresentedGoodCharacters, selectNewCharacter: $selectNewCharacter, currentSelectedPlayerID: $currentSelectedPlayerID)
            .animation(.easeInOut(duration: 0.3), value: notPresentedGoodCharacters)
            .padding(.vertical, 20)
            .frame(width: 110)
            .background(Color.mainbg)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.ink.opacity(1), lineWidth: 3)
            )
            .tutorialAnchor("bluffs")
//            .padding(.top, 10)
        }
        .zIndex(1)
        
        VStack{
          VStack(spacing: 2){
            PlayInfo(playName: $playName, playAuthor: $playAuthor)
              .padding(.top, 10)
              .padding(.bottom, 5)
              .padding(.horizontal, 10)
              .frame(maxWidth: .infinity)
            TeamInfo(playerCount: $playerCount)
              .padding(.horizontal, 10)
              .frame(maxWidth: .infinity)
              .padding(.vertical, 2)
            TeamActualInfo(playersAssignedCharacters: $playersAssignedCharacters)
              .padding(.horizontal, 10)
              .frame(maxWidth: .infinity)
              .padding(.vertical, 2)
            SurvivorInfo(playerCount: $playerCount, aliveCount: $aliveCount)
              .padding(.horizontal, 10)
              .padding(.bottom, 10)
              .frame(maxWidth: .infinity)
          } // end of the vstack for meta information
          .frame(height: 120)
          .background(Color.mainbg)
          .clipShape(RoundedRectangle(cornerRadius: 10))
          .overlay(
            RoundedRectangle(cornerRadius: 10)
              .stroke(Color.ink.opacity(1), lineWidth: 3)
          )
          .tutorialAnchor("info")
          ExtraCareView(jinxList: $jinxList, playersAssignedCharacters: $playersAssignedCharacters, playersIsAlive: $playersIsAlive, votingPhase: $votingPhase, nominationPhase: $nominationPhase, gameState: $gameState)
            .frame(maxHeight: .infinity)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.ink.opacity(1), lineWidth: 3)
            )
            .tutorialAnchor("extraCare")
            .padding(.top, 10)
          Group{
            if (gameState == 0){
              ExtraSetup(playableCharacters: $playableCharacters, playersAssignedCharacters: $playersAssignedCharacters)
            }else if (gameState == 1 || gameState == 3){
              OrderView(playersAssignedCharacters: $playersAssignedCharacters, playableCharacters: $playableCharacters, playersIsAlive: $playersIsAlive, firstNightOrder: $firstNightOrder, currentlyAwakePlayerIndex: $currentlyAwakePlayerIndex, allLogs: $allLogs)
            }else if (gameState == 2){
              VotingView(playersAssignedCharacters: $playersAssignedCharacters, playerCount: $playerCount, aliveCount: $aliveCount, playersIsAlive: $playersIsAlive, playersHasDeathVote: $playersHasDeathVote, allLogs: $allLogs, votingPhase: $votingPhase, nominationPhase: $nominationPhase)
            }
          } // end of group
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(Color.mainbg)
          .clipShape(RoundedRectangle(cornerRadius: 10))
          .overlay(
            RoundedRectangle(cornerRadius: 10)
              .stroke(Color.ink.opacity(1), lineWidth: 3)
          )
          .transition(.move(edge: .trailing))
          .tutorialAnchor("rightPanel")
          .padding(.top, 10)
        } // end of v stack for meta information
        .frame(width: 260)
        .padding(.trailing, 10)
        .animation(.easeInOut(duration: 0.3), value: gameState)
        //        .background(.gray)
      }
      
    } // end of the outer zstack
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .overlayPreferenceValue(TutorialAnchorKey.self) { anchors in
      if demo {
        TourOverlay(steps: tourSteps, anchors: anchors, onFinish: finishDemo)
      }
    }
    .alert(isPresented: $showAlert) {
      Alert(title: Text("错误"), message: Text(alertMessage), dismissButton: .default(Text("确定")))
    }
    .onChange(of: showSetup) { _, isShowing in
      // 用 AI 配的版，玩家抽完卡回到主界面时，直接接上“AI补完配版”
      let everyoneHasCharacter = !playersAssignedCharacters.isEmpty && !playersAssignedCharacters.contains(where: { $0.name.isEmpty })
      if !isShowing && gameState == 0 && !aiSetupNotes.isEmpty && everyoneHasCharacter {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
          showAIPostDraw = true
        }
      }
    }
    .sheet(isPresented: $showAIAdvisor) {
      AIAdvisorView(chat: $aiChat, makeContext: makeAIContext)
    }
    .sheet(isPresented: $showAIPostDraw) {
      AIPostDrawSheet(makeContext: makeAIContext) { tags, bluffs in
        applyAIPostDraw(tags: tags, bluffs: bluffs)
      }
    }
    .onAppear(){
      if !loadLast{
        loadGameData(
          from: playJSON,
          characters: &characters,
          playableCharacters: &playableCharacters,
          travelers: &travelers,
          fabled: &fabled,
          allReminders: &allReminders,
          jinxList: &jinxList,
          playName: &playName,
          playAuthor: &playAuthor,
          alertMessage: &alertMessage,
          showAlert: &showAlert
        )
        if demo {
          setupDemo()
          return
        }
        // 按设置预设玩家人数
        let count = appSettings.defaultPlayerCount
        if count > 0 && playersAssignedCharacters.isEmpty {
          playerCount = count
          aliveCount = count
          playersAssignedCharacters = Array(repeating: defaultCharacter, count: count)
          playersStates = Array(repeating: [Reminder](), count: count)
          playersIsAlive = Array(repeating: true, count: count)
          playersHasDeathVote = Array(repeating: true, count: count)
        }
      }else{
        if let data = UserDefaults.standard.data(forKey: "SavedGameState") {
          do {
            let decoded = try JSONDecoder().decode(GameSaveData.self, from: data)
            
            self.playName = decoded.playName
            self.playAuthor = decoded.playAuthor
            self.gameState = decoded.gameState
            self.characters = decoded.characters
            self.playersAssignedCharacters = decoded.playersAssignedCharacters
            self.playersIsAlive = decoded.playersIsAlive
            self.playersHasDeathVote = decoded.playersHasDeathVote
            self.playerCount = decoded.playersAssignedCharacters.count
            self.aliveCount = decoded.aliveCount
            self.playableCharacters = decoded.playableCharacters
            self.travelers = decoded.travelers
            self.fabled = decoded.fabled
            self.notPresentedGoodCharacters = decoded.notPresentedGoodCharacters
            self.jinxList = decoded.jinxList
            self.allReminders = decoded.allReminders
            self.playersStates = decoded.playersStates
            self.currentSelectedPlayerID = decoded.currentSelectedPlayerID
            self.selectNewCharacter = decoded.selectNewCharacter
            self.currentSelectedPlayerIDForReminder = decoded.currentSelectedPlayerIDForReminder
            self.selectNewReminder = decoded.selectNewReminder
            self.selectedReminderIndex = decoded.selectedReminderIndex
            self.allLogs = decoded.allLogs
            self.firstNightOrder = decoded.firstNightOrder
            self.currentlyAwakePlayerIndex = decoded.currentlyAwakePlayerIndex
            self.selectedFabledCharacters = decoded.selectedFabledCharacters
            self.globalStates = decoded.globalStates
            self.gameID = decoded.gameID ?? UUID().uuidString
            
            print("[Load] Successfully restored saved game.")
          } catch {
            print("[Load] Failed to decode saved data:", error)
            self.alertMessage = "读取存档失败。"
            self.showAlert = true
          }
        } else {
          print("[Load] No saved game found.")
          self.alertMessage = "没有找到存档。"
          self.showAlert = true
        }
      }
    }
    .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { _ in
      saveGame()
    }
    .onChange(of: gameState) { _, newValue in
      // 开始游戏、天亮、入夜时各存一次
      saveGame()
      appSettings.gameIsNight = newValue == 1 || newValue == 3
    }
    .onChange(of: playersAssignedCharacters.map(\.name)) { _, _ in
      // 发角色、换角色、加减人时存一次，保证配完版就有存档
      saveGame()
    }
    .onChange(of: characters.count) { _, _ in
      // 有网的时候把这个剧本的图标都存到本机，之后断网也能显示
      ImageCache.shared.prefetch(characters.map { $0.imageURL })
    }
    .task {
      try? await Task.sleep(nanoseconds: 500_000_000)
      ImageCache.shared.prefetch(characters.map { $0.imageURL } + selectedFabledCharacters.map { $0.imageURL })
    }
    .onDisappear {
      appSettings.gameIsNight = false
      saveGame()
      UndoCenter.shared.clear()
    }
    .overlay(alignment: .bottom) {
      UndoToast()
        .padding(.bottom, 24)
    }
    .onChange(of: showArchive) { _, showing in
      // 打开存档前先存一次，列表里就是最新的状态
      if showing {
        saveGame()
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
      saveGame()
    }
    .onChange(of: predefinedTags) { _, tags in
      // 记事本里新加的常用词也记到设置里
      if tags != appSettings.notepadTags {
        appSettings.notepadTags = tags
      }
    }
    .sheet(isPresented: $showSettings, onDismiss: {
      predefinedTags = appSettings.notepadTags
    }) {
      SettingsView()
    }
    .sheet(isPresented: $showArchive) {
      ArchiveView(currentGameID: gameID) { id in
        loadArchive(id)
      }
    }
    .animation(.easeInOut(duration: 0.3), value: selectNewCharacter)
    .animation(.easeInOut(duration: 0.3), value: selectNewReminder)
    .animation(.easeInOut(duration: 0.3), value: showNotepad)
    .animation(.easeInOut(duration: 0.3), value: showConversation)
    .animation(.easeInOut(duration: 0.3), value: showAllCharacterInfos)
    .animation(.easeInOut(duration: 0.3), value: showFabledCharactersSelection)
  } // end of body
  
}

#Preview {
  StoryTellerView(currentView: .constant(1), loadLast: .constant(false), playJSON: test_json2)
}
