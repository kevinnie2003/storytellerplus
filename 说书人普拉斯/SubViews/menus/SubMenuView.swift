//
//  SubMenuView.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/22/25.
//
import SwiftUI
struct SubMenuView: View {
  @Binding var showSettings: Bool
  @Binding var showArchive: Bool
  @Binding var playersAssignedCharacters: [Character]
  @Binding var playersStates: [[Reminder]]
  @Binding var playersIsAlive: [Bool]
  @Binding var playersHasDeathVote: [Bool]
  @Binding var playerCount: Int
  @Binding var aliveCount: Int
  @Binding var playableCharacters: [Character]
  @Binding var notPresentedGoodCharacters: [Character]
  @Binding var showMenu: Bool
  @Binding var gameState: Int
  @Binding var allLogs: [GameLogEntry]
  @AppStorage(hideTeamColorsKey) private var hideTeamColors: Bool = false
  
  func selectCharacters(team: Int) -> [Character] {
    var teamName: String
    let teamCount: [Int] = teamCounts[playerCount] ?? [0, 0, 0, 0, 0]
    if team == 0{
      teamName = "townsfolk"
    }else if team == 1{
      teamName = "outsider"
    }else if team == 2{
      teamName = "minion"
    }else if team == 3{
      teamName = "demon"
    }else{
      teamName = "traveler"
    }
    
    let filteredCharacter = playableCharacters.filter { $0.team == teamName }
    var selected: [Character]
    if filteredCharacter.isEmpty {
      selected = Array(repeating: defaultCharacter, count: teamCount[team])
    } else if filteredCharacter.count >= teamCount[team] {
      selected = Array(filteredCharacter.shuffled().prefix(teamCount[team]))
    } else {
      selected = (0..<teamCount[team]).map { _ in filteredCharacter.randomElement()! }
    }
    return selected
  }
  
  /// 能不能减少玩家：配版阶段随时可以；游戏开始后只能去掉最后一个、还没分配角色的玩家（比如中途误加的人）
  private var canRemoveLastPlayer: Bool {
    guard playerCount > 0, let last = playersAssignedCharacters.last else {
      return false
    }
    return gameState == 0 || last.name.isEmpty
  }
  
  func removeLastPlayer(){
    guard canRemoveLastPlayer else {
      return
    }
    let lastIndex = playersAssignedCharacters.count - 1
    let wasAlive = lastIndex < playersIsAlive.count ? playersIsAlive[lastIndex] : true
    let removedCharacter = playersAssignedCharacters[lastIndex]
    let removedStates = lastIndex < playersStates.count ? playersStates[lastIndex] : []
    let removedVote = lastIndex < playersHasDeathVote.count ? playersHasDeathVote[lastIndex] : true
    var removedLog: (Int, GameLogEntry)? = nil
    if wasAlive {
      aliveCount -= 1
    }
    playersAssignedCharacters.removeLast()
    if !playersStates.isEmpty { playersStates.removeLast() }
    if !playersIsAlive.isEmpty { playersIsAlive.removeLast() }
    if !playersHasDeathVote.isEmpty { playersHasDeathVote.removeLast() }
    if gameState != 0, let i = allLogs.lastIndex(where: { $0.type == 7 && $0.messager == lastIndex + 1 }) {
      // 撤掉“几号玩家加入游戏”这条记录
      removedLog = (i, allLogs[i])
      allLogs.remove(at: i)
    }
    playerCount = max(playerCount - 1, 0)
    UndoCenter.shared.register("已删除 \(lastIndex + 1) 号") {
      playersAssignedCharacters.append(removedCharacter)
      playersStates.append(removedStates)
      playersIsAlive.append(wasAlive)
      playersHasDeathVote.append(removedVote)
      if wasAlive { aliveCount += 1 }
      if let (i, entry) = removedLog {
        allLogs.insert(entry, at: min(i, allLogs.count))
      }
      playerCount += 1
    }
  }
  
  private func addPlayer() {
    guard playerCount < 20 else {
      return
    }
    aliveCount += 1
    playersAssignedCharacters.append(defaultCharacter)
    playersStates.append([Reminder]())
    playersIsAlive.append(true)
    playersHasDeathVote.append(true)
    var joinLog: GameLogEntry? = nil
    if (gameState != 0){
      let entry = GameLogEntry(message: "", messager: playerCount + 1, source: "说书人", type: 7, playerNumbers: [playerCount + 1])
      allLogs.append(entry)
      joinLog = entry
    }
    playerCount += 1
    let added = playerCount
    UndoCenter.shared.register("已加入 \(added) 号") {
      // 只在最后一位还是刚加的空位时撤销
      guard playersAssignedCharacters.count == added, playersAssignedCharacters.last?.name.isEmpty == true else { return }
      playersAssignedCharacters.removeLast()
      if !playersStates.isEmpty { playersStates.removeLast() }
      if let alive = playersIsAlive.popLast(), alive { aliveCount -= 1 }
      if !playersHasDeathVote.isEmpty { playersHasDeathVote.removeLast() }
      if let entry = joinLog { allLogs.removeAll(where: { $0.id == entry.id }) }
      playerCount -= 1
    }
  }
  
