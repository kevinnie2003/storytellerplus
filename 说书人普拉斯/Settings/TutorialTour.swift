//
//  TutorialTour.swift
//  说书人普拉斯
//
//  新手教程：在一个演示小镇里，用遮罩把真实界面上要讲的地方圈出来，旁边写清楚怎么点
//

import SwiftUI

// MARK: - 标记界面上的位置

struct TutorialAnchorKey: PreferenceKey {
  static var defaultValue: [String: Anchor<CGRect>] = [:]
  static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
    // 同名的取第一个，例如只圈第一张玩家卡片
    value.merge(nextValue()) { first, _ in first }
  }
}

extension View {
  /// 给教程用的位置标记，平时没有任何效果
  func tutorialAnchor(_ id: String, enabled: Bool = true) -> some View {
    // 用 transform 合并，外层的标记不会盖掉里面的（例如整张卡片和卡片上的头像）
    transformAnchorPreference(key: TutorialAnchorKey.self, value: .bounds) { value, anchor in
      if enabled && value[id] == nil { value[id] = anchor }
    }
  }
}

/// 教程让某个滚动区域滚到要讲的按钮（按钮不在屏幕里时）
final class TourBus: ObservableObject {
  static let shared = TourBus()
  @Published var scrollRequest: String? = nil
  func scroll(to id: String) {
    scrollRequest = nil
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { self.scrollRequest = id }
  }
}

// MARK: - 一步教程

struct TourStep {
  /// 要圈出来的位置，可以圈好几个；空的话说明卡片放在屏幕中间
  var targets: [String] = []
  let title: String
  let lines: [String]
  /// 进入这一步前把演示小镇调成需要的样子，例如入夜、打开齿轮面板
  var prepare: () -> Void = {}
  /// 圈出来的地方可以真的点
  var interactive = false
  /// 动手的一步：做完自动进入下一步
  var done: (() -> Bool)? = nil
  /// 点“帮我做”往后跳几步，按钮上写什么
  var skipSteps = 1
  var skipLabel = "帮我做"
  /// 圈出来的地方太大、旁边放不下时，指定说明卡片放在屏幕哪个角
  var cardCorner: Alignment? = nil
  /// 整个屏幕都能点（比如要教“双击面板外面的空白处关掉”）
  var freeTaps = false
}

// MARK: - 遮罩和说明卡片

struct TourOverlay: View {
  let steps: [TourStep]
  let anchors: [String: Anchor<CGRect>]
  let onFinish: () -> Void
  @State private var index = 0
  /// 进入这一步时条件已经满足（比如前面点了“帮我做”），等它先变回不满足再自动前进
  @State private var doneAtEntry = false
  /// 说明卡片挡住东西时可以拖开
  @State private var dragOffset: CGSize = .zero
  @State private var dragBase: CGSize = .zero
  private let ticker = Timer.publish(every: 0.3, on: .main, in: .common).autoconnect()

