//
//  AIScriptImportView.swift
//  说书人普拉斯
//
//  根据剧本图片生成 JSON
//

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct JSONFileDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.json] }
  var data: Data
  init(data: Data) {
    self.data = data
  }
  init(configuration: ReadConfiguration) throws {
    data = configuration.file.regularFileContents ?? Data()
  }
  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
    FileWrapper(regularFileWithContents: data)
  }
}

/// 把图片缩到模型能接受的大小并转成 JPEG
func aiPrepareImage(_ image: UIImage, maxEdge: CGFloat = 2400) -> Data? {
  let longest = max(image.size.width, image.size.height) * image.scale
  let ratio = longest > maxEdge ? maxEdge / longest : 1
  let target = CGSize(width: image.size.width * image.scale * ratio, height: image.size.height * image.scale * ratio)
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
    image.draw(in: CGRect(origin: .zero, size: target))
  }
  var quality: CGFloat = 0.85
  var data = resized.jpegData(compressionQuality: quality)
  while let d = data, d.count > 3_500_000, quality > 0.4 {
    quality -= 0.15
    data = resized.jpegData(compressionQuality: quality)
  }
  return data
}

/// 剧本条目的整理：补图标、合并 AI 给的改动
enum AIScriptTools {
  static func isCharacter(_ item: [String: Any]) -> Bool {
    let id = item["id"] as? String ?? ""
    let team = item["team"] as? String ?? ""
    return id != "_meta" && !team.contains("jinx")
  }
  
  /// 用官方 id 补上图标链接，返回没有图标的角色名
  static func fillIcons(_ items: inout [[String: Any]]) -> [String] {
    var missing: [String] = []
    for i in items.indices where isCharacter(items[i]) {
      let existing = imageURLString(items[i]["image"])
      let official = (items[i]["officialId"] as? String ?? "").trimmingCharacters(in: .whitespaces).lowercased()
      if existing.isEmpty {
        if !official.isEmpty && official.allSatisfy({ $0.isLetter || $0 == "_" }) {
          items[i]["image"] = "https://oss.gstonegames.com/data_file/clocktower/role_icon/\(official).png"
        } else {
          missing.append(items[i]["name"] as? String ?? "")
        }
      }
      items[i].removeValue(forKey: "officialId")
    }
    return missing
  }
  
  private static func index(of key: String, in items: [[String: Any]]) -> Int? {
    if let i = items.firstIndex(where: { ($0["id"] as? String) == key }) {
      return i
    }
    return items.firstIndex(where: { ($0["name"] as? String) == key })
  }
  
  /// 把 AI 返回的改动合并进剧本，返回实际改动的条数
  static func apply(patch: [String: Any], to items: inout [[String: Any]]) -> Int {
    var count = 0
    for change in (patch["changes"] as? [Any] ?? []).compactMap({ $0 as? [String: Any] }) {
      let key = (change["id"] as? String) ?? (change["name"] as? String) ?? ""
      guard let i = index(of: key, in: items), let fields = change["set"] as? [String: Any] else {
        continue
      }
      for (field, value) in fields {
        items[i][field] = value
      }
      // 换了官方 id 就重新找图标
      if fields["officialId"] != nil && fields["image"] == nil {
        items[i]["image"] = ""
      }
      count += 1
    }
    for key in (patch["remove"] as? [Any] ?? []).compactMap({ $0 as? String }) {
      if let i = index(of: key, in: items), (items[i]["id"] as? String) != "_meta" {
        items.remove(at: i)
        count += 1
      }
    }
    for item in (patch["add"] as? [Any] ?? []).compactMap({ $0 as? [String: Any] }) {
      guard item["id"] is String, item["name"] is String else {
        continue
      }
      let team = item["team"] as? String ?? ""
      if let last = items.lastIndex(where: { ($0["team"] as? String) == team }) {
        items.insert(item, at: last + 1)
      } else {
        items.append(item)
      }
      count += 1
    }
    return count
  }
  
  /// 发给模型看的精简版 JSON（去掉图标链接这类它不需要改的字段）
  static func compactJSON(_ items: [[String: Any]]) -> String {
    let slim = items.map { item -> [String: Any] in
      var copy = item
      copy.removeValue(forKey: "image")
      copy.removeValue(forKey: "edition")
      copy.removeValue(forKey: "logo")
      return copy
    }
    guard let data = try? JSONSerialization.data(withJSONObject: slim, options: [.sortedKeys]) else {
      return "[]"
    }
    return String(data: data, encoding: .utf8) ?? "[]"
  }
}

struct AIScriptImportView: View {
  let onEnter: ([[String: Any]]) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var pickerItem: PhotosPickerItem? = nil
  @State private var image: UIImage? = nil
  @State private var imageJPEG: Data? = nil
  @State private var showFileImporter: Bool = false
  @State private var busy: Bool = false
  @State private var progress: String = ""
  @State private var errorText: String = ""
  @State private var script: [[String: Any]] = []
  @State private var notes: [String] = []
  @State private var missingIcons: [String] = []
  @State private var lastChange: String = ""
  @State private var reply: String = ""
  @State private var showDetails: Bool = false
  @State private var showExporter: Bool = false
  @State private var showSettings: Bool = false
  
