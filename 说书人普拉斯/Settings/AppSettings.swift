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
  /// 外观：light 浅色、dark 深色、game 跟随游戏昼夜（夜晚深色、白天浅色）
  @Published var appearance: String { didSet { defaults.set(appearance, forKey: "settings.appearance") } }
  /// 小镇里现在是不是夜晚，“跟随游戏昼夜”用，不存
  @Published var gameIsNight: Bool = false
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
    appearance = d.string(forKey: "settings.appearance") ?? "light"
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
  
  var colorScheme: ColorScheme {
    switch appearance {
    case "dark": return .dark
    case "game": return gameIsNight ? .dark : .light
    default: return .light
    }
  }
}

/// 按设置里的外观切换浅色或深色，每个弹出页面也要单独加
struct STColorScheme: ViewModifier {
  @ObservedObject private var settings = AppSettings.shared
  func body(content: Content) -> some View {
    content
      .preferredColorScheme(settings.colorScheme)
      .animation(.easeInOut(duration: 0.4), value: settings.colorScheme)
  }
}

extension View {
  func stColorScheme() -> some View { modifier(STColorScheme()) }
}

/// 深浅两套颜色：ink 是字和描边，paper 是卡片底色
extension ShapeStyle where Self == Color {
  static var ink: Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.93, green: 0.91, blue: 0.87, alpha: 1) : .black })
  }
  /// 写在背景上的爪牙、恶魔字样：深色模式下调亮，不然看不清
  static var minionInk: Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.96, green: 0.50, blue: 0.30, alpha: 1) : (UIColor(named: "minion") ?? .red).resolvedColor(with: $0) })
  }
  static var demonInk: Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.90, green: 0.36, blue: 0.48, alpha: 1) : (UIColor(named: "demon") ?? .red).resolvedColor(with: $0) })
  }
  static var paper: Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.17, green: 0.165, blue: 0.155, alpha: 1) : UIColor(red: 246/255, green: 241/255, blue: 226/255, alpha: 1) })
  }
}
