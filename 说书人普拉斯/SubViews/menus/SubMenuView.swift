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
  
  func removeLastPlayer(){
    if gameState == 0 {
      if (playerCount > 0){
        aliveCount -= 1
        playersAssignedCharacters.removeLast()
        playersStates.removeLast()
        playersIsAlive.removeLast()
        playersHasDeathVote.removeLast()
        print("Players assigned characters count: \(playersAssignedCharacters.count)")
        print("Players states count: \(playersStates.count)")
        print("Players is alive count: \(playersIsAlive.count)")
      }
      playerCount = max(playerCount - 1, 0)
    }
  }
  
  private func addPlayer() {
    if (playerCount < 20){
      aliveCount += 1
      playersAssignedCharacters.append(defaultCharacter)
      playersStates.append([Reminder]())
      playersIsAlive.append(true)
      playersHasDeathVote.append(true)
      if (gameState != 0){
        allLogs.append(GameLogEntry(message: "", messager: playerCount + 1, source: "说书人", type: 7, playerNumbers: [playerCount + 1]))
      }
    }
    playerCount = min(playerCount + 1, 20)
    
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
      .foregroundColor(.black)
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
              .font(.system(size: 18, weight: .black))
              .frame(width: 44, height: 40)
          }
          .buttonStyle(.plain)
          .disabled(gameState != 0 || playerCount == 0)
          .opacity(gameState != 0 || playerCount == 0 ? 0.3 : 1)
          Text("\(playerCount)")
            .font(.system(size: 22, weight: .black, design: .rounded))
            .frame(minWidth: 36)
          Button(action: addPlayer) {
            Image(systemName: "plus")
              .font(.system(size: 18, weight: .black))
              .frame(width: 44, height: 40)
          }
          .buttonStyle(.plain)
          .disabled(playerCount >= 20)
          .opacity(playerCount >= 20 ? 0.3 : 1)
        }
        .foregroundColor(.black)
        .padding(.vertical, 4)
        if gameState == 0 {
          Divider().overlay(Color.black)
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
            .foregroundColor(Color.goodTextBg)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
          }
          .buttonStyle(.plain)
          .disabled(playersAssignedCharacters.count < 5)
          .opacity(playersAssignedCharacters.count < 5 ? 0.4 : 1)
        }
        Divider().overlay(Color.black)
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
      .frame(width: 250)
      .background(Color.goodTextBg)
      .clipShape(RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black, lineWidth: 3))
      .padding(.bottom, 70)
      .transition(.scale(scale: 0.9, anchor: .bottomLeading).combined(with: .opacity))
    }
  }
}
