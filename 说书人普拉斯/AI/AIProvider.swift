//
//  AIProvider.swift
//  说书人普拉斯
//
//  AI 提供商、设置和密钥存储
//

import Foundation
import Security
import SwiftUI

enum AIAPIStyle {
  case anthropic // Claude 的 Messages API
  case openAI    // OpenAI 兼容的 Chat Completions API
}

struct AIProvider: Identifiable, Hashable {
  let id: String
  let name: String
  let style: AIAPIStyle
  let defaultBaseURL: String
  let defaultModels: [String]
  var usesMaxCompletionTokens: Bool = false
  var note: String = ""
}

let aiProviders: [AIProvider] = [
  AIProvider(id: "anthropic", name: "Claude (Anthropic)", style: .anthropic,
             defaultBaseURL: "https://api.anthropic.com",
             defaultModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"],
             note: "支持图片。在 platform.claude.com 创建 API Key。"),
  AIProvider(id: "deepseek", name: "DeepSeek", style: .openAI,
             defaultBaseURL: "https://api.deepseek.com",
             defaultModels: ["deepseek-v4-pro", "deepseek-flash"],
             note: "在 platform.deepseek.com 创建 API Key。"),
  AIProvider(id: "openai", name: "OpenAI", style: .openAI,
             defaultBaseURL: "https://api.openai.com/v1",
             defaultModels: [], usesMaxCompletionTokens: true,
             note: "填好 Key 后点“获取模型列表”选择模型。"),
  AIProvider(id: "gemini", name: "Gemini (Google)", style: .openAI,
             defaultBaseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
             defaultModels: [],
             note: "使用 Google 的 OpenAI 兼容接口。填好 Key 后点“获取模型列表”。"),
  AIProvider(id: "qwen", name: "通义千问 (阿里云百炼)", style: .openAI,
             defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
             defaultModels: [],
             note: "填好 Key 后点“获取模型列表”选择模型。"),
  AIProvider(id: "moonshot", name: "Kimi (月之暗面)", style: .openAI,
             defaultBaseURL: "https://api.moonshot.cn/v1",
             defaultModels: [],
             note: "填好 Key 后点“获取模型列表”选择模型。"),
  AIProvider(id: "zhipu", name: "智谱 GLM", style: .openAI,
             defaultBaseURL: "https://open.bigmodel.cn/api/paas/v4",
             defaultModels: [],
             note: "填好 Key 后手动填写模型 ID。"),
  AIProvider(id: "openrouter", name: "OpenRouter", style: .openAI,
             defaultBaseURL: "https://openrouter.ai/api/v1",
             defaultModels: [],
             note: "可以用一个 Key 访问多家模型。"),
  AIProvider(id: "custom", name: "自定义 (OpenAI 兼容)", style: .openAI,
             defaultBaseURL: "",
             defaultModels: [],
             note: "任何兼容 OpenAI Chat Completions 的服务，自己填接口地址和模型 ID。"),
]

// API Key 只存在本机钥匙串里
enum AIKeychain {
  static let service = "storytellerplus.ai"
  
  static func read(_ account: String) -> String {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var out: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else {
      return ""
    }
    return String(data: data, encoding: .utf8) ?? ""
  }
  
  @discardableResult
  static func write(_ account: String, _ value: String) -> Bool {
    let base: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account
    ]
    SecItemDelete(base as CFDictionary)
    if value.isEmpty {
      return true
    }
    var add = base
    add[kSecValueData as String] = Data(value.utf8)
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
  }
}

struct AIConfig {
  var provider: AIProvider
  var baseURL: String
  var apiKey: String
  var model: String
}

final class AISettings: ObservableObject {
  static let shared = AISettings()
  private let defaults = UserDefaults.standard
  
  @Published var providerID: String {
    didSet { defaults.set(providerID, forKey: "ai.providerID") }
  }
  
  private init() {
    providerID = UserDefaults.standard.string(forKey: "ai.providerID") ?? "anthropic"
  }
  
  var provider: AIProvider {
    aiProviders.first(where: { $0.id == providerID }) ?? aiProviders[0]
  }
  
  func model(_ p: AIProvider) -> String {
    let saved = defaults.string(forKey: "ai.model.\(p.id)") ?? ""
    return saved.isEmpty ? (p.defaultModels.first ?? "") : saved
  }
  
  func setModel(_ value: String, _ p: AIProvider) {
    defaults.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "ai.model.\(p.id)")
    objectWillChange.send()
  }
  
  func baseURL(_ p: AIProvider) -> String {
    let saved = defaults.string(forKey: "ai.baseURL.\(p.id)") ?? ""
    return saved.isEmpty ? p.defaultBaseURL : saved
  }
  
  func setBaseURL(_ value: String, _ p: AIProvider) {
    defaults.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "ai.baseURL.\(p.id)")
    objectWillChange.send()
  }
  
  func apiKey(_ p: AIProvider) -> String {
    AIKeychain.read(p.id)
  }
  
  @discardableResult
  func setAPIKey(_ value: String, _ p: AIProvider) -> Bool {
    let ok = AIKeychain.write(p.id, value.trimmingCharacters(in: .whitespacesAndNewlines))
    objectWillChange.send()
    return ok
  }
  
  var config: AIConfig {
    let p = provider
    return AIConfig(provider: p, baseURL: baseURL(p), apiKey: apiKey(p), model: model(p))
  }
  
  var isConfigured: Bool {
    let c = config
    return !c.apiKey.isEmpty && !c.model.isEmpty && !c.baseURL.isEmpty
  }
}
