//
//  SettingsView.swift
//  说书人普拉斯
//

import SwiftUI

struct SettingsView: View {
  @ObservedObject private var settings = AppSettings.shared
  @Environment(\.dismiss) private var dismiss
  @State private var showAISettings = false
  @State private var newTag = ""
  @State private var showResetTags = false
  
  /// 某个总条数下三种真假分法对应的真的条数：真的多一些、一半一半、假的多一些
  private func savantTruths(for total: Int) -> [Int] {
    let half = total / 2
    let step = max(1, total / 8)
    return [min(total - 1, half + step), half, max(1, half - step)]
  }
  
  private var savantTrueOptions: [(Int, String)] {
    let t = savantTruths(for: settings.savantBatchTotal)
    return [(t[0], "真的多一些"), (t[1], "一半一半"), (t[2], "假的多一些")]
  }
  
  private func addTag() {
    let tag = newTag.trimmingCharacters(in: .whitespaces)
    if !tag.isEmpty && !settings.notepadTags.contains(tag) {
      settings.notepadTags.append(tag)
    }
    newTag = ""
  }
  
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      STPageHeader(title: "设置", onClose: { dismiss() })
      ScrollView {
        VStack(alignment: .leading, spacing: 28) {
          STSection(title: "玩家卡片") {
            STRow(title: "摆法") {
              STChoiceRow(options: [(false, "网格"), (true, "圆桌")], selection: $settings.circleLayout)
            }
            if !settings.circleLayout {
            STRow(title: "每行几张") {
              HStack(spacing: 12) {
                ForEach(2...5, id: \.self) { n in
                  STChoice(selected: settings.cardsPerRow == n, action: { settings.cardsPerRow = n }) {
                    VStack(spacing: 8) {
                      CardLayoutPreview(perRow: n, selected: settings.cardsPerRow == n)
                      Text("\(n) 张")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    }
                    .padding(.vertical, 4)
                  }
                }
              }
            }
            }
            STRow(title: "字号") {
              HStack(spacing: 10) {
                ForEach([(0.85, "小"), (1.0, "中"), (1.15, "大")], id: \.0) { option in
                  STChoice(selected: settings.cardFontScale == option.0, action: { settings.cardFontScale = option.0 }) {
                    Text("\(option.1)  占卜师")
                      .font(.system(size: 17 * option.0, weight: .bold, design: .rounded))
                  }
                }
              }
            }
          }
          
          STSection(title: "死亡和复活") {
            STRow(title: "怎么切换") {
              STChoiceRow(options: [(true, "点一下号码"), (false, "长按号码")], selection: $settings.deathByTap)
            }
            if !settings.deathByTap {
              STRow(title: "要按多久") {
                STChoiceRow(options: [(0.3, "0.3 秒"), (0.5, "0.5 秒"), (0.8, "0.8 秒"), (1.2, "1.2 秒")], selection: $settings.deathLongPressSeconds)
              }
            }
            STRow(title: "切换前先确认") {
              STChoiceRow(options: [(false, "不用"), (true, "要确认")], selection: $settings.confirmDeath)
            }
            STRow(title: "死亡、复活、删标签后显示撤销") {
              STChoiceRow(options: [(true, "显示"), (false, "不用")], selection: $settings.undoEnabled)
            }
          }
          
          STSection(title: "带局习惯") {
            STRow(title: "新开一局时预设几名玩家") {
              ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                  STChoice(selected: settings.defaultPlayerCount == 0, action: { settings.defaultPlayerCount = 0 }) {
                    Text("不预设").font(.system(size: 17, weight: .bold, design: .rounded))
                  }
                  ForEach(5...15, id: \.self) { n in
                    STChoice(selected: settings.defaultPlayerCount == n, action: { settings.defaultPlayerCount = n }) {
                      Text("\(n)").font(.system(size: 17, weight: .bold, design: .rounded)).frame(minWidth: 22)
                    }
                  }
                }
                .padding(2)
              }
            }
            STRow(title: "记事本常用词") {
              FlowLayoutWrap(spacing: 8) {
                ForEach(settings.notepadTags, id: \.self) { tag in
                  HStack(spacing: 6) {
                    Text(tag)
                      .font(.system(size: 17, weight: .semibold, design: .rounded))
                    Button(action: { settings.notepadTags.removeAll(where: { $0 == tag }) }) {
                      Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .black))
                    }
                    .buttonStyle(.plain)
                  }
                  .padding(.horizontal, 10)
                  .padding(.vertical, 6)
                  .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.black, lineWidth: 2))
                }
              }
              HStack(spacing: 10) {
                TextField("加一个常用词", text: $newTag)
                  .font(.system(size: 17, design: .rounded))
                  .padding(10)
                  .background(Color.mainbg.opacity(0.5))
                  .clipShape(RoundedRectangle(cornerRadius: 12))
                  .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
                  .frame(maxWidth: 320)
                  .onSubmit(addTag)
                STChoice(selected: true, action: addTag) {
                  Text("添加").font(.system(size: 17, weight: .bold, design: .rounded))
                }
                Spacer()
                Button("恢复默认") { showResetTags = true }
                  .font(.system(size: 16, weight: .semibold, design: .rounded))
                  .foregroundColor(.black.opacity(0.6))
              }
            }
          }
          
          STSection(title: "AI") {
            STRow(title: "提供商、Key 和模型", hint: AISettings.shared.isConfigured ? "\(AISettings.shared.provider.name) · \(AISettings.shared.model(AISettings.shared.provider))" : "还没有配置") {
              STChoice(selected: false, action: { showAISettings = true }) {
                Text("打开 AI 设置").font(.system(size: 17, weight: .bold, design: .rounded))
              }
            }
            STRow(title: "本店规矩") {
              TextEditor(text: $settings.houseRules)
                .font(.system(size: 17, design: .rounded))
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: 110)
                .background(Color.mainbg.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
                .overlay(alignment: .topLeading) {
                  if settings.houseRules.isEmpty {
                    Text("比如：邪恶玩家伪装成某个角色来问信息，说书人照样给。")
                      .font(.system(size: 17, design: .rounded))
                      .foregroundColor(.black.opacity(0.35))
                      .padding(.horizontal, 13)
                      .padding(.vertical, 16)
                      .allowsHitTesting(false)
                  }
                }
            }
            STRow(title: "“一批博学者信息”一次给几条") {
              STChoiceRow(options: [(8, "8 条"), (14, "14 条"), (20, "20 条")], selection: Binding(
                get: { settings.savantBatchTotal },
                set: { total in
                  // 换总条数时保持同一种真假分法
                  let current = savantTruths(for: settings.savantBatchTotal)
                  let mode = current.firstIndex(of: settings.savantBatchTrue) ?? 0
                  settings.savantBatchTotal = total
                  settings.savantBatchTrue = savantTruths(for: total)[mode]
                }))
            }
            STRow(title: "其中真假怎么分", hint: "现在是 \(settings.savantBatchTrue) 条真的、\(settings.savantBatchTotal - settings.savantBatchTrue) 条假的。") {
              STChoiceRow(options: savantTrueOptions, selection: $settings.savantBatchTrue)
            }
          }
        }
        .padding(.bottom, 30)
      }
    }
    .padding(28)
    .background(Color.mainbg.ignoresSafeArea())
    .preferredColorScheme(.light)
    .aiPanelSizing()
    .sheet(isPresented: $showAISettings) {
      AISettingsView()
    }
    .alert("恢复成默认的常用词吗？", isPresented: $showResetTags) {
      Button("取消", role: .cancel) {}
      Button("恢复", role: .destructive) {
        settings.notepadTags = defaultNotepadTags
      }
    } message: {
      Text("你加过的词会被删掉。")
    }
  }
}

/// 自动换行的横向排列（用来排常用词）
struct FlowLayoutWrap: Layout {
  var spacing: CGFloat = 8
  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 600
    var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x + size.width > width && x > 0 {
        x = 0
        y += rowHeight + spacing
        rowHeight = 0
      }
      x += size.width + spacing
      rowHeight = max(rowHeight, size.height)
    }
    return CGSize(width: width, height: y + rowHeight)
  }
  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x + size.width > bounds.maxX && x > bounds.minX {
        x = bounds.minX
        y += rowHeight + spacing
        rowHeight = 0
      }
      view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
      x += size.width + spacing
      rowHeight = max(rowHeight, size.height)
    }
  }
}
