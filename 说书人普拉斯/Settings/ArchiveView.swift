//
//  ArchiveView.swift
//  说书人普拉斯
//
//  游戏存档页：每一局一张卡片，可以载入继续或复盘
//

import SwiftUI

/// 用一圈小圆点画出这一局的座位：实心是活着，空心带叉是死了
struct SeatRing: View {
  let alive: [Bool]
  var body: some View {
    GeometryReader { geo in
      let size = min(geo.size.width, geo.size.height)
      let radius = size / 2 - 7
      let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
      ZStack {
        ForEach(alive.indices, id: \.self) { i in
          let angle = 2 * Double.pi * Double(i) / Double(max(alive.count, 1)) - Double.pi / 2
          Group {
            if alive[i] {
              Circle().fill(Color.black)
            } else {
              Circle().stroke(Color.black, lineWidth: 1.5)
                .overlay(Image(systemName: "xmark").font(.system(size: 6, weight: .black)))
            }
          }
          .frame(width: 11, height: 11)
          .position(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
        }
      }
    }
  }
}

struct ArchiveView: View {
  /// 正在进行的那一局（从小镇里打开时），这一张不能载入和删除
  var currentGameID: String? = nil
  let onLoad: (String) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var entries: [GameArchiveEntry] = []
  @State private var pendingDelete: GameArchiveEntry? = nil
  @State private var reviewing: GameArchiveEntry? = nil
  
  private func stageText(_ entry: GameArchiveEntry) -> String {
    switch entry.gameState {
    case 1: return "首夜"
    case 2: return "第 \(max(entry.dayCount, 1)) 天白天"
    case 3: return "第 \(entry.dayCount + 1) 夜"
    default: return "配版中"
    }
  }
  
  private let columns = [GridItem(.adaptive(minimum: 300), spacing: 18)]
  
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      STPageHeader(title: "游戏存档", onClose: { dismiss() })
      if entries.isEmpty {
        VStack(spacing: 12) {
          Image(systemName: "tray")
            .font(.system(size: 44, weight: .bold))
          Text("还没有存档")
            .font(.system(size: 22, weight: .black, design: .rounded))
          Text("开始游戏之后会自动保存")
            .font(.system(size: 16, design: .rounded))
            .foregroundColor(.black.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        ScrollView {
          LazyVGrid(columns: columns, spacing: 18) {
            ForEach(entries) { entry in
              let isCurrent = entry.id == currentGameID
              VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 14) {
                  SeatRing(alive: entry.alive)
                    .frame(width: 76, height: 76)
                  VStack(alignment: .leading, spacing: 4) {
                    Text(entry.playName.isEmpty ? "无名剧本" : entry.playName)
                      .font(.system(size: 22, weight: .black, design: .rounded))
                      .lineLimit(1)
                    Text("\(entry.playerCount) 人，还剩 \(entry.aliveCount) 人活着")
                      .font(.system(size: 16, weight: .semibold, design: .rounded))
                    Text("\(stageText(entry))，\(entry.savedAt.formatted(.dateTime.locale(Locale(identifier: "zh_CN")).month().day().hour().minute())) 保存")
                      .font(.system(size: 15, design: .rounded))
                      .foregroundColor(.black.opacity(0.6))
                  }
                  Spacer(minLength: 0)
                }
                HStack(spacing: 10) {
                  STChoice(selected: false, action: { reviewing = entry }) {
                    Text("复盘").font(.system(size: 17, weight: .bold, design: .rounded))
                  }
                  if isCurrent {
                    Text("正在进行")
                      .font(.system(size: 17, weight: .bold, design: .rounded))
                      .foregroundColor(.black.opacity(0.5))
                      .padding(.vertical, 10)
                  } else {
                    STChoice(selected: true, action: {
                      dismiss()
                      onLoad(entry.id)
                    }) {
                      Text("载入这一局").font(.system(size: 17, weight: .bold, design: .rounded))
                    }
                    Spacer()
                    Button(action: { pendingDelete = entry }) {
                      Image(systemName: "trash")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.demon)
                        .padding(10)
                    }
                    .buttonStyle(.plain)
                  }
                }
              }
              .padding(18)
              .background(Color.goodTextBg)
              .clipShape(RoundedRectangle(cornerRadius: 18))
              .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black, lineWidth: isCurrent ? 5 : 3))
            }
          }
          .padding(.bottom, 30)
          .padding(4)
        }
      }
    }
    .padding(28)
    .background(Color.mainbg.ignoresSafeArea())
    .preferredColorScheme(.light)
    .aiPanelSizing()
    .onAppear {
      entries = GameArchive.list()
    }
    .sheet(item: $reviewing) { entry in
      ReviewView(gameID: entry.id)
    }
    .alert("删除“\(pendingDelete?.playName ?? "")”的存档吗？", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })) {
      Button("取消", role: .cancel) {}
      Button("删除", role: .destructive) {
        if let entry = pendingDelete {
          GameArchive.delete(entry.id)
          entries = GameArchive.list()
        }
      }
    } message: {
      Text("删除后无法恢复。")
    }
  }
}
