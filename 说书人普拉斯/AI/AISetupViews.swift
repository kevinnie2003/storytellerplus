//
//  AISetupViews.swift
//  说书人普拉斯
//
//  AI 配版：生成抽卡堆，以及玩家抽完卡之后补完配版
//

import SwiftUI
import Flow

/// 请求一个 JSON 对象；回复解析失败时自动再要一次，并把出错的原文存下来方便排查
@MainActor
func aiRequestJSON(system: String, user: String, writingLabel: String, progress: @escaping @MainActor (String) -> Void) async throws -> [String: Any] {
  var messages = [AIChatMessage(role: "user", text: user)]
  for attempt in 0..<2 {
    let reply = try await AIClient.sendStreaming(
      system: system,
      messages: messages,
      maxTokens: 16000, effort: "high",
      onThinking: { thought in
        progress(aiThinkingTail(thought))
      }
    ) { partial in
      if !partial.isEmpty {
        progress(attempt == 0 ? writingLabel : "格式有误，正在重写…")
      }
    }
    if let object = aiExtractJSON(reply) as? [String: Any] {
      return object
    }
    aiSaveFailedReply(reply)
    // 第二次：把上一次的回复交回去，让它只重写成合法 JSON
    messages = [
      AIChatMessage(role: "user", text: user),
      AIChatMessage(role: "assistant", text: reply),
      AIChatMessage(role: "user", text: "你上面的回复不是合法的 JSON，程序无法读取。请把同样的内容重新输出成一个合法的 JSON 对象：只输出 JSON 本身，不要任何说明文字和代码块标记，字符串里不要出现英文双引号。")
    ]
    progress("格式有误，正在重写…")
  }
  throw AIError.badFormat("模型连续两次没有返回合法的 JSON，请点重新生成")
}

/// 把最近一次解析失败的原文存到本机（Application Support/ai-last-bad-reply.txt）
func aiSaveFailedReply(_ reply: String) {
  let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
  try? reply.write(to: base.appendingPathComponent("ai-last-bad-reply.txt"), atomically: true, encoding: .utf8)
}

struct AIBagPlan {
  var bag: [Character] = []
  var unknownNames: [String] = []
  var reasoning: String = ""
  var postDraw: [String] = []
}

struct AIPostDrawTag: Identifiable {
  let id = UUID()
  var playerIndex: Int
  var from: String
  var effect: String
  var reason: String
  var enabled: Bool = true
}

struct AIPostDrawPlan {
  var tags: [AIPostDrawTag] = []
  var bluffs: [Character] = []
  var bluffsReason: String = ""
  var notes: String = ""
}

/// 生成抽卡堆
struct AISetupSheet: View {
  let playableCharacters: [Character]
  let playerCount: Int
  let onApply: ([Character], String) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var wish: String = ""
  @State private var busy: Bool = false
  @State private var startedAt: Date = Date()
  @State private var progress: String = ""
  @State private var errorText: String = ""
  @State private var plan: AIBagPlan? = nil
  @State private var showSettings: Bool = false
  
  let wishChips = ["两边都有强信息位", "军团局（恶魔都是军团）", "疯子局（外来者有疯子，放两张恶魔牌）", "适合新手", "混乱一点，多些醉酒中毒"]
  let teams = ["townsfolk", "outsider", "minion", "demon"]
  
  private var cardsNeeded: Int {
    min(playerCount, 15)
  }
  
