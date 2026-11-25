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
  
  /// 保存当前这一局：一份作为“返回小镇”用的最近存档，开始游戏之后再在存档列表里存一份
  private func saveGame() {
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
        SetupView(playableCharacters: $playableCharacters, playersAssignedCharacters: $playersAssignedCharacters, playerCount: $playerCount, showSetup: $showSetup, aiSetupNotes: $aiSetupNotes, openAISetupOnAppear: $openAISetupOnAppear)
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
            Text(gameState == 0 ? "还没开始游戏，这个城镇不会保存" : "这一局已经存进存档，可以在设置里载入")
          }
          .background(RoundedRectangle(cornerRadius: 10).fill(Color.mainbg))
          .overlay(RoundedRectangle(cornerRadius: 10)
            .stroke(Color.black.opacity(1), lineWidth: 3))
        ScrollView(showsIndicators: false) {
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
                      numCols: appSettings.cardsPerRow
          )
          if (gameState == 0){
            HStack{
              Button(action: {showSetup = true}){
                Text("说书人配版")
                  .font(.system(size: 20,  design: .rounded))
                  .fontWeight(.bold)
                  .padding()
                  .foregroundColor(.black)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 150)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.black, lineWidth: 3))
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
                  .foregroundColor(.black)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 130)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.black, lineWidth: 3))
                  .contentShape(RoundedRectangle(cornerRadius: 30))
              }
              .padding(.top, 30)
              .padding(.leading, 20)
              Button(action: {showAIPostDraw = true}){
                Text("AI补完配版")
                  .font(.system(size: 20,  design: .rounded))
                  .fontWeight(.bold)
                  .padding()
                  .foregroundColor(.black)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 3)
                  .frame(width: 170)
                  .background(.mainbg)
                  .cornerRadius(30)
                  .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.black, lineWidth: 3))
                  .contentShape(RoundedRectangle(cornerRadius: 30))
              }
              .padding(.top, 30)
              .padding(.leading, 20)
            }
            .frame(maxWidth: .infinity)
          }
        }
        .frame(maxWidth: .infinity)
//        .padding(.horizontal, 10)
        .animation(.easeInOut(duration: 0.3), value: playersAssignedCharacters)
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
                .stroke(Color.black.opacity(1), lineWidth: 3)
            )
          TimerView(gameState: $gameState)
            .animation(.easeInOut(duration: 0.3), value: gameState)
            .frame(width: 110)
            .background(Color.mainbg)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.black.opacity(1), lineWidth: 3)
            )
////            .frame(maxHeight: .infinity)
          FakeCover(playersAssignedCharacters: $playersAssignedCharacters, notPresentedGoodCharacters: $notPresentedGoodCharacters, selectNewCharacter: $selectNewCharacter, currentSelectedPlayerID: $currentSelectedPlayerID)
            .animation(.easeInOut(duration: 0.3), value: notPresentedGoodCharacters)
            .padding(.vertical, 20)
            .frame(width: 110)
            .background(Color.mainbg)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.black.opacity(1), lineWidth: 3)
            )
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
              .stroke(Color.black.opacity(1), lineWidth: 3)
          )
          ExtraCareView(jinxList: $jinxList, playersAssignedCharacters: $playersAssignedCharacters, playersIsAlive: $playersIsAlive, votingPhase: $votingPhase, nominationPhase: $nominationPhase, gameState: $gameState)
            .frame(maxHeight: .infinity)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
              RoundedRectangle(cornerRadius: 10)
                .stroke(Color.black.opacity(1), lineWidth: 3)
            )
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
              .stroke(Color.black.opacity(1), lineWidth: 3)
          )
          .transition(.move(edge: .trailing))
          .padding(.top, 10)
        } // end of v stack for meta information
        .frame(width: 260)
        .padding(.trailing, 10)
        .animation(.easeInOut(duration: 0.3), value: gameState)
        //        .background(.gray)
      }
      
    } // end of the outer zstack
    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
    .onChange(of: gameState) { _, _ in
      // 开始游戏、天亮、入夜时各存一次
      saveGame()
    }
    .onDisappear {
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
      ArchiveView(currentGameID: gameState == 0 ? nil : gameID) { id in
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
