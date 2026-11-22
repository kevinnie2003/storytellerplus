//
//  AIAdvisorView.swift
//  说书人普拉斯
//
//  AI 说书：游戏中给说书人的建议
//

import SwiftUI
import Flow

/// 模型偶尔会用 **加粗** 这类 Markdown，这里渲染成富文本，解析失败就原样显示
func aiMarkdown(_ text: String) -> AttributedString {
  let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
  return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
}

struct AIAdvisorView: View {
  @Binding var chat: [AIChatMessage]
  let makeContext: () -> AIGameContext
  @Environment(\.dismiss) private var dismiss
  @State private var input: String = ""
  @State private var busy: Bool = false
  @State private var startedAt: Date = Date()
  @State private var progress: String = ""
  @State private var streamingText: String = ""
  @State private var errorText: String = ""
  @State private var showSettings: Bool = false
  
  let quickPrompts = [
    "现在局势偏向哪边？我该怎么平衡？",
    "今晚的信息怎么给比较好？",
    "有人醉酒或中毒，给什么假信息合适？",
    "这局有哪些内容要我自己编？帮我定好",
    "博学者来问信息，给哪两条？",
    "今晚恶魔的刀怎么处理比较有戏？"
  ]
  
  private func send(_ text: String) {
    let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if question.isEmpty || busy {
      return
    }
    chat.append(AIChatMessage(role: "user", text: question))
    input = ""
    errorText = ""
    busy = true
    startedAt = Date()
    progress = "正在思考…"
    streamingText = ""
    let history = chat
    let system = AIPrompts.advisorSystem(makeContext())
    Task {
      do {
        let reply = try await AIClient.sendStreaming(system: system, messages: history, maxTokens: 8000, onThinking: { thought in
          progress = aiThinkingTail(thought)
        }) { partial in
          streamingText = partial
        }
        streamingText = ""
        chat.append(AIChatMessage(role: "assistant", text: reply.trimmingCharacters(in: .whitespacesAndNewlines)))
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
      streamingText = ""
    }
  }
  
  var body: some View {
    VStack(spacing: 12) {
      AIPanelHeader(title: "AI 说书", showSettings: $showSettings, onClose: { dismiss() })
      ScrollViewReader { proxy in
        ScrollView {
          VStack(alignment: .leading, spacing: 10) {
            if chat.isEmpty {
              Text("AI 能看到当前魔典、标记和游戏记录。问它怎么给信息、怎么平衡局势都可以。")
                .font(.system(size: 16, design: .rounded))
                .foregroundColor(.secondary)
            }
            ForEach(chat) { message in
              HStack {
                if message.role == "user" {
                  Spacer(minLength: 60)
                }
                Text(aiMarkdown(message.text))
                  .font(.system(size: 17, weight: .medium, design: .rounded))
                  .foregroundColor(message.role == "user" ? Color.goodTextBg : .black)
                  .padding(12)
                  .background(message.role == "user" ? Color.black : Color.goodTextBg)
                  .cornerRadius(14)
                  .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 2))
                  .textSelection(.enabled)
                if message.role != "user" {
                  Spacer(minLength: 60)
                }
              }
              .id(message.id)
            }
            if busy {
              if streamingText.isEmpty {
                AIProgressLine(since: startedAt, text: progress)
                  .id("busy")
              } else {
                HStack {
                  Text(aiMarkdown(streamingText))
                    .font(.system(size: 17, weight: .medium, design: .rounded))
                    .foregroundColor(.black)
                    .padding(12)
                    .background(Color.goodTextBg)
                    .cornerRadius(14)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 2))
                  Spacer(minLength: 60)
                }
                .id("busy")
              }
            }
            if !errorText.isEmpty {
              Text(errorText)
                .font(.system(size: 15, design: .rounded))
                .foregroundColor(.red)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 5)
        }
        .onChange(of: streamingText) { _, _ in
          proxy.scrollTo("busy", anchor: .bottom)
        }
        .onChange(of: chat.count) { _, _ in
          if let last = chat.last {
            withAnimation {
              proxy.scrollTo(last.id, anchor: .bottom)
            }
          }
        }
      }
      HFlow(horizontalAlignment: .leading, verticalAlignment: .top) {
        ForEach(quickPrompts, id: \.self) { prompt in
          AIChip(text: prompt) {
            send(prompt)
          }
        }
        if !chat.isEmpty {
          AIChip(text: "清空对话") {
            chat = []
            errorText = ""
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      HStack {
        TextField("问点什么，比如：3号博学者来问信息怎么给", text: $input, axis: .vertical)
          .lineLimit(1...3)
          .font(.system(size: 17, design: .rounded))
          .padding(10)
          .background(Color.goodTextBg)
          .cornerRadius(12)
          .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
          .onSubmit {
            send(input)
          }
        Button(action: { send(input) }) {
          AIPillLabel(text: "发送", filled: true)
        }
        .disabled(busy)
      }
    }
    .padding(20)
    .background(Color.mainbg.ignoresSafeArea())
    .preferredColorScheme(.light)
    .aiPanelSizing()
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}