  private func generate() {
    busy = true
    startedAt = Date()
    progress = "正在思考…"
    errorText = ""
    plan = nil
    let candidates = playableCharacters.filter({ teams.contains($0.team) })
    Task {
      do {
        let object = try await aiRequestJSON(
          system: AIPrompts.withHouseRules(AIPrompts.setupSystem),
          user: AIPrompts.setupUser(characters: candidates, playerCount: playerCount, wish: wish),
          writingLabel: "正在写出配版…",
          progress: { progress = $0 }
        )
        var result = AIBagPlan()
        for name in (object["bag"] as? [Any] ?? []).compactMap({ $0 as? String }) {
          if let character = candidates.first(where: { $0.name == name }) {
            result.bag.append(character)
          } else {
            result.unknownNames.append(name)
          }
        }
        result.reasoning = object["reasoning"] as? String ?? ""
        result.postDraw = (object["post_draw"] as? [Any] ?? []).compactMap({ $0 as? String })
        if result.bag.isEmpty {
          throw AIError.badFormat("没有给出任何剧本里的角色")
        }
        plan = result
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
    }
  }
  
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      AIPanelHeader(title: "AI 配版", showSettings: $showSettings, onClose: { dismiss() })
      Text("\(playerCount) 名玩家，需要 \(cardsNeeded) 张牌。标准配置：\(AIPrompts.standardCounts(playerCount))")
        .font(.system(size: 16, weight: .semibold, design: .rounded))
      TextField("对这局配版的诉求（可不填）", text: $wish, axis: .vertical)
        .lineLimit(1...4)
        .font(.system(size: 17, design: .rounded))
        .padding(10)
        .background(Color.paper)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.ink, lineWidth: 2))
      HFlow(horizontalAlignment: .leading, verticalAlignment: .top) {
        ForEach(wishChips, id: \.self) { chip in
          AIChip(text: chip) {
            wish = wish.isEmpty ? chip : wish + "；" + chip
          }
        }
      }
      HStack(spacing: 12) {
        Button(action: generate) {
          AIPillLabel(text: busy ? "配版中…" : (plan == nil ? "生成配版" : "重新生成"), filled: true)
        }
        .disabled(busy || playerCount < 5)
        if busy {
          AIProgressLine(since: startedAt, text: progress)
        }
        if playerCount < 5 {
          Text("至少需要 5 名玩家")
            .font(.system(size: 15, design: .rounded))
            .foregroundColor(.red)
        }
      }
      if !errorText.isEmpty {
        Text(errorText)
          .font(.system(size: 15, design: .rounded))
          .foregroundColor(.red)
      }
      if let plan = plan {
        ScrollView {
          VStack(alignment: .leading, spacing: 8) {
            ForEach(teams, id: \.self) { team in
              let names = plan.bag.filter({ $0.team == team }).map({ $0.name })
              if !names.isEmpty {
                Text("\(teamCN(team)) \(names.count) 张：\(names.joined(separator: "、"))")
                  .font(.system(size: 17, weight: .semibold, design: .rounded))
              }
            }
            if plan.bag.count != cardsNeeded {
              Text("注意：AI 给了 \(plan.bag.count) 张牌，应该是 \(cardsNeeded) 张，应用后请手动调整。")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(.red)
            }
            if !plan.unknownNames.isEmpty {
              Text("注意：这些名字不在剧本里，已忽略：\(plan.unknownNames.joined(separator: "、"))")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(.red)
            }
            if !plan.reasoning.isEmpty {
              Text(plan.reasoning)
                .font(.system(size: 16, design: .rounded))
                .padding(.top, 4)
            }
            if !plan.postDraw.isEmpty {
              Text("抽完卡之后要做的事：")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .padding(.top, 4)
              ForEach(plan.postDraw.indices, id: \.self) { i in
                Text("\(i + 1). \(plan.postDraw[i])")
                  .font(.system(size: 16, design: .rounded))
              }
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        Button(action: {
          let notes = plan.postDraw.joined(separator: "\n")
          let bag = plan.bag
          dismiss()
          onApply(bag, notes)
        }) {
          AIPillLabel(text: "应用到配版，去检查", filled: true)
        }
      } else {
        Spacer()
      }
    }
    .padding(20)
    .background(Color.mainbg.ignoresSafeArea())
    .stColorScheme()
    .aiPanelSizing()
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}

/// 玩家抽完卡之后，让 AI 决定谁是酒鬼、提线木偶、疯子等，并选恶魔伪装
struct AIPostDrawSheet: View {
  let makeContext: () -> AIGameContext
  let onApply: ([AIPostDrawTag], [Character]) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var wish: String = ""
  @State private var busy: Bool = false
  @State private var startedAt: Date = Date()
  @State private var progress: String = ""
  @State private var errorText: String = ""
  @State private var plan: AIPostDrawPlan? = nil
  @State private var applyBluffs: Bool = true
  @State private var showSettings: Bool = false
  
  private func generate() {
    let ctx = makeContext()
    if ctx.players.isEmpty || ctx.players.contains(where: { $0.name.isEmpty }) {
      errorText = "还有玩家没有角色，请先让所有玩家抽完卡。"
      return
    }
    busy = true
    startedAt = Date()
    progress = "正在思考…"
    errorText = ""
    plan = nil
    Task {
      do {
        let object = try await aiRequestJSON(
          system: AIPrompts.withHouseRules(AIPrompts.postDrawSystem),
          user: AIPrompts.postDrawUser(ctx, wish: wish),
          writingLabel: "正在写出结果…",
          progress: { progress = $0 }
        )
        var result = AIPostDrawPlan()
        for item in (object["tags"] as? [Any] ?? []).compactMap({ $0 as? [String: Any] }) {
          let player = (item["player"] as? Int) ?? Int(item["player"] as? String ?? "") ?? 0
          let from = item["from"] as? String ?? ""
          let effect = item["effect"] as? String ?? ""
          if player >= 1 && player <= ctx.players.count && !effect.isEmpty {
            result.tags.append(AIPostDrawTag(playerIndex: player - 1, from: from, effect: effect, reason: item["reason"] as? String ?? ""))
          }
        }
        let inPlay = Set(ctx.players.map({ $0.name }))
        for name in (object["bluffs"] as? [Any] ?? []).compactMap({ $0 as? String }) {
          if let character = ctx.playableCharacters.first(where: { $0.name == name && ($0.team == "townsfolk" || $0.team == "outsider") }), !inPlay.contains(name), !result.bluffs.contains(character) {
            result.bluffs.append(character)
          }
        }
        result.bluffsReason = object["bluffs_reason"] as? String ?? ""
        result.notes = object["notes"] as? String ?? ""
        plan = result
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
    }
  }
  
  var body: some View {
    let ctx = makeContext()
    VStack(alignment: .leading, spacing: 12) {
      AIPanelHeader(title: "AI 补完配版", showSettings: $showSettings, onClose: { dismiss() })
      Text("玩家抽完卡之后，让 AI 定下首夜之前必须决定的事：谁是酒鬼、提线木偶、疯子，占卜师的干扰项，首夜信息指向谁，以及三个恶魔伪装。之后才触发的能力不会提前打标记。结果要你确认后才会应用。")
        .font(.system(size: 16, design: .rounded))
      if !ctx.setupNotes.isEmpty {
        Text("配版时留下的待办：\n\(ctx.setupNotes)")
          .font(.system(size: 15, design: .rounded))
          .foregroundColor(.secondary)
      }
      TextField("额外诉求（可不填），比如：酒鬼不要给占卜师", text: $wish, axis: .vertical)
        .lineLimit(1...3)
        .font(.system(size: 17, design: .rounded))
        .padding(10)
        .background(Color.paper)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.ink, lineWidth: 2))
      HStack(spacing: 12) {
        Button(action: generate) {
          AIPillLabel(text: busy ? "思考中…" : (plan == nil ? "开始" : "重新生成"), filled: true)
        }
        .disabled(busy)
        if busy {
          AIProgressLine(since: startedAt, text: progress)
        }
      }
      if !errorText.isEmpty {
        Text(errorText)
          .font(.system(size: 15, design: .rounded))
          .foregroundColor(.red)
      }
      if plan != nil {
        ScrollView {
          VStack(alignment: .leading, spacing: 10) {
            if plan!.tags.isEmpty {
              Text("没有需要挂的开局标记。")
                .font(.system(size: 16, design: .rounded))
            }
            ForEach(plan!.tags.indices, id: \.self) { i in
              let tag = plan!.tags[i]
              let character = tag.playerIndex < ctx.players.count ? ctx.players[tag.playerIndex].name : ""
              Toggle(isOn: Binding(get: { plan?.tags[i].enabled ?? false }, set: { plan?.tags[i].enabled = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                  Text("\(tag.playerIndex + 1)号 \(character)：\(tag.from)·\(tag.effect)")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                  if !tag.reason.isEmpty {
                    Text(tag.reason)
                      .font(.system(size: 15, design: .rounded))
                      .foregroundColor(.secondary)
                  }
                }
              }
              .tint(.ink)
            }
            if plan!.bluffs.count == 3 {
              Toggle(isOn: $applyBluffs) {
                VStack(alignment: .leading, spacing: 2) {
                  Text("恶魔伪装：\(plan!.bluffs.map({ $0.name }).joined(separator: "、"))")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                  if !plan!.bluffsReason.isEmpty {
                    Text(plan!.bluffsReason)
                      .font(.system(size: 15, design: .rounded))
                      .foregroundColor(.secondary)
                  }
                }
              }
              .tint(.ink)
            }
            if !plan!.notes.isEmpty {
              Text(plan!.notes)
                .font(.system(size: 15, design: .rounded))
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.trailing, 4)
        }
        Button(action: {
          let tags = plan!.tags.filter({ $0.enabled })
          let bluffs = (applyBluffs && plan!.bluffs.count == 3) ? plan!.bluffs : []
          dismiss()
          onApply(tags, bluffs)
        }) {
          AIPillLabel(text: "应用到魔典", filled: true)
        }
      } else {
        Spacer()
      }
    }
    .padding(20)
    .background(Color.mainbg.ignoresSafeArea())
    .stColorScheme()
    .aiPanelSizing()
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}