  private var scriptName: String {
    let meta = script.first(where: { ($0["id"] as? String) == "_meta" })
    let name = meta?["name"] as? String ?? ""
    return name.isEmpty ? "剧本" : name
  }
  
  private func count(_ team: String) -> Int {
    script.filter({ ($0["team"] as? String) == team }).count
  }
  
  private var countsLine: String {
    var parts = ["镇民 \(count("townsfolk"))", "外来者 \(count("outsider"))", "爪牙 \(count("minion"))", "恶魔 \(count("demon"))"]
    if count("fabled") > 0 {
      parts.append("传奇 \(count("fabled"))")
    }
    return parts.joined(separator: " · ")
  }
  
  private func nightOrder(_ key: String) -> String {
    let acting = script.compactMap { item -> (Double, String)? in
      let value = (item[key] as? Double) ?? (item[key] as? Int).map(Double.init) ?? 0
      guard value > 0, let name = item["name"] as? String else { return nil }
      return (value, name)
    }
    let names = acting.sorted(by: { $0.0 < $1.0 }).map({ $0.1 })
    return names.isEmpty ? "无" : names.joined(separator: " → ")
  }
  
  private var exportData: Data {
    (try? JSONSerialization.data(withJSONObject: script, options: [.prettyPrinted])) ?? Data()
  }
  
  private func setImage(_ picked: UIImage) {
    image = picked
    imageJPEG = nil
    script = []
    notes = []
    missingIcons = []
    lastChange = ""
    errorText = ""
  }
  
