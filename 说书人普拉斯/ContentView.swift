//
//  ContentView.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/18/25.
//

import SwiftUI
import SwiftData
import UniformTypeIdentifiers
struct ContentView: View {
  @Environment(\.colorScheme) private var colorScheme
  //  @Environment(\.modelContext) private var modelContext
  //  @Query private var items: [Item]
  @State private var viewNumber = 0
  @State private var loadLast = false
  @State private var isFileImporterPresented = false
  @State private var jsonArray: [[String: Any]] = []
  @State private var showAIImport = false
  @State private var showAISettings = false
  @State private var showStartChooser = false
  @State private var showArchive = false
  @State private var showTutorial = false
  @AppStorage("tutorial.seen") private var tutorialSeen = false
  
  /// 上一局（“继续上一局”用）的剧本名，没有就是空
  private var lastGameName: String {
    guard let data = UserDefaults.standard.data(forKey: "SavedGameState"),
          let game = try? JSONDecoder().decode(GameSaveData.self, from: data) else {
      return ""
    }
    return game.playName.isEmpty ? "无名剧本" : game.playName
  }
  
  private func openArchive(_ id: String) {
    if let data = GameArchive.load(id) {
      UserDefaults.standard.set(data, forKey: "SavedGameState")
      loadLast = true
      viewNumber = 1
    }
  }
  let startDate = Date() // for the animation effect
  var body: some View {
    
    ZStack{
      // 静止的圆点背景
      Color.white
        .colorEffect(ShaderLibrary.dotPatternShader(
          .float(80),
          .float(1),
          .float(0),
          .float(colorScheme == .dark ? 1 : 0)))
        .edgesIgnoringSafeArea(.all)
      //      Color.mainbg
      //        .edgesIgnoringSafeArea(.all)
      
      ZStack{
        if viewNumber == 0 {
          VStack(spacing: 10){
            Spacer()
            Button(action: { showTutorial = true }) {
              HStack(spacing: 8) {
                Image(systemName: "questionmark.circle.fill")
                Text("新手教程")
              }
              .font(.system(size: 18, weight: .bold, design: .rounded))
              .foregroundColor(.ink)
              .padding(.horizontal, 20)
              .padding(.vertical, 10)
              .background(Capsule().fill(Color.paper))
              .overlay(Capsule().stroke(Color.ink, lineWidth: 2.5))
            }
            .buttonStyle(.plain)
            HStack{
              Text("本产品仍为测试版，遇到任何bug或有需求请大胆联系作者")
            }
          }
          .fullScreenCover(isPresented: $showTutorial) {
            // 新手教程：在演示小镇里一步步圈出真实的按钮
            StoryTellerView(
              currentView: Binding(get: { 1 }, set: { if $0 == 0 { showTutorial = false } }),
              loadLast: .constant(false),
              playJSON: demoScriptJSON(),
              demo: true,
              onDemoFinished: { tutorialSeen = true; showTutorial = false }
            )
            .background(Color.mainbg.ignoresSafeArea())
            .stColorScheme()
          }
          ZStack{
            VStack(spacing: 18){
              Spacer()
              Text("说书人普拉斯")
                .font(.system(size: 52, weight: .black, design: .rounded))
                .padding(.bottom, 26)
              STBigButton(title: "开始游戏", systemImage: "play.fill", filled: true) {
                showStartChooser = true
              }
              .frame(width: 320)
              STBigButton(title: "设置", systemImage: "gearshape.fill") {
                showAISettings = true
              }
              .frame(width: 320)
              .sheet(isPresented: $showAISettings) {
                SettingsView()
              }
              .sheet(isPresented: $showAIImport) {
                AIScriptImportView { items in
                  jsonArray = items
                  loadLast = false
                  viewNumber = 1
                }
              }
              .sheet(isPresented: $showArchive) {
                ArchiveView { id in
                  openArchive(id)
                }
              }
              Spacer()
            }
            if showStartChooser {
              Color.black.opacity(0.25)
                .ignoresSafeArea()
                .onTapGesture { showStartChooser = false }
              StartChooser(
                lastGameName: lastGameName,
                onUploadJSON: {
                  showStartChooser = false
                  isFileImporterPresented = true
                  loadLast = false
                },
                onImageScript: {
                  showStartChooser = false
                  showAIImport = true
                },
                onContinue: {
                  showStartChooser = false
                  loadLast = true
                  viewNumber = 1
                },
                onOpenArchive: {
                  showStartChooser = false
                  showArchive = true
                },
                onClose: { showStartChooser = false }
              )
              .transition(.scale(scale: 0.95).combined(with: .opacity))
            }
          }
          .animation(.easeOut(duration: 0.2), value: showStartChooser)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .transition(.opacity)
            .fileImporter(
              isPresented: $isFileImporterPresented,
              allowedContentTypes: [.json],
              allowsMultipleSelection: false
            ) { result in
              switch result {
              case .success(let urls):
                if let selectedFile = urls.first {
                  readJSON(from: selectedFile)
                }
              case .failure(let error):
                print("Failed to import file: \(error.localizedDescription)")
              }
            }
        }else if viewNumber == 1{
          StoryTellerView(currentView: $viewNumber, loadLast: $loadLast, playJSON: jsonArray)
            .transition(.opacity)
        }
      } // end of inner zstack
      .animation(.easeInOut(duration: 0.5), value: viewNumber)
      
    }// end of the outer zstack
    .stColorScheme()
    
  }
  private func readJSON(from url: URL) {
    guard url.startAccessingSecurityScopedResource() else {
      print("Could not access the security-scoped resource.")
      return
    }
    defer { url.stopAccessingSecurityScopedResource() }
    
    do {
      let data = try Data(contentsOf: url)
      let root = try JSONSerialization.jsonObject(with: data, options: [])
      
      guard let array = root as? [Any] else {
        print("Expected a top-level array.")
        return
      }
      
      let dictionaries = array.compactMap { $0 as? [String: Any] }
      
      if dictionaries.isEmpty {
        print("No dictionary objects found in array.")
      } else {
        print("Loaded \(dictionaries.count) dictionary items (ignored \(array.count - dictionaries.count) non-dictionary items)")
        jsonArray = dictionaries
        viewNumber = 1
      }
      
    } catch {
      print("Failed to read JSON: \(error.localizedDescription)")
    }
  }
  
}

