//
//  TownActions.swift
//  说书人普拉斯
//
//  死亡/复活、删除标签这些操作，以及“撤销”提示
//

import SwiftUI

/// 屏幕底部的撤销提示：最近一次操作，几秒内可以撤销
final class UndoCenter: ObservableObject {
  static let shared = UndoCenter()
  @Published private(set) var message: String? = nil
  private var action: (() -> Void)? = nil
  private var token = UUID()
  
  func register(_ message: String, undo: @escaping () -> Void) {
    guard AppSettings.shared.undoEnabled else {
      return
    }
    let current = UUID()
    token = current
    withAnimation(.easeOut(duration: 0.2)) {
      self.message = message
    }
    action = undo
    DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
      if self?.token == current {
        self?.clear()
      }
    }
  }
  
  func undo() {
    action?()
    clear()
  }
  
  func clear() {
    action = nil
    withAnimation(.easeIn(duration: 0.2)) {
      message = nil
    }
  }
}

struct UndoToast: View {
  @ObservedObject private var center = UndoCenter.shared
  var body: some View {
    if let message = center.message {
      HStack(spacing: 18) {
        Text(message)
          .font(.system(size: 18, weight: .bold, design: .rounded))
          .foregroundColor(Color.goodTextBg)
        Button(action: { center.undo() }) {
          Text("撤销")
            .font(.system(size: 18, weight: .black, design: .rounded))
            .foregroundColor(.black)
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .background(Color.goodTextBg)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
      }
      .padding(.leading, 22)
      .padding(.trailing, 8)
      .padding(.vertical, 8)
      .background(Color.black)
      .clipShape(Capsule())
      .transition(.move(edge: .bottom).combined(with: .opacity))
    }
  }
}

enum TownActions {
  /// 切换某名玩家的死亡/复活，写记录，并登记撤销
  static func toggleAlive(index: Int, players: [Character], alive: Binding<[Bool]>, deathVote: Binding<[Bool]>, aliveCount: Binding<Int>, logs: Binding<[GameLogEntry]>) {
    guard index < players.count, index < alive.wrappedValue.count else {
      return
    }
    let character = players[index]
    let hadDeathVote = index < deathVote.wrappedValue.count ? deathVote.wrappedValue[index] : true
    withAnimation(.easeInOut(duration: 0.3)) {
      alive.wrappedValue[index].toggle()
    }
    let nowAlive = alive.wrappedValue[index]
    aliveCount.wrappedValue += nowAlive ? 1 : -1
    let entry = GameLogEntry(message: "", messager: index + 1, source: "说书人", type: nowAlive ? 12 : 6, characterName: character.name, playerNumbers: [index + 1], playerCharacters: [character.name], playerTeams: [team2Int(character.team)])
    logs.wrappedValue.append(entry)
    if nowAlive && index < deathVote.wrappedValue.count {
      deathVote.wrappedValue[index] = true
    }
    UndoCenter.shared.register(nowAlive ? "\(index + 1) 号已复活" : "\(index + 1) 号已死亡") {
      guard index < alive.wrappedValue.count else { return }
      withAnimation(.easeInOut(duration: 0.3)) {
        alive.wrappedValue[index] = !nowAlive
      }
      aliveCount.wrappedValue += nowAlive ? -1 : 1
      if index < deathVote.wrappedValue.count {
        deathVote.wrappedValue[index] = hadDeathVote
      }
      logs.wrappedValue.removeAll(where: { $0.id == entry.id })
    }
  }
  
  /// 删掉一个标签，写记录，并登记撤销
  static func removeReminder(at position: Int, from list: Binding<[Reminder]>, logEntry: GameLogEntry, logs: Binding<[GameLogEntry]>, label: String) {
    guard position < list.wrappedValue.count else {
      return
    }
    let reminder = list.wrappedValue[position]
    withAnimation(.easeInOut(duration: 0.3)) {
      _ = list.wrappedValue.remove(at: position)
    }
    logs.wrappedValue.append(logEntry)
    UndoCenter.shared.register("已删除\(label)“\(reminder.effect)”") {
      withAnimation(.easeInOut(duration: 0.3)) {
        list.wrappedValue.insert(reminder, at: min(position, list.wrappedValue.count))
      }
      logs.wrappedValue.removeAll(where: { $0.id == logEntry.id })
    }
  }
}