  private func generate() {
    guard let image = image, let jpeg = aiPrepareImage(image) else {
      errorText = "请先选择一张剧本图片。"
      return
    }
    imageJPEG = jpeg
    busy = true
    errorText = ""
    progress = "正在读图…"
    script = []
    notes = []
    lastChange = ""
    Task {
      do {
        let reply = try await AIClient.sendStreaming(
          system: AIPrompts.scriptImportSystem,
          messages: [AIChatMessage(role: "user", text: AIPrompts.scriptImportUser(extra: ""))],
          imageJPEG: jpeg, maxTokens: 32000, effort: "low"
        ) { partial in
          let found = partial.components(separatedBy: "\"ability\"").count - 1
          progress = found > 0 ? "已写出 \(found) 个角色…" : "正在读图…"
        }
        let parsed = aiExtractJSON(reply)
        var items: [[String: Any]] = []
        var parsedNotes: [String] = []
        if let object = parsed as? [String: Any] {
          items = (object["script"] as? [Any] ?? []).compactMap({ $0 as? [String: Any] })
          parsedNotes = (object["notes"] as? [Any] ?? []).compactMap({ $0 as? String })
        } else if let array = parsed as? [Any] {
          items = array.compactMap({ $0 as? [String: Any] })
        }
        if items.filter({ AIScriptTools.isCharacter($0) }).isEmpty {
          throw AIError.badFormat("没有读出任何角色，请换一张更清晰的图片或换一个模型。")
        }
        missingIcons = AIScriptTools.fillIcons(&items)
        script = items
        notes = Array(parsedNotes.prefix(5))
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
      progress = ""
    }
  }
  
  private func refine() {
    let instruction = reply.trimmingCharacters(in: .whitespacesAndNewlines)
    if instruction.isEmpty || busy || script.isEmpty {
      return
    }
    busy = true
    errorText = ""
    progress = "正在修改…"
    let current = script
    let pending = notes
    Task {
      do {
        let answer = try await AIClient.sendStreaming(
          system: AIPrompts.scriptRefineSystem,
          messages: [AIChatMessage(role: "user", text: AIPrompts.scriptRefineUser(scriptJSON: AIScriptTools.compactJSON(current), notes: pending, instruction: instruction))],
          imageJPEG: imageJPEG, maxTokens: 16000, effort: "low"
        ) { _ in }
        guard let patch = aiExtractJSON(answer) as? [String: Any] else {
          throw AIError.badFormat("不是 JSON")
        }
        var items = current
        let changed = AIScriptTools.apply(patch: patch, to: &items)
        missingIcons = AIScriptTools.fillIcons(&items)
        script = items
        notes = Array((patch["notes"] as? [Any] ?? []).compactMap({ $0 as? String }).prefix(5))
        let summary = patch["summary"] as? String ?? ""
        lastChange = summary.isEmpty ? "改了 \(changed) 处" : summary
        reply = ""
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
      progress = ""
    }
  }
  
  var body: some View {
    VStack(spacing: 14) {
      AIPanelHeader(title: "图片生成剧本", showSettings: $showSettings, onClose: { dismiss() })
      HStack(alignment: .top, spacing: 20) {
        VStack(spacing: 12) {
          ZStack {
            RoundedRectangle(cornerRadius: 14)
              .fill(Color.goodTextBg)
              .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black, lineWidth: 3))
            if let image = image {
              Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .padding(6)
            } else {
              Text("选择一张剧本图片")
                .font(.system(size: 18, design: .rounded))
                .foregroundColor(.secondary)
            }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          HStack(spacing: 12) {
            PhotosPicker(selection: $pickerItem, matching: .images) {
              AIPillLabel(text: "从相册选")
            }
            Button(action: { showFileImporter = true }) {
              AIPillLabel(text: "从文件选")
            }
            .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.image], allowsMultipleSelection: false) { result in
              if case .success(let urls) = result, let url = urls.first {
                let scoped = url.startAccessingSecurityScopedResource()
                defer {
                  if scoped {
                    url.stopAccessingSecurityScopedResource()
                  }
                }
                if let data = try? Data(contentsOf: url), let picked = UIImage(data: data) {
                  setImage(picked)
                }
              }
            }
          }
        }
        .frame(maxWidth: .infinity)
        VStack(alignment: .leading, spacing: 12) {
          HStack(spacing: 12) {
            Button(action: generate) {
              AIPillLabel(text: script.isEmpty ? "生成剧本" : "整份重新生成", filled: script.isEmpty)
            }
            .disabled(busy || image == nil)
            if busy {
              ProgressView()
              Text(progress)
                .font(.system(size: 16, weight: .semibold, design: .rounded))
            }
          }
          if !errorText.isEmpty {
            Text(errorText)
              .font(.system(size: 15, design: .rounded))
              .foregroundColor(.red)
          }
          if !script.isEmpty {
            ScrollView {
              VStack(alignment: .leading, spacing: 8) {
                Text(scriptName)
                  .font(.system(size: 20, weight: .black, design: .rounded))
                Text(countsLine)
                  .font(.system(size: 15, weight: .semibold, design: .rounded))
                  .foregroundColor(.secondary)
                if !lastChange.isEmpty {
                  Text("已修改：\(lastChange)")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundColor(.green)
                }
                if notes.isEmpty {
                  Text("没有需要确认的地方。")
                    .font(.system(size: 16, design: .rounded))
                    .padding(.top, 4)
                } else {
                  Text("需要你确认（点一下可以直接回复）")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .padding(.top, 4)
                  ForEach(notes.indices, id: \.self) { i in
                    Button(action: {
                      reply = "关于“\(notes[i])”："
                    }) {
                      Text("\(i + 1). \(notes[i])")
                        .font(.system(size: 16, design: .rounded))
                        .foregroundColor(.black)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(Color.goodTextBg)
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.black, lineWidth: 2))
                    }
                  }
                }
                Button(action: { showDetails.toggle() }) {
                  HStack(spacing: 4) {
                    Image(systemName: showDetails ? "chevron.down" : "chevron.right")
                    Text("夜晚顺序和图标")
                  }
                  .font(.system(size: 15, weight: .semibold, design: .rounded))
                  .foregroundColor(.secondary)
                }
                .padding(.top, 4)
                if showDetails {
                  Text("首夜：\(nightOrder("firstNight"))")
                    .font(.system(size: 15, design: .rounded))
                  Text("其他夜晚：\(nightOrder("otherNight"))")
                    .font(.system(size: 15, design: .rounded))
                  Text(missingIcons.isEmpty ? "所有角色都有图标。" : "没有图标：\(missingIcons.joined(separator: "、"))")
                    .font(.system(size: 15, design: .rounded))
                }
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack {
              TextField("回复 AI 或者提修改，比如：作者是某某；把第二个爪牙的能力改成…", text: $reply, axis: .vertical)
                .lineLimit(1...3)
                .font(.system(size: 16, design: .rounded))
                .padding(10)
                .background(Color.goodTextBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
                .onSubmit {
                  refine()
                }
              Button(action: refine) {
                AIPillLabel(text: "修改")
              }
              .disabled(busy || reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            HStack(spacing: 12) {
              Button(action: {
                let items = script
                dismiss()
                onEnter(items)
              }) {
                AIPillLabel(text: "进入小镇", filled: true)
              }
              .disabled(busy)
              Button(action: { showExporter = true }) {
                AIPillLabel(text: "保存 JSON")
              }
              .disabled(busy)
              .fileExporter(isPresented: $showExporter, document: JSONFileDocument(data: exportData), contentType: .json, defaultFilename: scriptName) { _ in }
            }
          } else {
            Spacer()
          }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
      }
    }
    .padding(20)
    .background(Color.mainbg.ignoresSafeArea())
    .preferredColorScheme(.light)
    .aiPanelSizing()
    .onChange(of: pickerItem) { _, newItem in
      guard let newItem = newItem else { return }
      Task {
        if let data = try? await newItem.loadTransferable(type: Data.self), let picked = UIImage(data: data) {
          setImage(picked)
        }
      }
    }
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}
