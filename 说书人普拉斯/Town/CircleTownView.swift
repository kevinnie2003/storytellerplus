//
//  CircleTownView.swift
//  说书人普拉斯
//
//  圆桌摆法：玩家按座位围成一圈，和实体魔典一样看邻座关系
//

import SwiftUI

struct CircleSeat: View {
  let index: Int
  @Binding var playersAssignedCharacters: [Character]
  @Binding var reminders: [Reminder]
  let gameState: Int
  @Binding var currentSelectedPlayerID: Int
  @Binding var selectNewCharacter: Bool
  @Binding var currentSelectedPlayerIDForReminder: Int
  @Binding var selectNewReminder: Bool
  @Binding var selectedReminderIndex: Int
  @Binding var playersIsAlive: [Bool]
  @Binding var playersHasDeathVote: [Bool]
  @Binding var aliveCount: Int
  @Binding var allLogs: [GameLogEntry]
  let width: CGFloat
  var isSelected: Bool = false
  var onSelect: () -> Void = {}
  @AppStorage(hideTeamColorsKey) private var hideTeamColors: Bool = false
  @ObservedObject private var appSettings = AppSettings.shared
  @State private var showDeathConfirm = false
  
  private var character: Character { playersAssignedCharacters[index] }
  private var isAlive: Bool { index < playersIsAlive.count ? playersIsAlive[index] : true }
  
  private var fill: Color {
    if hideTeamColors && isPlayerTeam(character.team) {
      return .neutralTeam
    }
    return character.team.isEmpty ? Color.mainbg : team2Color(character.team)
  }
  
  private func tagColor(_ team: Int) -> Color {
    hideTeamColors ? Color.neutralTeam : teamid2Color(team)
  }
  
  private func toggle() {
    TownActions.toggleAlive(index: index, players: playersAssignedCharacters, alive: $playersIsAlive, deathVote: $playersHasDeathVote, aliveCount: $aliveCount, logs: $allLogs)
  }
  
  private func requestToggle() {
    if gameState == 0 {
      return
    }
    if appSettings.confirmDeath {
      showDeathConfirm = true
    } else {
      toggle()
    }
  }
  
  var body: some View {
    VStack(spacing: 5) {
      ZStack(alignment: .topLeading) {
        CachedImageView(urlString: character.imageURL)
          .grayscale(hideTeamColors ? 1 : 0)
          .frame(width: 58, height: 58)
          .background(Circle().fill(Color.goodTextBg))
          .overlay(Circle().stroke(Color.black, lineWidth: 2.5))
          .onTapGesture {
            currentSelectedPlayerID = index
            selectNewCharacter = true
          }
        Text("\(index + 1)")
          .font(.system(size: 15, weight: .black, design: .rounded))
          .foregroundColor(Color.goodTextBg)
          .frame(width: 28, height: 28)
          .background(Circle().fill(Color.black))
          .overlay(
            Image(systemName: "xmark")
              .font(.system(size: 26, weight: .black))
              .foregroundColor(.demon)
              .opacity(isAlive ? 0 : 1)
          )
          .offset(x: -12, y: -8)
          .modifier(SeatNumberGesture(byTap: appSettings.deathByTap, seconds: appSettings.deathLongPressSeconds, action: requestToggle))
          .alert(isAlive ? "让 \(index + 1) 号死亡吗？" : "让 \(index + 1) 号复活吗？", isPresented: $showDeathConfirm) {
            Button("取消", role: .cancel) {}
            Button("确定", role: .destructive) { toggle() }
          }
      }
      Text(character.name.isEmpty ? "未分配" : character.name)
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundColor(Color.goodTextBg)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Capsule().fill(fill))
        .overlay(Capsule().stroke(Color.black, lineWidth: isSelected ? 4 : 2))
        .scaleEffect(isSelected ? 1.12 : 1)
        .onTapGesture(perform: onSelect)
      VStack(spacing: 3) {
        ForEach(reminders.indices, id: \.self) { i in
          let reminder = reminders[i]
          Text(reminder.effect)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(Color.goodTextBg)
            .lineLimit(1)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(Capsule().fill(tagColor(reminder.team)))
            .rotationEffect(reminder.isReversed ? .degrees(180) : .zero)
            .onTapGesture(count: 2) {
              let entry = GameLogEntry(message: reminder.effect, messager: index + 1, source: reminder.from, type: 14, characterName: character.name, playerNumbers: [index + 1], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team])
              TownActions.removeReminder(at: i, from: $reminders, logEntry: entry, logs: $allLogs, label: "\(index + 1) 号的标签")
            }
        }
        Button(action: {
          currentSelectedPlayerIDForReminder = index
          selectNewReminder = true
          selectedReminderIndex = -1
        }) {
          Image(systemName: "plus")
            .font(.system(size: 12, weight: .black))
            .foregroundColor(.black)
            .frame(width: 22, height: 22)
            .overlay(Circle().stroke(Color.black, lineWidth: 2))
        }
        .buttonStyle(.plain)
      }
    }
    .frame(width: width)
    .opacity(isAlive ? 1 : 0.5)
  }
}

