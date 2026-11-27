//
//  RecapPoster.swift
//  说书人普拉斯
//
//  AI 复盘的一图流：结构化的复盘内容画成一张长图，可以保存和分享
//

import SwiftUI

struct RecapTurningPoint: Codable, Hashable {
  var when: String
  var text: String
}

struct RecapKeyInfo: Codable, Hashable {
  var player: String
  var info: String
  var effect: String
  var inferred: Bool
}

struct RecapData: Codable {
  var winner: String = ""
  var headline: String = ""
  var turningPoints: [RecapTurningPoint] = []
  var evil: String = ""
  var good: String = ""
  var mvpPlayer: String = ""   // 旧版只有一个本局最佳
  var mvpReason: String = ""
  var mvpWinPlayer: String = ""
  var mvpWinReason: String = ""
  var mvpLosePlayer: String = ""
  var mvpLoseReason: String = ""
  var keyInfo: [RecapKeyInfo] = []
  
  init() {}
  
  // 旧版复盘没有 keyInfo，缺的字段按空值读
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    winner = try c.decodeIfPresent(String.self, forKey: .winner) ?? ""
    headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? ""
    turningPoints = try c.decodeIfPresent([RecapTurningPoint].self, forKey: .turningPoints) ?? []
    evil = try c.decodeIfPresent(String.self, forKey: .evil) ?? ""
    good = try c.decodeIfPresent(String.self, forKey: .good) ?? ""
    mvpPlayer = try c.decodeIfPresent(String.self, forKey: .mvpPlayer) ?? ""
    mvpReason = try c.decodeIfPresent(String.self, forKey: .mvpReason) ?? ""
    mvpWinPlayer = try c.decodeIfPresent(String.self, forKey: .mvpWinPlayer) ?? ""
    mvpWinReason = try c.decodeIfPresent(String.self, forKey: .mvpWinReason) ?? ""
    mvpLosePlayer = try c.decodeIfPresent(String.self, forKey: .mvpLosePlayer) ?? ""
    mvpLoseReason = try c.decodeIfPresent(String.self, forKey: .mvpLoseReason) ?? ""
    keyInfo = try c.decodeIfPresent([RecapKeyInfo].self, forKey: .keyInfo) ?? []
  }
  
  static func from(_ object: [String: Any]) -> RecapData {
    var r = RecapData()
    r.winner = object["winner"] as? String ?? ""
    r.headline = object["headline"] as? String ?? ""
    r.turningPoints = (object["turning_points"] as? [Any] ?? []).compactMap { item in
      guard let d = item as? [String: Any], let text = d["text"] as? String else { return nil }
      return RecapTurningPoint(when: d["when"] as? String ?? "", text: text)
    }
    r.evil = object["evil"] as? String ?? ""
    r.good = object["good"] as? String ?? ""
    if let mvp = object["mvp"] as? [String: Any] {
      r.mvpPlayer = mvp["player"] as? String ?? ""
      r.mvpReason = mvp["reason"] as? String ?? ""
    }
    if let mvp = object["mvp_win"] as? [String: Any] {
      r.mvpWinPlayer = mvp["player"] as? String ?? ""
      r.mvpWinReason = mvp["reason"] as? String ?? ""
    }
    if let mvp = object["mvp_lose"] as? [String: Any] {
      r.mvpLosePlayer = mvp["player"] as? String ?? ""
      r.mvpLoseReason = mvp["reason"] as? String ?? ""
    }
    r.keyInfo = (object["key_info"] as? [Any] ?? []).compactMap { item in
      guard let d = item as? [String: Any], let info = d["info"] as? String else { return nil }
      let inferred = (d["inferred"] as? Bool) ?? ((d["inferred"] as? String).map { $0 == "true" || $0.contains("推") } ?? true)
      return RecapKeyInfo(player: d["player"] as? String ?? "", info: info, effect: d["effect"] as? String ?? "", inferred: inferred)
    }
    return r
  }
}

