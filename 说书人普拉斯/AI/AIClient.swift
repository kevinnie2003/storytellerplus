//
//  AIClient.swift
//  说书人普拉斯
//
//  发请求给 Claude 或 OpenAI 兼容接口
//

import Foundation

struct AIChatMessage: Identifiable, Hashable {
  let id = UUID()
  var role: String // "user" 或 "assistant"
  var text: String
}

enum AIError: LocalizedError {
  case notConfigured
  case badURL
  case http(Int, String)
  case refusal
  case empty
  case truncated
  case badFormat(String)
  
  var errorDescription: String? {
    switch self {
    case .notConfigured:
      return "还没有配置 AI。请先在 AI 设置里填写 API Key 和模型。"
    case .badURL:
      return "接口地址不正确，请检查 AI 设置。"
    case .http(let code, let message):
      if code == 401 || code == 403 {
        return "API Key 无效或没有权限（\(code)）：\(message)"
      }
      if code == 429 {
        return "请求太频繁或额度不足（429）：\(message)"
      }
      return "请求失败（\(code)）：\(message)"
    case .refusal:
      return "模型拒绝了这次请求，可以换个说法或换个模型再试。"
    case .empty:
      return "模型没有返回内容，请重试。"
    case .truncated:
      return "模型的回复太长被截断了，请重试或换一个模型。"
    case .badFormat(let detail):
      return "模型返回的格式不对：\(detail)"
    }
  }
}

enum AIClient {
  static let session: URLSession = {
    let c = URLSessionConfiguration.default
    c.timeoutIntervalForRequest = 600
    c.timeoutIntervalForResource = 900
    return URLSession(configuration: c)
  }()
  
  static func trimmedBase(_ base: String) -> String {
    var s = base.trimmingCharacters(in: .whitespacesAndNewlines)
    while s.hasSuffix("/") {
      s.removeLast()
    }
    return s
  }
  
  static func errorMessage(_ json: [String: Any]?, _ data: Data) -> String {
    if let err = json?["error"] as? [String: Any], let message = err["message"] as? String {
      return message
    }
    if let err = json?["error"] as? String {
      return err
    }
    if let message = json?["message"] as? String {
      return message
    }
    return String(String(data: data, encoding: .utf8)?.prefix(300) ?? "")
  }
  
  /// 发送一次对话，返回模型的文字回复。图片会附在第一条用户消息上。
  static func send(system: String, messages: [AIChatMessage], imageJPEG: Data? = nil, maxTokens: Int = 16000, thorough: Bool = false, config: AIConfig? = nil) async throws -> String {
    let cfg = config ?? AISettings.shared.config
    guard !cfg.apiKey.isEmpty, !cfg.model.isEmpty else {
      throw AIError.notConfigured
    }
    do {
      switch cfg.provider.style {
      case .anthropic:
        return try await sendAnthropic(cfg, system: system, messages: messages, imageJPEG: imageJPEG, maxTokens: maxTokens, thorough: thorough)
      case .openAI:
        return try await sendOpenAI(cfg, system: system, messages: messages, imageJPEG: imageJPEG, maxTokens: maxTokens)
      }
    } catch AIError.http(let code, let message) where imageJPEG != nil && code == 400 {
      throw AIError.http(code, message + "（这个模型可能不支持图片输入，请换一个支持图片的模型）")
    }
  }
  
  private static func sendAnthropic(_ cfg: AIConfig, system: String, messages: [AIChatMessage], imageJPEG: Data?, maxTokens: Int, thorough: Bool) async throws -> String {
    guard let url = URL(string: trimmedBase(cfg.baseURL) + "/v1/messages") else {
      throw AIError.badURL
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(cfg.apiKey, forHTTPHeaderField: "x-api-key")
    req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
    
    var msgs: [[String: Any]] = []
    for (i, m) in messages.enumerated() {
      if i == 0, let img = imageJPEG {
        msgs.append(["role": m.role, "content": [
          ["type": "image", "source": ["type": "base64", "media_type": "image/jpeg", "data": img.base64EncodedString()]],
          ["type": "text", "text": m.text]
        ]])
      } else {
        msgs.append(["role": m.role, "content": m.text])
      }
    }
    var body: [String: Any] = ["model": cfg.model, "max_tokens": maxTokens, "messages": msgs]
    if !system.isEmpty {
      body["system"] = system
    }
    // 配版这类要反复权衡的任务，让 Claude 用更高的思考强度。只对官方接口发这个参数，第三方的 Claude 兼容接口不一定认识它。
    if thorough && (url.host ?? "").hasSuffix("anthropic.com") {
      body["output_config"] = ["effort": "high"]
    }
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, resp) = try await session.data(for: req)
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 else {
      throw AIError.http(code, errorMessage(json, data))
    }
    let stop = json?["stop_reason"] as? String ?? ""
    if stop == "refusal" {
      throw AIError.refusal
    }
    if stop == "max_tokens" {
      throw AIError.truncated
    }
    let blocks = json?["content"] as? [[String: Any]] ?? []
    let text = blocks.filter({ ($0["type"] as? String) == "text" }).compactMap({ $0["text"] as? String }).joined()
    if text.isEmpty {
      throw AIError.empty
    }
    return text
  }
  