struct CircleTownView: View {
  @Binding var playersAssignedCharacters: [Character]
  @Binding var playersStates: [[Reminder]]
  @Binding var currentSelectedPlayerID: Int
  @Binding var selectNewCharacter: Bool
  @Binding var currentSelectedPlayerIDForReminder: Int
  @Binding var selectNewReminder: Bool
  @Binding var selectedReminderIndex: Int
  @Binding var playersIsAlive: [Bool]
  @Binding var playersHasDeathVote: [Bool]
  @Binding var aliveCount: Int
  @Binding var gameState: Int
  @Binding var allLogs: [GameLogEntry]
  @State private var selectedSeat: Int? = nil
  @AppStorage(hideTeamColorsKey) private var hideTeamColors: Bool = false
  
  /// 圆桌中间：选中某个座位时显示他的能力，没选中时显示存活人数
  @ViewBuilder
  private func centerPanel(count: Int, width: CGFloat) -> some View {
    if let seat = selectedSeat, seat < count {
      let character = playersAssignedCharacters[seat]
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 10) {
          CachedImageView(urlString: character.imageURL)
            .grayscale(hideTeamColors ? 1 : 0)
            .frame(width: 44, height: 44)
          Text("\(seat + 1) 号 \(character.name.isEmpty ? "未分配" : character.name)")
            .font(.system(size: 22, weight: .black, design: .rounded))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Spacer(minLength: 0)
          Button(action: { selectedSeat = nil }) {
            Image(systemName: "xmark")
              .font(.system(size: 15, weight: .black))
              .foregroundColor(.black)
              .padding(6)
          }
          .buttonStyle(.plain)
        }
        ScrollView {
          Text(character.ability)
            .font(.system(size: 17, weight: .medium, design: .rounded))
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxHeight: 150)
      }
      .padding(16)
      .frame(width: width)
      .background(Color.goodTextBg)
      .clipShape(RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black, lineWidth: 3))
      .fixedSize(horizontal: false, vertical: true)
    } else {
      VStack(spacing: 4) {
        Text("\(aliveCount)")
          .font(.system(size: 54, weight: .black, design: .rounded))
        Text("人存活，共 \(count) 人")
          .font(.system(size: 17, weight: .semibold, design: .rounded))
          .foregroundColor(.black.opacity(0.6))
      }
    }
  }
  
  /// 在椭圆上按弧长等距取 n 个点，1 号在正上方，顺时针。椭圆两侧不会挤在一起。
  private func seatPositions(count: Int, center: CGPoint, rx: CGFloat, ry: CGFloat) -> [CGPoint] {
    guard count > 0 else { return [] }
    let samples = 720
    var points: [CGPoint] = []
    var lengths: [CGFloat] = [0]
    for i in 0...samples {
      let t = 2 * Double.pi * Double(i) / Double(samples) - Double.pi / 2
      let p = CGPoint(x: center.x + rx * cos(t), y: center.y + ry * sin(t))
      if let last = points.last {
        lengths.append(lengths.last! + hypot(p.x - last.x, p.y - last.y))
      }
      points.append(p)
    }
    let total = lengths.last!
    var result: [CGPoint] = []
    var j = 0
    for k in 0..<count {
      let target = total * CGFloat(k) / CGFloat(count)
      while j < lengths.count - 1 && lengths[j + 1] < target {
        j += 1
      }
      result.append(points[j])
    }
    return result
  }
  
  var body: some View {
    let count = min(playersAssignedCharacters.count, playersStates.count, playersIsAlive.count)
    GeometryReader { geo in
      let seatWidth: CGFloat = count > 12 ? 96 : 116
      let rx = max(geo.size.width / 2 - seatWidth / 2 - 6, 120)
      let ry = max(geo.size.height / 2 - 66, 120)
      let positions = seatPositions(count: count, center: CGPoint(x: geo.size.width / 2, y: geo.size.height / 2 + 12), rx: rx, ry: ry)
      let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
      ZStack {
        centerPanel(count: count, width: min(2 * rx - seatWidth - 40, 400))
          .position(center)
          .animation(.easeOut(duration: 0.15), value: selectedSeat)
        ForEach(0..<count, id: \.self) { index in
          CircleSeat(
            index: index,
            playersAssignedCharacters: $playersAssignedCharacters,
            reminders: $playersStates[index],
            gameState: gameState,
            currentSelectedPlayerID: $currentSelectedPlayerID,
            selectNewCharacter: $selectNewCharacter,
            currentSelectedPlayerIDForReminder: $currentSelectedPlayerIDForReminder,
            selectNewReminder: $selectNewReminder,
            selectedReminderIndex: $selectedReminderIndex,
            playersIsAlive: $playersIsAlive,
            playersHasDeathVote: $playersHasDeathVote,
            aliveCount: $aliveCount,
            allLogs: $allLogs,
            width: seatWidth,
            isSelected: selectedSeat == index,
            onSelect: { selectedSeat = (selectedSeat == index) ? nil : index }
          )
          .position(positions[index])
        }
      }
    }
    .frame(height: 620)
    .padding(.top, 10)
  }
}
