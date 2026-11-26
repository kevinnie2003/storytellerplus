//
//  ReviewView.swift
//  说书人普拉斯
//
//  复盘：按天和夜排列的时间线（只读），以及 AI 复盘
//

import SwiftUI

/// 时间线里的一段：游戏开始前、第几夜、第几天
struct ReviewSegment: Identifiable {
  let id = UUID()
  let title: String
  let isNight: Bool
  var entries: [GameLogEntry]
}

enum ReviewBuilder {
  static func segments(_ logs: [GameLogEntry]) -> [ReviewSegment] {
    var result: [ReviewSegment] = [ReviewSegment(title: "开局", isNight: false, entries: [])]
    var day = 0
    var night = 0
    for entry in logs {
      switch entry.type {
      case 8:
        continue
      case 9:
        night = 1
        result.append(ReviewSegment(title: "第 1 夜", isNight: true, entries: []))
      case 10:
        day += 1
        result.append(ReviewSegment(title: "第 \(day) 天", isNight: false, entries: []))
      case 11:
        night += 1
        result.append(ReviewSegment(title: "第 \(night) 夜", isNight: true, entries: []))
      default:
        result[result.count - 1].entries.append(entry)
      }
    }
    return result.filter { !$0.entries.isEmpty || $0.title != "开局" }
  }
  
  /// 一条记录的显示文字，去掉原记录里的分隔线
  static func text(_ entry: GameLogEntry) -> String {
    switch entry.type {
    case 2:
      let who = entry.messager > 0 ? "\(entry.messager) 号 \(entry.characterName)" : entry.characterName
      let detail = entry.message.trimmingCharacters(in: .whitespacesAndNewlines)
      return detail.isEmpty ? "\(who) 被唤醒" : "\(who)：\(detail)"
    case 3:
      return entry.message
    default:
      return entry.logText
        .components(separatedBy: "\n")
        .filter { !$0.hasPrefix("====") }
        .joined(separator: " ")
        .trimmingCharacters(in: .whitespaces)
    }
  }
  
  static func color(_ entry: GameLogEntry) -> Color {
    switch entry.type {
    case 6: return .demon
    case 12: return .townsfolk
    case 4, 5: return .black
    default: return .black.opacity(0.75)
    }
  }
  
  static func isBold(_ entry: GameLogEntry) -> Bool {
    [4, 6, 12].contains(entry.type)
  }
}

enum ReviewStore {
  private static var folder: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let url = base.appendingPathComponent("GameRecaps", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
  static func load(_ id: String) -> RecapData? {
    guard let data = try? Data(contentsOf: folder.appendingPathComponent("\(id).json")) else { return nil }
    return try? JSONDecoder().decode(RecapData.self, from: data)
  }
  static func save(_ recap: RecapData, id: String) {
    if let data = try? JSONEncoder().encode(recap) {
      try? data.write(to: folder.appendingPathComponent("\(id).json"), options: .atomic)
    }
  }
}

struct ReviewView: View {
  let gameID: String
  @Environment(\.dismiss) private var dismiss
  @State private var game: GameSaveData? = nil
  @State private var recap: RecapData? = nil
  @State private var poster: UIImage? = nil
  @State private var savedMessage = ""
  @State private var busy = false
  @State private var startedAt = Date()
  @State private var progress = ""
  @State private var errorText = ""
  @State private var showSettings = false
  
  private func load() {
    if let data = GameArchive.load(gameID) {
      game = try? JSONDecoder().decode(GameSaveData.self, from: data)
    }
    recap = ReviewStore.load(gameID)
    renderPoster()
  }
  
  private func renderPoster() {
    guard let game = game, let recap = recap else {
      poster = nil
      return
    }
    // 先把图标都存到本机，海报上才画得出来
    ImageCache.shared.prefetch(game.playersAssignedCharacters.map { $0.imageURL })
    Task {
      for url in game.playersAssignedCharacters.map({ $0.imageURL }) where !url.isEmpty {
        _ = await ImageCache.shared.fetch(url)
      }
      poster = renderRecapPoster(game: game, recap: recap)
    }
  }
  
