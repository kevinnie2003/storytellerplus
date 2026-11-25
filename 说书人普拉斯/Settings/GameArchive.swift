//
//  GameArchive.swift
//  说书人普拉斯
//
//  游戏存档：每一局开始后都会自动存一份，方便以后载入复盘
//

import Foundation

struct GameArchiveEntry: Identifiable {
  let id: String
  let playName: String
  let playerCount: Int
  let aliveCount: Int
  let alive: [Bool]
  let dayCount: Int
  let gameState: Int
  let savedAt: Date
}

enum GameArchive {
  static var folder: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let url = base.appendingPathComponent("GameArchive", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
  
  private static func fileURL(_ id: String) -> URL {
    folder.appendingPathComponent("\(id).json")
  }
  
  static func save(_ data: GameSaveData) {
    guard let id = data.gameID, data.gameState != 0, let encoded = try? JSONEncoder().encode(data) else {
      return
    }
    try? encoded.write(to: fileURL(id), options: .atomic)
  }
  
  static func load(_ id: String) -> Data? {
    try? Data(contentsOf: fileURL(id))
  }
  
  static func delete(_ id: String) {
    try? FileManager.default.removeItem(at: fileURL(id))
  }
  
  static func list() -> [GameArchiveEntry] {
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
    var entries: [GameArchiveEntry] = []
    for url in files where url.pathExtension == "json" {
      guard let data = try? Data(contentsOf: url), let game = try? JSONDecoder().decode(GameSaveData.self, from: data) else {
        continue
      }
      let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date.distantPast
      entries.append(GameArchiveEntry(
        id: url.deletingPathExtension().lastPathComponent,
        playName: game.playName,
        playerCount: game.playersAssignedCharacters.count,
        aliveCount: game.aliveCount,
        alive: game.playersIsAlive,
        dayCount: game.allLogs.filter({ $0.type == 10 }).count,
        gameState: game.gameState,
        savedAt: modified
      ))
    }
    return entries.sorted(by: { $0.savedAt > $1.savedAt })
  }
}
