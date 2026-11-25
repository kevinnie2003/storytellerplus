//
//  AppSettings.swift
//  说书人普拉斯
//
//  设置页里的各项设置，存在本机
//

import SwiftUI

let defaultNotepadTags: [String] = [
  "你是", "他是", "是", "活着", "死亡", "邪恶", "善良",
  "镇民", "外来者", "爪牙", "旅行者", "恶魔", "中毒", "醉酒", "你被", "洗脑",
  "使用能力吗", "共边", "不共边", "左边", "右边", "不能说", "不可以", "不建议", "请选择", "选择", "?"
]

final class AppSettings: ObservableObject {
  static let shared = AppSettings()
  private let defaults = UserDefaults.standard
  
  // 显示
  @Published var cardsPerRow: Int { didSet { defaults.set(cardsPerRow, forKey: "settings.cardsPerRow") } }
  @Published var cardFontScale: Double { didSet { defaults.set(cardFontScale, forKey: "settings.cardFontScale") } }
  
  // 死亡和复活
  @Published var deathByTap: Bool { didSet { defaults.set(deathByTap, forKey: "settings.deathByTap") } }
  @Published var deathLongPressSeconds: Double { didSet { defaults.set(deathLongPressSeconds, forKey: "settings.deathLongPressSeconds") } }
  @Published var confirmDeath: Bool { didSet { defaults.set(confirmDeath, forKey: "settings.confirmDeath") } }
  @Published var undoEnabled: Bool { didSet { defaults.set(undoEnabled, forKey: "settings.undoEnabled") } }
  @Published var circleLayout: Bool { didSet { defaults.set(circleLayout, forKey: "settings.circleLayout") } }
  
  // 带局习惯
  @Published var defaultPlayerCount: Int { didSet { defaults.set(defaultPlayerCount, forKey: "settings.defaultPlayerCount") } }
  @Published var notepadTags: [String] { didSet { defaults.set(notepadTags, forKey: "settings.notepadTags") } }
  
  // AI
  @Published var houseRules: String { didSet { defaults.set(houseRules, forKey: "settings.houseRules") } }
  @Published var savantBatchTotal: Int { didSet { defaults.set(savantBatchTotal, forKey: "settings.savantBatchTotal") } }
  @Published var savantBatchTrue: Int { didSet { defaults.set(savantBatchTrue, forKey: "settings.savantBatchTrue") } }
  
  private init() {
    let d = UserDefaults.standard
    cardsPerRow = d.object(forKey: "settings.cardsPerRow") as? Int ?? 3
    cardFontScale = d.object(forKey: "settings.cardFontScale") as? Double ?? 1.0
    deathByTap = d.bool(forKey: "settings.deathByTap")
    deathLongPressSeconds = d.object(forKey: "settings.deathLongPressSeconds") as? Double ?? 0.5
    confirmDeath = d.bool(forKey: "settings.confirmDeath")
    undoEnabled = d.object(forKey: "settings.undoEnabled") as? Bool ?? true
    circleLayout = d.bool(forKey: "settings.circleLayout")
    defaultPlayerCount = d.object(forKey: "settings.defaultPlayerCount") as? Int ?? 0
    notepadTags = d.stringArray(forKey: "settings.notepadTags") ?? defaultNotepadTags
    houseRules = d.string(forKey: "settings.houseRules") ?? ""
    savantBatchTotal = d.object(forKey: "settings.savantBatchTotal") as? Int ?? 14
    savantBatchTrue = d.object(forKey: "settings.savantBatchTrue") as? Int ?? 8
  }
}