  private func randomAssign() {
    if playerCount >= 5{
      //                var teamCount = [0, 0, 0, 0, 0]
      var selectedCharacters: [Character] = []
      selectedCharacters.append(contentsOf: selectCharacters(team: 0))
      selectedCharacters.append(contentsOf: selectCharacters(team: 1))
      selectedCharacters.append(contentsOf: selectCharacters(team: 2))
      selectedCharacters.append(contentsOf: selectCharacters(team: 3))
      selectedCharacters.append(contentsOf: selectCharacters(team: 4))
      // now we have the selected characters
      playersAssignedCharacters = selectedCharacters.shuffled()
      //                print("Selected characters: \(selectedCharacters)")
      let filteredGoodCharacters = playableCharacters.filter { $0.team == "townsfolk" || $0.team == "outsider"}
      // select 3 characters that are not in assigned characters
      let assignedNames = Set(playersAssignedCharacters.map { $0.name })
      let unassignedGoodCharacters = filteredGoodCharacters.filter { !assignedNames.contains($0.name) }
      let selected = Array(unassignedGoodCharacters.shuffled().prefix(3))
      notPresentedGoodCharacters = selected
    }
  }
  
  private func startGame() {
    if playersAssignedCharacters.count < 5 {
      return
    }
    for (index, character) in playersAssignedCharacters.enumerated() {
      allLogs.append(GameLogEntry(message: "获得角色：\(character.name)", messager: index + 1, source: "说书人", type: 0, playerCharacters: [character.name], playerTeams: [team2Int(character.team)]))
      for reminder in playersStates[index] {
        allLogs.append(GameLogEntry(message: "\(reminder.effect)", messager: index + 1, source: reminder.from, type: 1, characterName: character.name, playerNumbers: [reminder.playerId], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team]))
      }
    }
    for index in 0..<notPresentedGoodCharacters.count{
      if notPresentedGoodCharacters[index].name != "" {
        let character = notPresentedGoodCharacters[index]
        allLogs.append(GameLogEntry(message: "", messager: 0, source: "说书人", type: 13, playerCharacters: [character.name], playerTeams: [team2Int(character.team)]))
      }
      
    }
    allLogs.append(GameLogEntry(message: "游戏开始", messager: 0, source: "说书人", type: 8, characterName: ""))
    allLogs.append(GameLogEntry(message: "第一夜", messager: 0, source: "说书人", type: 9, characterName: ""))
    if gameState == 0{
      gameState = 1
    }
    showMenu = false
  }
  
  private func close() {
    withAnimation(.easeInOut(duration: 0.2)) {
      showMenu = false
    }
  }
  
  private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Image(systemName: icon)
          .font(.system(size: 18, weight: .bold))
          .frame(width: 24)
        Text(title)
          .font(.system(size: 18, weight: .bold, design: .rounded))
        Spacer(minLength: 0)
      }
      .foregroundColor(.ink)
      .padding(.horizontal, 14)
      .padding(.vertical, 11)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
  
  var body: some View {
    ZStack(alignment: .bottomLeading) {
      Color.black.opacity(0.001)
        .ignoresSafeArea(.all)
        .onTapGesture(perform: close)
      VStack(alignment: .leading, spacing: 0) {
        // 玩家人数：减、当前人数、加
        HStack(spacing: 0) {
          Text("玩家")
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .padding(.leading, 14)
          Spacer()
          Button(action: removeLastPlayer) {
            Image(systemName: "minus")
              .font(.system(size: 24, weight: .black))
              .frame(width: 64, height: 52)
              .background(RoundedRectangle(cornerRadius: 12).fill(Color.mainbg.opacity(0.6)))
              .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.ink, lineWidth: 2.5))
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .disabled(!canRemoveLastPlayer)
          .opacity(canRemoveLastPlayer ? 1 : 0.3)
          Text("\(playerCount)")
            .font(.system(size: 24, weight: .black, design: .rounded))
            .frame(minWidth: 44)
          Button(action: addPlayer) {
            Image(systemName: "plus")
              .font(.system(size: 24, weight: .black))
              .frame(width: 64, height: 52)
              .background(RoundedRectangle(cornerRadius: 12).fill(Color.mainbg.opacity(0.6)))
              .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.ink, lineWidth: 2.5))
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .disabled(playerCount >= 20)
          .opacity(playerCount >= 20 ? 0.3 : 1)
        }
        .foregroundColor(.ink)
        .padding(.vertical, 8)
        .padding(.trailing, 8)
        .tutorialAnchor("gear.players")
        if gameState == 0 {
          Divider().overlay(Color.ink)
          row("随机分配角色", icon: "shuffle", action: randomAssign)
          Button(action: startGame) {
            HStack(spacing: 12) {
              Image(systemName: "play.fill")
                .font(.system(size: 18, weight: .bold))
                .frame(width: 24)
              Text("开始游戏")
                .font(.system(size: 18, weight: .black, design: .rounded))
              Spacer(minLength: 0)
            }
            .foregroundColor(Color.paper)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(Color.ink)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
          }
          .buttonStyle(.plain)
          .tutorialAnchor("gear.start")
          .disabled(playersAssignedCharacters.count < 5)
          .opacity(playersAssignedCharacters.count < 5 ? 0.4 : 1)
        }
        Divider().overlay(Color.ink)
        row(hideTeamColors ? "显示阵营颜色" : "隐藏阵营颜色", icon: hideTeamColors ? "eye" : "eye.slash") {
          withAnimation(.easeInOut(duration: 0.3)) {
            hideTeamColors.toggle()
          }
        }
        row("存档", icon: "tray.full") {
          showMenu = false
          showArchive = true
        }
        row("设置", icon: "gearshape") {
          showMenu = false
          showSettings = true
        }
      }
      .frame(width: 280)
      .background(Color.paper)
      .clipShape(RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.ink, lineWidth: 3))
      .padding(.bottom, 70)
      .transition(.scale(scale: 0.9, anchor: .bottomLeading).combined(with: .opacity))
    }
  }
}