  private func go(_ to: Int) {
    guard to >= 0 && to < steps.count else { return }
    steps[to].prepare()
    doneAtEntry = true
    // prepare 改的状态要等一下才生效，再看条件
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      doneAtEntry = steps[to].done?() ?? false
    }
    dragOffset = .zero
    dragBase = .zero
    withAnimation(.easeInOut(duration: 0.35)) { index = to }
  }

  var body: some View {
    GeometryReader { proxy in
      let step = steps[index]
      let rects = step.targets.compactMap { id in anchors[id].map { proxy[$0].insetBy(dx: -8, dy: -8) } }
      let size = proxy.size
      ZStack(alignment: .topLeading) {
        // 遮罩，挖掉要讲的地方；拦住所有点击，免得演示小镇被改乱
        SpotlightShape(holes: rects)
          .fill(Color.black.opacity(step.interactive ? 0.45 : 0.55), style: FillStyle(eoFill: true))
          // 动手的一步：圈出来的地方可以点，其他地方拦住
          .contentShape(SpotlightShape(holes: step.interactive ? rects : []), eoFill: true)
          .onTapGesture {}
          // 要教“双击外面关掉”的那几步，遮罩不拦点击
          .allowsHitTesting(!step.freeTaps)
        ForEach(rects.indices, id: \.self) { i in
          RoundedRectangle(cornerRadius: 14)
            .stroke(Color.fabled, lineWidth: 4)
            .frame(width: rects[i].width, height: rects[i].height)
            .position(x: rects[i].midX, y: rects[i].midY)
            .allowsHitTesting(false)
        }
        Group {
          if let corner = step.cardCorner {
            // 贴着屏幕角放，按卡片真实高度对齐，不会超出屏幕
            card(step: step)
              .frame(width: 380)
              .padding(.top, 28)
              .padding(20)
              .frame(width: size.width, height: size.height, alignment: corner)
              .allowsHitTesting(true)
          } else {
            card(step: step)
              .frame(width: 380)
              .position(cardPosition(for: rects, size: size))
          }
        }
          .offset(dragOffset)
          .gesture(
            DragGesture(minimumDistance: 8)
              .onChanged { value in
                dragOffset = CGSize(width: dragBase.width + value.translation.width, height: dragBase.height + value.translation.height)
              }
              .onEnded { _ in dragBase = dragOffset }
          )
      }
      .animation(.easeInOut(duration: 0.35), value: index)
    }
    .ignoresSafeArea()
    .onAppear { steps[0].prepare() }
    .onReceive(ticker) { _ in
      guard let done = steps[index].done else { return }
      if !done() {
        doneAtEntry = false
      } else if !doneAtEntry && index < steps.count - 1 {
        go(index + 1)
      }
    }
  }

  /// 说明卡片放在圈出来的地方旁边；放不下就挑和圈出来的地方重叠最少的角落
  private func cardPosition(for rects: [CGRect], size: CGSize) -> CGPoint {
    let w: CGFloat = 380
    let h: CGFloat = 330
    let m: CGFloat = 20
    guard let first = rects.first else {
      return CGPoint(x: size.width / 2, y: size.height / 2)
    }
    let union = rects.dropFirst().reduce(first) { $0.union($1) }
    func clampY(_ y: CGFloat) -> CGFloat { min(max(y, h / 2 + m), size.height - h / 2 - m) }
    func clampX(_ x: CGFloat) -> CGFloat { min(max(x, w / 2 + m), size.width - w / 2 - m) }
    let candidates: [CGPoint] = [
      CGPoint(x: union.maxX + m + w / 2, y: clampY(union.midY)),
      CGPoint(x: union.minX - m - w / 2, y: clampY(union.midY)),
      CGPoint(x: clampX(union.midX), y: union.maxY + m + h / 2),
      CGPoint(x: clampX(union.midX), y: union.minY - m - h / 2),
      CGPoint(x: w / 2 + m, y: h / 2 + m),
      CGPoint(x: size.width - w / 2 - m, y: h / 2 + m),
      CGPoint(x: w / 2 + m, y: size.height - h / 2 - m),
      CGPoint(x: size.width - w / 2 - m, y: size.height - h / 2 - m)
    ]
    let screen = CGRect(origin: .zero, size: size)
    func overlap(_ c: CGPoint) -> CGFloat {
      let card = CGRect(x: c.x - w / 2, y: c.y - h / 2, width: w, height: h)
      if !screen.insetBy(dx: m / 2, dy: m / 2).contains(card) { return .greatestFiniteMagnitude }
      return rects.reduce(0) { total, r in
        let i = card.intersection(r)
        return total + (i.isNull ? 0 : i.width * i.height)
      }
    }
    return candidates.min(by: { overlap($0) < overlap($1) }) ?? CGPoint(x: size.width / 2, y: size.height / 2)
  }
  
  private func card(step: TourStep) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("\(index + 1) / \(steps.count)")
          .font(.system(size: 14, weight: .bold, design: .rounded))
          .foregroundColor(.ink.opacity(0.5))
        Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(.ink.opacity(0.35))
          .padding(.leading, 6)
        Spacer()
        Button(action: onFinish) {
          Text("退出教程")
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundColor(.ink.opacity(0.6))
        }
        .buttonStyle(.plain)
      }
      Text(step.title)
        .font(.system(size: 24, weight: .black, design: .rounded))
      VStack(alignment: .leading, spacing: 8) {
        ForEach(step.lines, id: \.self) { line in
          Text(line)
            .font(.system(size: 17, design: .rounded))
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      HStack {
        Spacer()
        if step.done != nil {
          Text("照着做，完成后自动下一步")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(.ink.opacity(0.5))
          STChoice(selected: false, action: { go(min(index + step.skipSteps, steps.count - 1)) }) {
            Text(step.skipLabel).font(.system(size: 16, weight: .bold, design: .rounded))
          }
        } else {
          STChoice(selected: true, action: {
            if index == steps.count - 1 { onFinish() } else { go(index + 1) }
          }) {
            Text(index == steps.count - 1 ? "完成" : "下一步").font(.system(size: 16, weight: .bold, design: .rounded))
          }
        }
      }
      .padding(.top, 4)
    }
    .padding(20)
    .background(RoundedRectangle(cornerRadius: 18).fill(Color.paper))
    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.ink, lineWidth: 3))
    .shadow(color: .black.opacity(0.25), radius: 12, y: 6)
  }
}

/// 整个屏幕减去几个圆角矩形
struct SpotlightShape: Shape {
  var holes: [CGRect]
  func path(in rect: CGRect) -> Path {
    var path = Path(rect)
    for hole in holes {
      path.addRoundedRect(in: hole, cornerSize: CGSize(width: 14, height: 14))
    }
    return path
  }
}
