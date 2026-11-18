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

struct AIScriptImportView: View {
  let onEnter: ([[String: Any]]) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var pickerItem: PhotosPickerItem? = nil
  @State private var image: UIImage? = nil
  @State private var showFileImporter: Bool = false
  @State private var extra: String = ""
  @State private var busy: Bool = false
  @State private var errorText: String = ""
  @State private var script: [[String: Any]] = []
  @State private var notes: [String] = []
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
  
  private func generate() {
    guard let image = image, let jpeg = aiPrepareImage(image) else {
      errorText = "请先选择一张剧本图片。"
      return
    }
    busy = true
    errorText = ""
    script = []
    notes = []
    Task {
      do {
        let reply = try await AIClient.send(system: AIPrompts.scriptImportSystem,
                                            messages: [AIChatMessage(role: "user", text: AIPrompts.scriptImportUser(extra: extra))],
                                            imageJPEG: jpeg, maxTokens: 32000)
        let parsed = aiExtractJSON(reply)
        var items: [[String: Any]] = []
        var parsedNotes: [String] = []
        if let object = parsed as? [String: Any] {
          items = (object["script"] as? [Any] ?? []).compactMap({ $0 as? [String: Any] })
          parsedNotes = (object["notes"] as? [Any] ?? []).compactMap({ $0 as? String })
        } else if let array = parsed as? [Any] {
          items = array.compactMap({ $0 as? [String: Any] })
        }
        if items.filter({ ($0["id"] as? String) != "_meta" }).isEmpty {
          throw AIError.badFormat("没有读出任何角色，请换一张更清晰的图片或换一个模型。")
        }
        // 用官方 id 补上图标链接
        var missingIcons: [String] = []
        for i in items.indices {
          let id = items[i]["id"] as? String ?? ""
          let team = items[i]["team"] as? String ?? ""
          if id == "_meta" || team.contains("jinx") {
            continue
          }
          let existing = items[i]["image"] as? String ?? ""
          let official = (items[i]["officialId"] as? String ?? "").trimmingCharacters(in: .whitespaces).lowercased()
          if existing.isEmpty {
            if !official.isEmpty && official.allSatisfy({ $0.isLetter || $0 == "_" }) {
              items[i]["image"] = "https://oss.gstonegames.com/data_file/clocktower/role_icon/\(official).png"
            } else {
              missingIcons.append(items[i]["name"] as? String ?? id)
            }
          }
          items[i].removeValue(forKey: "officialId")
        }
        if !missingIcons.isEmpty {
          parsedNotes.append("没有图标的角色：\(missingIcons.joined(separator: "、"))")
        }
        script = items
        notes = parsedNotes
      } catch {
        errorText = error.localizedDescription
      }
      busy = false
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
                  image = picked
                  script = []
                  notes = []
                }
              }
            }
          }
        }
        .frame(maxWidth: .infinity)
        VStack(alignment: .leading, spacing: 12) {
          TextField("补充说明（可不填），比如：作者是某某", text: $extra, axis: .vertical)
            .lineLimit(1...3)
            .font(.system(size: 16, design: .rounded))
            .padding(10)
            .background(Color.goodTextBg)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black, lineWidth: 2))
          Button(action: generate) {
            AIPillLabel(text: busy ? "识别中，大约一两分钟…" : (script.isEmpty ? "生成 JSON" : "重新生成"), filled: true)
          }
          .disabled(busy || image == nil)
          if busy {
            ProgressView()
          }
          if !errorText.isEmpty {
            Text(errorText)
              .font(.system(size: 15, design: .rounded))
              .foregroundColor(.red)
          }
          if !script.isEmpty {
            ScrollView {
              VStack(alignment: .leading, spacing: 8) {
                Text("\(scriptName)")
                  .font(.system(size: 20, weight: .black, design: .rounded))
                Text("镇民 \(count("townsfolk"))，外来者 \(count("outsider"))，爪牙 \(count("minion"))，恶魔 \(count("demon"))，传奇 \(count("fabled"))")
                  .font(.system(size: 16, weight: .semibold, design: .rounded))
                Text("首夜：\(nightOrder("firstNight"))")
                  .font(.system(size: 15, design: .rounded))
                Text("其他夜晚：\(nightOrder("otherNight"))")
                  .font(.system(size: 15, design: .rounded))
                if !notes.isEmpty {
                  Text("需要核对：")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .padding(.top, 4)
                  ForEach(notes.indices, id: \.self) { i in
                    Text("\(i + 1). \(notes[i])")
                      .font(.system(size: 15, design: .rounded))
                  }
                }
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 12) {
              Button(action: {
                let items = script
                dismiss()
                onEnter(items)
              }) {
                AIPillLabel(text: "进入小镇", filled: true)
              }
              Button(action: { showExporter = true }) {
                AIPillLabel(text: "保存 JSON")
              }
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
          image = picked
          script = []
          notes = []
        }
      }
    }
    .sheet(isPresented: $showSettings) {
      AISettingsView()
    }
  }
}