#Preview {
  ContentView()
  //    .modelContainer(for: Item.self, inMemory: true)
}

/// 点“开始游戏”后的选择：开一局新的，或者回到存档
struct StartChooser: View {
  let lastGameName: String
  let onUploadJSON: () -> Void
  let onImageScript: () -> Void
  let onContinue: () -> Void
  let onOpenArchive: () -> Void
  let onClose: () -> Void
  
  var body: some View {
    VStack(alignment: .leading, spacing: 22) {
      HStack {
        Text("开始游戏")
          .font(.system(size: 30, weight: .black, design: .rounded))
        Spacer()
        Button(action: onClose) {
          Image(systemName: "xmark")
            .font(.system(size: 20, weight: .black))
            .foregroundColor(.ink)
            .padding(8)
        }
        .buttonStyle(.plain)
      }
      HStack(alignment: .top, spacing: 22) {
        VStack(alignment: .leading, spacing: 12) {
          Text("新的一局")
            .font(.system(size: 19, weight: .bold, design: .rounded))
            .foregroundColor(.ink.opacity(0.6))
          STBigButton(title: "上传剧本 JSON", systemImage: "doc.fill", filled: true, action: onUploadJSON)
          STBigButton(title: "用图片生成剧本", systemImage: "photo.fill", action: onImageScript)
        }
        Rectangle()
          .fill(Color.ink)
          .frame(width: 3)
        VStack(alignment: .leading, spacing: 12) {
          Text("接着玩")
            .font(.system(size: 19, weight: .bold, design: .rounded))
            .foregroundColor(.ink.opacity(0.6))
          if !lastGameName.isEmpty {
            STBigButton(title: "继续上一局", subtitle: lastGameName, systemImage: "arrow.uturn.backward", filled: true, action: onContinue)
          }
          STBigButton(title: "打开存档", systemImage: "tray.full.fill", action: onOpenArchive)
        }
      }
      .fixedSize(horizontal: false, vertical: true)
    }
    .padding(28)
    .frame(width: 760)
    .background(Color.mainbg)
    .clipShape(RoundedRectangle(cornerRadius: 26))
    .overlay(RoundedRectangle(cornerRadius: 26).stroke(Color.ink, lineWidth: 4))
  }
}

/// 新手教程的演示小镇用官方剧本《暗流涌动》
func demoScriptJSON() -> [[String: Any]] {
  guard let url = Bundle.main.url(forResource: "demo-trouble-brewing", withExtension: "json"),
        let data = try? Data(contentsOf: url),
        let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
    return test_json
  }
  return items
}
