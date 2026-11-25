//
//  STStyle.swift
//  说书人普拉斯
//
//  设置、存档、开始界面共用的小组件，沿用 app 的纸色底、奶油色卡片、粗黑描边
//

import SwiftUI

/// 一组设置的外框：标题 + 奶油色卡片
struct STSection<Content: View>: View {
  let title: String
  @ViewBuilder let content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title)
        .font(.system(size: 24, weight: .black, design: .rounded))
      VStack(alignment: .leading, spacing: 22) {
        content
      }
      .padding(20)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.goodTextBg)
      .clipShape(RoundedRectangle(cornerRadius: 18))
      .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black, lineWidth: 3))
    }
  }
}

/// 一行设置：名称、一句说明、下面放选项
struct STRow<Content: View>: View {
  let title: String
  var hint: String = ""
  @ViewBuilder let content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(.system(size: 19, weight: .bold, design: .rounded))
        if !hint.isEmpty {
          Text(hint)
            .font(.system(size: 15, design: .rounded))
            .foregroundColor(.black.opacity(0.55))
        }
      }
      content
    }
  }
}

/// 可点选的选项：选中时黑底，未选中时描边
struct STChoice<Label: View>: View {
  let selected: Bool
  let action: () -> Void
  @ViewBuilder let label: Label
  var body: some View {
    Button(action: action) {
      label
        .foregroundColor(selected ? Color.goodTextBg : .black)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(selected ? Color.black : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 2.5))
        .contentShape(RoundedRectangle(cornerRadius: 14))
    }
    .buttonStyle(.plain)
    .animation(.easeOut(duration: 0.15), value: selected)
  }
}

/// 一排文字选项
struct STChoiceRow<Value: Hashable>: View {
  let options: [(Value, String)]
  @Binding var selection: Value
  var body: some View {
    HStack(spacing: 10) {
      ForEach(options.indices, id: \.self) { i in
        let option = options[i]
        STChoice(selected: selection == option.0, action: { selection = option.0 }) {
          Text(option.1)
            .font(.system(size: 17, weight: .bold, design: .rounded))
        }
      }
    }
  }
}

/// 大按钮：开始界面和存档页用
struct STBigButton: View {
  let title: String
  var subtitle: String = ""
  var systemImage: String = ""
  var filled: Bool = false
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      HStack(spacing: 14) {
        if !systemImage.isEmpty {
          Image(systemName: systemImage)
            .font(.system(size: 24, weight: .bold))
            .frame(width: 32)
        }
        VStack(alignment: .leading, spacing: 3) {
          Text(title)
            .font(.system(size: 21, weight: .black, design: .rounded))
          if !subtitle.isEmpty {
            Text(subtitle)
              .font(.system(size: 15, design: .rounded))
              .opacity(0.65)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
      }
      .foregroundColor(filled ? Color.goodTextBg : .black)
      .padding(.horizontal, 20)
      .padding(.vertical, 12)
      .frame(maxWidth: .infinity, minHeight: 72)
      .background(filled ? Color.black : Color.goodTextBg)
      .clipShape(RoundedRectangle(cornerRadius: 18))
      .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black, lineWidth: 3))
      .contentShape(RoundedRectangle(cornerRadius: 18))
    }
    .buttonStyle(.plain)
  }
}

/// 页面顶栏：标题和关闭按钮
struct STPageHeader: View {
  let title: String
  let onClose: () -> Void
  var body: some View {
    HStack {
      Text(title)
        .font(.system(size: 34, weight: .black, design: .rounded))
      Spacer()
      Button(action: onClose) {
        Text("完成")
          .font(.system(size: 19, weight: .black, design: .rounded))
          .foregroundColor(Color.goodTextBg)
          .padding(.horizontal, 22)
          .padding(.vertical, 10)
          .background(Color.black)
          .clipShape(Capsule())
      }
      .buttonStyle(.plain)
    }
  }
}

/// 卡片布局的小示意图：每行 n 张
struct CardLayoutPreview: View {
  let perRow: Int
  let selected: Bool
  var body: some View {
    let ink = selected ? Color.goodTextBg : Color.black
    VStack(spacing: 4) {
      ForEach(0..<2, id: \.self) { _ in
        HStack(spacing: 4) {
          ForEach(0..<perRow, id: \.self) { _ in
            RoundedRectangle(cornerRadius: 3)
              .fill(ink.opacity(0.85))
              .frame(height: 22)
          }
        }
      }
    }
    .frame(width: 96)
  }
}
