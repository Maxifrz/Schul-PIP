import Foundation
import UIKit

/// Presentations as one JSON file each, their pictures in a shared media folder (same layout as on Android).
@MainActor
final class PresentationStore: ObservableObject {
    @Published private(set) var presentations: [Presentation] = []

    private let root: URL
    private let mediaDirectory: URL
    private var pendingWrites: [String: Task<Void, Never>] = [:]
    private let images = NSCache<NSString, UIImage>()

    init(root: URL? = nil) {
        let base = root ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Presentations", isDirectory: true)
        self.root = base
        mediaDirectory = base.appendingPathComponent("media", isDirectory: true)
        try? FileManager.default.createDirectory(at: mediaDirectory, withIntermediateDirectories: true)
        let decoder = JSONDecoder()
        let files = (try? FileManager.default.contentsOfDirectory(at: base, includingPropertiesForKeys: nil)) ?? []
        presentations = files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? decoder.decode(Presentation.self, from: Data(contentsOf: $0)) }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    func presentation(_ id: String) -> Presentation? {
        presentations.first { $0.id == id }
    }

    func add(_ presentation: Presentation) {
        presentations.insert(presentation, at: 0)
        write(presentation, immediately: true)
    }

    /// Keeps the list current right away and writes the file shortly after, so dragging does not hit the disk.
    func update(_ presentation: Presentation) {
        guard let index = presentations.firstIndex(where: { $0.id == presentation.id }) else { return }
        var updated = presentation
        updated.updatedAt = Int64(Date().timeIntervalSince1970 * 1000)
        presentations[index] = updated
        write(updated, immediately: false)
    }

    func delete(_ presentation: Presentation) {
        presentations.removeAll { $0.id == presentation.id }
        pendingWrites.removeValue(forKey: presentation.id)?.cancel()
        try? FileManager.default.removeItem(at: file(presentation.id))
    }

    func duplicate(_ presentation: Presentation) {
        var copy = presentation
        copy.id = UUID().uuidString
        copy.title = "\(presentation.title) (Kopie)"
        copy.createdAt = Int64(Date().timeIntervalSince1970 * 1000)
        copy.updatedAt = copy.createdAt
        add(copy)
    }

    private func file(_ id: String) -> URL {
        root.appendingPathComponent("\(id).json")
    }

    private func write(_ presentation: Presentation, immediately: Bool) {
        pendingWrites.removeValue(forKey: presentation.id)?.cancel()
        let url = file(presentation.id)
        pendingWrites[presentation.id] = Task {
            if !immediately {
                try? await Task.sleep(nanoseconds: 600_000_000)
            }
            guard !Task.isCancelled, let data = try? JSONEncoder().encode(presentation) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }

    // Media

    func mediaURL(_ name: String) -> URL {
        mediaDirectory.appendingPathComponent(name)
    }

    /// Stores a picture and returns its file name for an image element.
    func saveMedia(_ data: Data, fileExtension: String) throws -> String {
        let name = "\(UUID().uuidString).\(fileExtension)"
        try data.write(to: mediaURL(name), options: .atomic)
        return name
    }

    /// Stores a picture under a name chosen by the caller, e.g. from an imported file.
    func saveMedia(_ data: Data, named name: String) throws {
        try data.write(to: mediaURL(name), options: .atomic)
    }

    func mediaData(_ name: String) -> Data? {
        try? Data(contentsOf: mediaURL(name))
    }

    func image(_ name: String) -> UIImage? {
        if let cached = images.object(forKey: name as NSString) { return cached }
        guard let image = UIImage(contentsOfFile: mediaURL(name).path) else { return nil }
        images.setObject(image, forKey: name as NSString)
        return image
    }

    /// All pictures a set of slides uses, for drawing.
    func images(for slides: [Slide]) -> [String: UIImage] {
        var result: [String: UIImage] = [:]
        for slide in slides {
            for element in slide.elements {
                if let name = element.image, result[name] == nil, let image = image(name) { result[name] = image }
            }
        }
        return result
    }
}