  private static func sendOpenAI(_ cfg: AIConfig, system: String, messages: [AIChatMessage], imageJPEG: Data?, maxTokens: Int) async throws -> String {
    guard !cfg.baseURL.isEmpty, let url = URL(string: trimmedBase(cfg.baseURL) + "/chat/completions") else {
      throw AIError.badURL
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(cfg.apiKey)", forHTTPHeaderField: "Authorization")
    
    var msgs: [[String: Any]] = []
    if !system.isEmpty {
      msgs.append(["role": "system", "content": system])
    }
    for (i, m) in messages.enumerated() {
      if i == 0, let img = imageJPEG {
        msgs.append(["role": m.role, "content": [
          ["type": "text", "text": m.text],
          ["type": "image_url", "image_url": ["url": "data:image/jpeg;base64,\(img.base64EncodedString())"]]
        ]])
      } else {
        msgs.append(["role": m.role, "content": m.text])
      }
    }
    var body: [String: Any] = ["model": cfg.model, "messages": msgs, "stream": false]
    body[cfg.provider.usesMaxCompletionTokens ? "max_completion_tokens" : "max_tokens"] = maxTokens
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, resp) = try await session.data(for: req)
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 else {
      throw AIError.http(code, errorMessage(json, data))
    }
    let choice = (json?["choices"] as? [[String: Any]])?.first
    let message = choice?["message"] as? [String: Any]
    if (choice?["finish_reason"] as? String) == "length" {
      throw AIError.truncated
    }
    var text = message?["content"] as? String ?? ""
    if text.isEmpty, let parts = message?["content"] as? [[String: Any]] {
      text = parts.compactMap({ $0["text"] as? String }).joined()
    }
    if text.isEmpty {
      throw AIError.empty
    }
    return text
  }
  
  // MARK: 流式请求
  
  private static func messagesPayload(_ messages: [AIChatMessage], imageJPEG: Data?, anthropic: Bool) -> [[String: Any]] {
    var msgs: [[String: Any]] = []
    for (i, m) in messages.enumerated() {
      if i == 0, let img = imageJPEG {
        let b64 = img.base64EncodedString()
        if anthropic {
          msgs.append(["role": m.role, "content": [
            ["type": "image", "source": ["type": "base64", "media_type": "image/jpeg", "data": b64]],
            ["type": "text", "text": m.text]
          ]])
        } else {
          msgs.append(["role": m.role, "content": [
            ["type": "text", "text": m.text],
            ["type": "image_url", "image_url": ["url": "data:image/jpeg;base64,\(b64)"]]
          ]])
        }
      } else {
        msgs.append(["role": m.role, "content": m.text])
      }
    }
    return msgs
  }
  
