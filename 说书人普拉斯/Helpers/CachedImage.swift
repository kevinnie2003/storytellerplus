//
//  CachedImage.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/21/25.
//

import UIKit

import CryptoKit

/// 图标缓存：内存一份，磁盘一份。下载过的图标一直留在本机，断网也能显示。
final class ImageCache {
  static let shared = ImageCache()
  private let memory = NSCache<NSString, UIImage>()
  private let folder: URL
  private var inFlight = Set<String>()
  private let lock = NSLock()
  
  private init() {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    folder = base.appendingPathComponent("IconCache", isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
  }
  
  private func fileURL(_ urlString: String) -> URL {
    let digest = SHA256.hash(data: Data(urlString.utf8)).map { String(format: "%02x", $0) }.joined()
    return folder.appendingPathComponent(digest)
  }
  
  /// 先查内存，再查磁盘
  func image(for urlString: String) -> UIImage? {
    if let image = memory.object(forKey: urlString as NSString) {
      return image
    }
    if let data = try? Data(contentsOf: fileURL(urlString)), let image = UIImage(data: data) {
      memory.setObject(image, forKey: urlString as NSString)
      return image
    }
    return nil
  }
  
  func store(_ data: Data, image: UIImage, for urlString: String) {
    memory.setObject(image, forKey: urlString as NSString)
    try? data.write(to: fileURL(urlString), options: .atomic)
  }
  
  /// 本机图标缓存占用的字节数和个数
  func diskUsage() -> (bytes: Int64, count: Int) {
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])) ?? []
    var total: Int64 = 0
    for url in files {
      total += Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
    }
    return (total, files.count)
  }
  
  /// 清空本机图标缓存（内存里正在显示的不受影响，下次有网时会重新下载）
  func clearDisk() {
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    for url in files {
      try? FileManager.default.removeItem(at: url)
    }
    memory.removeAllObjects()
  }
  
  /// 下载一个图标并存起来，失败返回 nil（不会清掉已有的缓存）
  func fetch(_ urlString: String) async -> UIImage? {
    if let cached = image(for: urlString) {
      return cached
    }
    guard let url = URL(string: urlString), url.scheme?.hasPrefix("http") == true else {
      return nil
    }
    for attempt in 0..<3 {
      if let (data, response) = try? await URLSession.shared.data(from: url),
         (response as? HTTPURLResponse)?.statusCode ?? 200 < 400,
         let image = UIImage(data: data) {
        store(data, image: image, for: urlString)
        return image
      }
      try? await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_000_000_000)
    }
    return nil
  }
  
  /// 提前把一批图标下载到本机，已经有的跳过
  func prefetch(_ urlStrings: [String]) {
    let todo = Set(urlStrings.filter { !$0.isEmpty })
    for urlString in todo {
      lock.lock()
      let skip = inFlight.contains(urlString) || FileManager.default.fileExists(atPath: fileURL(urlString).path)
      if !skip { inFlight.insert(urlString) }
      lock.unlock()
      if skip { continue }
      Task.detached(priority: .utility) {
        _ = await ImageCache.shared.fetch(urlString)
        ImageCache.shared.lock.lock()
        ImageCache.shared.inFlight.remove(urlString)
        ImageCache.shared.lock.unlock()
      }
    }
  }
}
import SwiftUI
import Combine

class ImageLoader: ObservableObject {
  @Published var image: UIImage?
  private var task: Task<Void, Never>?
  
  init(urlString: String) {
    // 本机有就立刻显示，不等网络
    image = ImageCache.shared.image(for: urlString)
    if image == nil {
      loadImage(from: urlString)
    }
  }

  func loadImage(from urlString: String) {
    task = Task { [weak self] in
      if let downloaded = await ImageCache.shared.fetch(urlString) {
        await MainActor.run {
          self?.image = downloaded
        }
      }
    }
  }
  
  func cancel() {
    task?.cancel()
  }
}


struct CachedImageView: View {
  @ObservedObject private var loader: ImageLoader
  var placeholder: Image

  init(urlString: String, placeholder: Image = Image(systemName: "questionmark.circle")) {
    self.loader = ImageLoader(urlString: urlString)
    self.placeholder = placeholder
  }

  var body: some View {
    Group {
      if let uiImage = loader.image {
        Image(uiImage: uiImage)
          .resizable()
      } else {
        placeholder
          .resizable()
      }
    }
  }
}