  private func generate() {
    guard let game = game else { return }
    let ctx = AIGameContext(
      playName: game.playName,
      gameState: game.gameState,
      playableCharacters: game.playableCharacters,
      players: game.playersAssignedCharacters,
      alive: game.playersIsAlive,
      deathVote: game.playersHasDeathVote,
      playerTags: game.playersStates,
      globalTags: game.globalStates,
      bluffs: game.notPresentedGoodCharacters,
      fabled: game.selectedFabledCharacters,
      jinxes: game.jinxList,
      logs: game.allLogs,
      allReminders: game.allReminders,
      setupNotes: ""
    )
    busy = true
    errorText = ""
    savedMessage = ""
    startedAt = Date()
    progress = "正在思考…"
    Task {
      do {
        let object = try await aiRequestJSON(
          system: AIPrompts.withHouseRules(AIPrompts.recapSystem),
          user: AIPrompts.recapUser(ctx),
          writingLabel: "正在写复盘…",
          progress: { progress = $0 }
        )
        let result = RecapData.from(object)
        recap = result
        ReviewStore.save(result, id: gameID)
        renderPoster()
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
    }
  }
  
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(game?.playName.isEmpty == false ? game!.playName : "复盘")
            .font(.system(size: 30, weight: .black, design: .rounded))
          if let game = game {
            Text("\(game.playersAssignedCharacters.count) 人，还剩 \(game.aliveCount) 人活着")
              .font(.system(size: 16, design: .rounded))
              .foregroundColor(.black.opacity(0.6))
          }
        }
        Spacer()
        Button(action: { showSettings = true }) {
          Image(systemName: "gearshape")
            .font(.system(size: 22, weight: .bold))
            .foregroundColor(.black)
        }
        .padding(.trailing, 10)
        STPageHeader(title: "", onClose: { dismiss() })
          .fixedSize()
      }
      if let game = game {
        HStack(alignment: .top, spacing: 18) {
          // 时间线
          ScrollView {
            VStack(alignment: .leading, spacing: 18) {
              ForEach(ReviewBuilder.segments(game.allLogs)) { segment in
                VStack(alignment: .leading, spacing: 6) {
                  HStack(spacing: 8) {
                    Image(systemName: segment.isNight ? "moon.fill" : (segment.title == "开局" ? "flag.fill" : "sun.max.fill"))
                    Text(segment.title)
                  }
                  .font(.system(size: 19, weight: .black, design: .rounded))
                  .foregroundColor(segment.isNight ? Color.goodTextBg : .black)
                  .padding(.horizontal, 12)
                  .padding(.vertical, 5)
                  .background(segment.isNight ? Color.black : Color.goodTextBg)
                  .clipShape(Capsule())
                  .overlay(Capsule().stroke(Color.black, lineWidth: 2))
                  if segment.entries.isEmpty {
                    Text("没有记录")
                      .font(.system(size: 15, design: .rounded))
                      .foregroundColor(.black.opacity(0.4))
                      .padding(.leading, 12)
                  }
                  ForEach(segment.entries) { entry in
                    Text(ReviewBuilder.text(entry))
                      .font(.system(size: 16, weight: ReviewBuilder.isBold(entry) ? .bold : .regular, design: .rounded))
                      .foregroundColor(ReviewBuilder.color(entry))
                      .frame(maxWidth: .infinity, alignment: .leading)
                      .padding(.leading, 12)
                      .textSelection(.enabled)
                  }
                }
              }
            }
            .padding(18)
          }
          .frame(maxWidth: .infinity)
          .background(Color.goodTextBg)
          .clipShape(RoundedRectangle(cornerRadius: 18))
          .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black, lineWidth: 3))
          
          // 座位和 AI 复盘
          VStack(alignment: .leading, spacing: 14) {
            ScrollView(.horizontal, showsIndicators: false) {
              HStack(spacing: 6) {
                ForEach(game.playersAssignedCharacters.indices, id: \.self) { i in
                  let c = game.playersAssignedCharacters[i]
                  let alive = i < game.playersIsAlive.count ? game.playersIsAlive[i] : true
                  VStack(spacing: 3) {
                    CachedImageView(urlString: c.imageURL)
                      .frame(width: 38, height: 38)
                      .opacity(alive ? 1 : 0.4)
                    Text("\(i + 1)")
                      .font(.system(size: 13, weight: .black, design: .rounded))
                    Text(c.name)
                      .font(.system(size: 12, weight: .semibold, design: .rounded))
                      .foregroundColor(team2Color(c.team))
                      .lineLimit(1)
                  }
                  .frame(width: 54)
                  .overlay(alignment: .topTrailing) {
                    if !alive {
                      Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .black))
                        .foregroundColor(.demon)
                    }
                  }
                }
              }
              .padding(10)
            }
            .background(Color.goodTextBg)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 2.5))
            
            HStack(spacing: 10) {
              Text("AI 复盘")
                .font(.system(size: 22, weight: .black, design: .rounded))
              Spacer()
              STChoice(selected: recap == nil, action: generate) {
                Text(recap == nil ? "生成复盘图" : "重新生成")
                  .font(.system(size: 16, weight: .bold, design: .rounded))
              }
              .disabled(busy)
              .opacity(busy ? 0.4 : 1)
            }
            if busy {
              AIProgressLine(since: startedAt, text: progress)
            }
            if !errorText.isEmpty {
              Text(errorText)
                .font(.system(size: 15, design: .rounded))
                .foregroundColor(.red)
            }
            if let poster = poster {
              ScrollView {
                Image(uiImage: poster)
                  .resizable()
                  .scaledToFit()
                  .clipShape(RoundedRectangle(cornerRadius: 12))
                  .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
              }
              HStack(spacing: 10) {
                STChoice(selected: true, action: {
                  UIImageWriteToSavedPhotosAlbum(poster, nil, nil, nil)
                  savedMessage = "已保存到相册"
                }) {
                  Text("保存到相册").font(.system(size: 16, weight: .bold, design: .rounded))
                }
                ShareLink(item: Image(uiImage: poster), preview: SharePreview("复盘", image: Image(uiImage: poster))) {
                  Text("分享")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 2.5))
                }
                if !savedMessage.isEmpty {
                  Text(savedMessage)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundColor(.green)
                }
              }
            } else if !busy && recap == nil {
              Text("让 AI 根据这一局的记录生成一张复盘长图，可以保存或发给玩家。")
                .font(.system(size: 15, design: .rounded))
                .foregroundColor(.black.opacity(0.45))
              Spacer()
            } else {
              Spacer()
            }
          }
          .frame(width: 430)
        }
      } else {
        Text("读取存档失败")
          .font(.system(size: 18, design: .rounded))
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .padding(26)
    .background(Color.mainbg.ignoresSafeArea())
    .preferredColorScheme(.light)
    .aiPanelSizing()
    .onAppear(perform: load)
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}