  /// 流式发送，边生成边通过 onProgress 回报目前已经写出的全部文字，结束后返回完整回复。
  /// effort 只对 Claude 官方接口生效，可以是 "low"、"medium"、"high"。
  static func sendStreaming(system: String, messages: [AIChatMessage], imageJPEG: Data? = nil, maxTokens: Int = 32000, effort: String? = nil, config: AIConfig? = nil, onThinking: (@MainActor (String) -> Void)? = nil, onProgress: @escaping @MainActor (String) -> Void) async throws -> String {
    let cfg = config ?? AISettings.shared.config
    guard !cfg.apiKey.isEmpty, !cfg.model.isEmpty else {
      throw AIError.notConfigured
    }
    let isAnthropic = cfg.provider.style == .anthropic
    guard !cfg.baseURL.isEmpty, let url = URL(string: trimmedBase(cfg.baseURL) + (isAnthropic ? "/v1/messages" : "/chat/completions")) else {
      throw AIError.badURL
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var body: [String: Any] = ["model": cfg.model, "stream": true]
    if isAnthropic {
      req.setValue(cfg.apiKey, forHTTPHeaderField: "x-api-key")
      req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
      body["max_tokens"] = maxTokens
      body["messages"] = messagesPayload(messages, imageJPEG: imageJPEG, anthropic: true)
      if !system.isEmpty {
        body["system"] = system
      }
      let official = (url.host ?? "").hasSuffix("anthropic.com")
      if let effort = effort, official {
        body["output_config"] = ["effort": effort]
      }
      // 让 Claude 把思考过程的摘要也流式发回来，用来显示进度。旧型号不支持这种写法，跳过。
      let model = cfg.model.lowercased()
      let oldModel = model.contains("haiku-4") || model.contains("-4-5") || model.contains("-4-1") || model.contains("-3-")
      if onThinking != nil && official && !oldModel {
        body["thinking"] = ["type": "adaptive", "display": "summarized"]
      }
    } else {
      req.setValue("Bearer \(cfg.apiKey)", forHTTPHeaderField: "Authorization")
      var msgs: [[String: Any]] = []
      if !system.isEmpty {
        msgs.append(["role": "system", "content": system])
      }
      msgs.append(contentsOf: messagesPayload(messages, imageJPEG: imageJPEG, anthropic: false))
      body["messages"] = msgs
      body[cfg.provider.usesMaxCompletionTokens ? "max_completion_tokens" : "max_tokens"] = maxTokens
    }
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (bytes, resp) = try await session.bytes(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    if code != 200 {
      var data = Data()
      for try await byte in bytes {
        data.append(byte)
        if data.count > 20000 {
          break
        }
      }
      let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      var message = errorMessage(json, data)
      if imageJPEG != nil && code == 400 {
        message += "（这个模型可能不支持图片输入，请换一个支持图片的模型）"
      }
      throw AIError.http(code, message)
    }
    
    var text = ""
    var thinking = ""
    var stop = ""
    var lastReport = Date.distantPast
    for try await line in bytes.lines {
      guard line.hasPrefix("data:") else {
        continue
      }
      let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
      if payload == "[DONE]" {
        break
      }
      guard let event = (try? JSONSerialization.jsonObject(with: Data(payload.utf8))) as? [String: Any] else {
        continue
      }
      if isAnthropic {
        let type = event["type"] as? String ?? ""
        if type == "content_block_delta", let delta = event["delta"] as? [String: Any], (delta["type"] as? String) == "text_delta" {
          text += delta["text"] as? String ?? ""
        } else if type == "content_block_delta", let delta = event["delta"] as? [String: Any], (delta["type"] as? String) == "thinking_delta" {
          thinking += delta["thinking"] as? String ?? ""
        } else if type == "message_delta", let delta = event["delta"] as? [String: Any] {
          stop = delta["stop_reason"] as? String ?? stop
        } else if type == "error" {
          throw AIError.http(0, errorMessage(event, Data(payload.utf8)))
        }
      } else {
        if event["error"] != nil {
          throw AIError.http(0, errorMessage(event, Data(payload.utf8)))
        }
        if let choice = (event["choices"] as? [[String: Any]])?.first {
          if let delta = choice["delta"] as? [String: Any] {
            if let piece = delta["content"] as? String {
              text += piece
            }
            if let piece = delta["reasoning_content"] as? String {
              thinking += piece
            }
          }
          if let finish = choice["finish_reason"] as? String {
            stop = finish
          }
        }
      }
      if Date().timeIntervalSince(lastReport) > 0.25 {
        lastReport = Date()
        let snapshot = text
        if snapshot.isEmpty, let onThinking = onThinking, !thinking.isEmpty {
          let thought = thinking
          await onThinking(thought)
        } else {
          await onProgress(snapshot)
        }
      }
    }
    if stop == "refusal" {
      throw AIError.refusal
    }
    if stop == "max_tokens" || stop == "length" {
      throw AIError.truncated
    }
    if text.isEmpty {
      throw AIError.empty
    }
    let final = text
    await onProgress(final)
    return final
  }
  
  /// 向提供商查询可用的模型 ID
  static func listModels(_ cfg: AIConfig) async throws -> [String] {
    let path = cfg.provider.style == .anthropic ? "/v1/models?limit=100" : "/models"
    guard !cfg.baseURL.isEmpty, let url = URL(string: trimmedBase(cfg.baseURL) + path) else {
      throw AIError.badURL
    }
    var req = URLRequest(url: url)
    req.timeoutInterval = 30
    if cfg.provider.style == .anthropic {
      req.setValue(cfg.apiKey, forHTTPHeaderField: "x-api-key")
      req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
    } else {
      req.setValue("Bearer \(cfg.apiKey)", forHTTPHeaderField: "Authorization")
    }
    let (data, resp) = try await session.data(for: req)
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 else {
      throw AIError.http(code, errorMessage(json, data))
    }
    let list = json?["data"] as? [[String: Any]] ?? []
    return list.compactMap({ $0["id"] as? String })
  }
}

/// 从模型回复里取出 JSON（容忍前后的说明文字和 ``` 代码块）
func aiExtractJSON(_ text: String) -> Any? {
  guard let start = text.firstIndex(where: { $0 == "{" || $0 == "[" }) else {
    return nil
  }
  let closing = text[start] == "{" ? "}" : "]"
  guard let end = text.range(of: closing, options: .backwards)?.lowerBound, end > start else {
    return nil
  }
  return try? JSONSerialization.jsonObject(with: Data(String(text[start...end]).utf8))
}
