//
//  AISettingsView.swift
//  说书人普拉斯
//

import SwiftUI

struct AISettingsView: View {
  @ObservedObject private var settings = AISettings.shared
  @Environment(\.dismiss) private var dismiss
  @State private var apiKey: String = ""
  @State private var model: String = ""
  @State private var baseURL: String = ""
  @State private var fetchedModels: [String] = []
  @State private var status: String = ""
  @State private var statusOK: Bool = false
  @State private var busy: Bool = false
  
  private var modelChoices: [String] {
    var list = fetchedModels.isEmpty ? settings.provider.defaultModels : fetchedModels
    if !model.isEmpty && !list.contains(model) {
      list.insert(model, at: 0)
    }
    return list
  }
  
  private var currentConfig: AIConfig {
    AIConfig(provider: settings.provider,
             baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines),
             apiKey: apiKey.trimmingCharacters(in: .whitespacesAndNewlines),
             model: model.trimmingCharacters(in: .whitespacesAndNewlines))
  }
  
  private func load() {
    let p = settings.provider
    apiKey = settings.apiKey(p)
    model = settings.model(p)
    baseURL = settings.baseURL(p)
    fetchedModels = []
    status = ""
  }
  
  private func save() {
    let p = settings.provider
    settings.setModel(model, p)
    settings.setBaseURL(baseURL == p.defaultBaseURL ? "" : baseURL, p)
    if !settings.setAPIKey(apiKey, p) {
      status = "API Key 保存到钥匙串失败"
      statusOK = false
    }
  }
  
  var body: some View {
    NavigationStack {
      Form {
        Section("提供商") {
          Picker("提供商", selection: Binding(
            get: { settings.providerID },
            set: { newValue in
              save()
              settings.providerID = newValue
              load()
            })) {
              ForEach(aiProviders) { p in
                Text(p.name).tag(p.id)
              }
            }
          if !settings.provider.note.isEmpty {
            Text(settings.provider.note)
              .font(.footnote)
              .foregroundColor(.secondary)
          }
        }
        Section("API Key") {
          SecureField("粘贴 API Key", text: $apiKey)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          Text("Key 只保存在这台设备的钥匙串里，请求直接从本机发给你选的提供商。")
            .font(.footnote)
            .foregroundColor(.secondary)
        }
        Section("模型") {
          if !modelChoices.isEmpty {
            Picker("选择模型", selection: $model) {
              ForEach(modelChoices, id: \.self) { m in
                Text(m).tag(m)
              }
            }
          }
          TextField("模型 ID", text: $model)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          Button("获取模型列表") {
            Task {
              busy = true
              do {
                let list = try await AIClient.listModels(currentConfig)
                fetchedModels = list.sorted()
                status = "获取到 \(list.count) 个模型"
                statusOK = true
              } catch {
                status = error.localizedDescription
                statusOK = false
              }
              busy = false
            }
          }
          .disabled(busy || apiKey.isEmpty)
          Text("图片生成剧本需要支持图片输入的模型。")
            .font(.footnote)
            .foregroundColor(.secondary)
        }
        Section("接口地址") {
          TextField("https://...", text: $baseURL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
          if baseURL != settings.provider.defaultBaseURL && !settings.provider.defaultBaseURL.isEmpty {
            Button("恢复默认地址") {
              baseURL = settings.provider.defaultBaseURL
            }
          }
        }
        Section {
          Button(busy ? "请稍候…" : "测试连接") {
            Task {
              busy = true
              status = ""
              save()
              do {
                let reply = try await AIClient.send(system: "", messages: [AIChatMessage(role: "user", text: "请只回复“连接成功”这四个字。")], maxTokens: 2000, config: currentConfig)
                status = "连接成功，模型回复：\(reply.prefix(40))"
                statusOK = true
              } catch {
                status = error.localizedDescription
                statusOK = false
              }
              busy = false
            }
          }
          .disabled(busy || apiKey.isEmpty || model.isEmpty)
          if !status.isEmpty {
            Text(status)
              .font(.footnote)
              .foregroundColor(statusOK ? .green : .red)
          }
        }
      }
      .navigationTitle("AI 设置")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("完成") {
            save()
            dismiss()
          }
        }
      }
    }
    .preferredColorScheme(.light)
    .onAppear {
      load()
    }
  }
}

/// 各个 AI 面板共用的顶栏
struct AIPanelHeader: View {
  let title: String
  @Binding var showSettings: Bool
  let onClose: () -> Void
  @ObservedObject private var settings = AISettings.shared
  
  var body: some View {
    HStack {
      Text(title)
        .font(.system(size: 24, weight: .black, design: .rounded))
      Spacer()
      Text(settings.isConfigured ? "\(settings.provider.name) · \(settings.model(settings.provider))" : "未配置 AI")
        .font(.system(size: 14, design: .rounded))
        .foregroundColor(settings.isConfigured ? .secondary : .red)
        .lineLimit(1)
      Button(action: { showSettings = true }) {
        Image(systemName: "gearshape")
          .font(.system(size: 22, weight: .bold))
          .foregroundColor(.black)
      }
      .padding(.leading, 10)
      Button(action: onClose) {
        Image(systemName: "xmark.circle")
          .font(.system(size: 22, weight: .bold))
          .foregroundColor(.black)
      }
      .padding(.leading, 10)
    }
  }
}

struct AIPillLabel: View {
  let text: String
  var filled: Bool = false
  var body: some View {
    Text(text)
      .font(.system(size: 18, weight: .bold, design: .rounded))
      .foregroundColor(filled ? Color.goodTextBg : .black)
      .padding(.horizontal, 18)
      .padding(.vertical, 10)
      .background(filled ? Color.black : Color.goodTextBg)
      .cornerRadius(24)
      .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.black, lineWidth: 3))
  }
}

struct AIChip: View {
  let text: String
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Text(text)
        .font(.system(size: 15, weight: .semibold, design: .rounded))
        .foregroundColor(.black)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.goodTextBg)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black, lineWidth: 2))
    }
  }
}

extension View {
  /// AI 面板在 iPad 上用大一点的弹窗
  @ViewBuilder
  func aiPanelSizing() -> some View {
    if #available(iOS 18.0, *) {
      self.presentationSizing(.page)
    } else {
      self
    }
  }
}

/// 把模型思考摘要的最后一句整理成一行进度文字
func aiThinkingTail(_ thinking: String) -> String {
  let lines = thinking.split(whereSeparator: { $0.isNewline }).map({ $0.trimmingCharacters(in: CharacterSet(charactersIn: " *#-·>`")) }).filter({ !$0.isEmpty })
  guard let last = lines.last else {
    return "正在思考…"
  }
  // 模型的思考摘要有时是英文，对说书人没用，这时只显示已经想了多少
  let hasChinese = last.unicodeScalars.contains(where: { $0.value >= 0x4E00 && $0.value <= 0x9FFF })
  if !hasChinese {
    return "正在思考…已想了 \(thinking.count) 字"
  }
  return "思考：" + String(last.suffix(34))
}

/// 各个 AI 面板共用的进度行：转圈、当前在做什么、已经用了多少秒
struct AIProgressLine: View {
  let since: Date
  let text: String
  var body: some View {
    TimelineView(.periodic(from: since, by: 1)) { context in
      HStack(spacing: 8) {
        ProgressView()
        Text("\(text)（\(max(0, Int(context.date.timeIntervalSince(since)))) 秒）")
          .font(.system(size: 15, weight: .semibold, design: .rounded))
          .foregroundColor(.secondary)
          .lineLimit(1)
      }
    }
  }
}