/// 画在海报上的图标：只用本机缓存，保证导出图片时图标都在
struct PosterIcon: View {
  let url: String
  var body: some View {
    if let image = ImageCache.shared.image(for: url) {
      Image(uiImage: image).resizable().scaledToFit()
    } else {
      Image(systemName: "questionmark.circle").resizable().scaledToFit().foregroundColor(.black.opacity(0.3))
    }
  }
}

struct RecapPoster: View {
  let game: GameSaveData
  let recap: RecapData
  
  private var winnerIsGood: Bool? {
    if recap.winner.contains("善") { return true }
    if recap.winner.contains("邪") || recap.winner.contains("恶") { return false }
    return nil
  }
  
  private var dayCount: Int {
    game.allLogs.filter { $0.type == 10 }.count
  }
  
  private func block<Content: View>(_ title: String, fill: Color = Color.goodTextBg, ink: Color = .black, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title)
        .font(.system(size: 22, weight: .black, design: .rounded))
        .foregroundColor(ink)
      content()
    }
    .padding(20)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(fill)
    .clipShape(RoundedRectangle(cornerRadius: 20))
    .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.black, lineWidth: 3))
  }
  
  private func mvpCard(title: String, player: String, reason: String, star: Color) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        Image(systemName: "star.fill")
          .font(.system(size: 22))
          .foregroundColor(star)
        Text(title)
          .font(.system(size: 18, weight: .black, design: .rounded))
          .foregroundColor(.black.opacity(0.6))
      }
      Text(player)
        .font(.system(size: 24, weight: .black, design: .rounded))
      Text(reason)
        .font(.system(size: 17, design: .rounded))
        .foregroundColor(.black.opacity(0.7))
    }
    .padding(20)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color.goodTextBg)
    .clipShape(RoundedRectangle(cornerRadius: 20))
    .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.black, lineWidth: 3))
  }
  
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      // 标题
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text(game.playName.isEmpty ? "无名剧本" : game.playName)
            .font(.system(size: 44, weight: .black, design: .rounded))
          Text("\(game.playersAssignedCharacters.count) 人局 · \(dayCount) 天 · 存活 \(game.aliveCount) 人")
            .font(.system(size: 18, weight: .semibold, design: .rounded))
            .foregroundColor(.black.opacity(0.6))
        }
        Spacer()
        Text(winnerIsGood == nil ? "胜负未定" : (winnerIsGood! ? "善良获胜" : "邪恶获胜"))
          .font(.system(size: 24, weight: .black, design: .rounded))
          .foregroundColor(Color.goodTextBg)
          .padding(.horizontal, 20)
          .padding(.vertical, 12)
          .background(winnerIsGood == nil ? Color.black : (winnerIsGood! ? Color.townsfolk : Color.demon))
          .clipShape(Capsule())
      }
      
      // 一句话
      Text(recap.headline)
        .font(.system(size: 26, weight: .heavy, design: .rounded))
        .lineSpacing(6)
        .frame(maxWidth: .infinity, alignment: .leading)
      
      // 座位
      let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: min(max(game.playersAssignedCharacters.count, 1), 8))
      LazyVGrid(columns: columns, spacing: 12) {
        ForEach(game.playersAssignedCharacters.indices, id: \.self) { i in
          let c = game.playersAssignedCharacters[i]
          let alive = i < game.playersIsAlive.count ? game.playersIsAlive[i] : true
          VStack(spacing: 4) {
            PosterIcon(url: c.imageURL)
              .frame(width: 58, height: 58)
              .background(Circle().fill(Color.goodTextBg))
              .overlay(Circle().stroke(team2Color(c.team), lineWidth: 4))
              .overlay(alignment: .topLeading) {
                Text("\(i + 1)")
                  .font(.system(size: 14, weight: .black, design: .rounded))
                  .foregroundColor(Color.goodTextBg)
                  .frame(width: 24, height: 24)
                  .background(Circle().fill(Color.black))
                  .offset(x: -6, y: -6)
              }
              .opacity(alive ? 1 : 0.45)
            Text(c.name)
              .font(.system(size: 14, weight: .bold, design: .rounded))
              .foregroundColor(team2Color(c.team))
              .lineLimit(1)
              .minimumScaleFactor(0.7)
            if !alive {
              Text("死亡")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundColor(.black.opacity(0.5))
            }
          }
        }
      }
      .padding(16)
      .background(Color.goodTextBg)
      .clipShape(RoundedRectangle(cornerRadius: 20))
      .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.black, lineWidth: 3))
      
      // 关键转折
      if !recap.turningPoints.isEmpty {
        block("关键转折") {
          ForEach(recap.turningPoints, id: \.self) { point in
            HStack(alignment: .top, spacing: 12) {
              Text(point.when)
                .font(.system(size: 16, weight: .black, design: .rounded))
                .foregroundColor(Color.goodTextBg)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(point.when.contains("夜") ? Color.black : Color.townsfolk))
                .fixedSize()
              Text(point.text)
                .font(.system(size: 18, design: .rounded))
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
      }
      
      // 关键信息
      if !recap.keyInfo.isEmpty {
        block("关键信息") {
          ForEach(recap.keyInfo, id: \.self) { item in
            VStack(alignment: .leading, spacing: 4) {
              HStack(spacing: 8) {
                Text(item.player)
                  .font(.system(size: 18, weight: .black, design: .rounded))
                if item.inferred {
                  Text("推测")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(.black.opacity(0.55))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .overlay(Capsule().stroke(Color.black.opacity(0.4), lineWidth: 1.5))
                }
              }
              Text(item.info)
                .font(.system(size: 18, design: .rounded))
              if !item.effect.isEmpty {
                Text("→ \(item.effect)")
                  .font(.system(size: 17, weight: .semibold, design: .rounded))
                  .foregroundColor(Color.townsfolk)
              }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
        }
      }
      
      // 双方
      HStack(alignment: .top, spacing: 14) {
        block("邪恶方", fill: Color.demon, ink: Color.goodTextBg) {
          Text(recap.evil)
            .font(.system(size: 17, design: .rounded))
            .foregroundColor(Color.goodTextBg)
        }
        block("善良方", fill: Color.townsfolk, ink: Color.goodTextBg) {
          Text(recap.good)
            .font(.system(size: 17, design: .rounded))
            .foregroundColor(Color.goodTextBg)
        }
      }
      .fixedSize(horizontal: false, vertical: true)
      
      // MVP：新版分胜方和败方，旧版只有一个本局最佳
      if !recap.mvpWinPlayer.isEmpty || !recap.mvpLosePlayer.isEmpty {
        HStack(alignment: .top, spacing: 14) {
          if !recap.mvpWinPlayer.isEmpty {
            mvpCard(title: winnerIsGood == nil ? "善良方 MVP" : "胜方 MVP", player: recap.mvpWinPlayer, reason: recap.mvpWinReason, star: .fabled)
          }
          if !recap.mvpLosePlayer.isEmpty {
            mvpCard(title: winnerIsGood == nil ? "邪恶方 MVP" : "败方 MVP", player: recap.mvpLosePlayer, reason: recap.mvpLoseReason, star: Color.black.opacity(0.35))
          }
        }
        .fixedSize(horizontal: false, vertical: true)
      } else if !recap.mvpPlayer.isEmpty {
        mvpCard(title: "本局最佳", player: recap.mvpPlayer, reason: recap.mvpReason, star: .fabled)
      }
      
      Text("说书人普拉斯 · AI 复盘")
        .font(.system(size: 14, weight: .semibold, design: .rounded))
        .foregroundColor(.black.opacity(0.4))
        .frame(maxWidth: .infinity)
    }
    .padding(32)
    .frame(width: 900)
    .background(Color.mainbg)
  }
}

@MainActor
func renderRecapPoster(game: GameSaveData, recap: RecapData) -> UIImage? {
  // 导出的图片永远是浅色，不跟深色模式
  let renderer = ImageRenderer(content: RecapPoster(game: game, recap: recap).environment(\.colorScheme, .light))
  renderer.scale = 2
  return renderer.uiImage
}
