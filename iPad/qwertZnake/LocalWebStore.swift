import Foundation

final class LocalWebStore {
    private let fileManager = FileManager.default
    private let encoderOptions: JSONSerialization.WritingOptions = [.prettyPrinted, .sortedKeys]

    private lazy var dataDirectory: URL = {
        let directory = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("qwertZnakeData", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }()

    func statistics() -> [String: Any] {
        loadDocument(named: "statistics.json", fallback: ["games": []])
    }

    func statisticsGames() -> [[String: Any]] {
        statistics()["games"] as? [[String: Any]] ?? []
    }

    func saveStatistics(_ document: [String: Any]) {
        save(document, named: "statistics.json")
    }

    func levelsDocument() -> [String: Any] {
        loadDocument(named: "levels.json", fallback: ["levels": []])
    }

    func levels() -> [[String: Any]] {
        levelsDocument()["levels"] as? [[String: Any]] ?? []
    }

    func saveLevels(_ document: [String: Any]) {
        save(document, named: "levels.json")
    }

    func appendLogs(from data: Data) -> Int {
        let logs: [Any]
        if
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let parsedLogs = object["logs"] as? [Any]
        {
            logs = parsedLogs
        } else if let string = String(data: data, encoding: .utf8) {
            logs = [["raw": string, "timestamp": ISO8601DateFormatter().string(from: Date())]]
        } else {
            logs = []
        }

        let cappedLogs = Array(logs.prefix(1000))
        let lines = cappedLogs.map { log -> String in
            let value: String
            if let string = log as? String {
                value = string
            } else if JSONSerialization.isValidJSONObject(log),
                      let data = try? JSONSerialization.data(withJSONObject: log),
                      let json = String(data: data, encoding: .utf8) {
                value = json
            } else {
                value = String(describing: log)
            }
            return "\(ISO8601DateFormatter().string(from: Date())) | \(value)\n"
        }.joined()

        let url = dataDirectory.appendingPathComponent("game-logs.txt")
        if !fileManager.fileExists(atPath: url.path) {
            try? "=== Game Logs Started at \(ISO8601DateFormatter().string(from: Date())) ===\n".write(to: url, atomically: true, encoding: .utf8)
        }

        if let data = lines.data(using: .utf8), let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        }

        return cappedLogs.count
    }

    private func loadDocument(named fileName: String, fallback: [String: Any]) -> [String: Any] {
        let writableURL = dataDirectory.appendingPathComponent(fileName)
        if !fileManager.fileExists(atPath: writableURL.path) {
            seed(fileName: fileName, to: writableURL)
        }

        guard
            let data = try? Data(contentsOf: writableURL),
            let document = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return fallback
        }

        return document
    }

    private func save(_ document: [String: Any], named fileName: String) {
        guard JSONSerialization.isValidJSONObject(document),
              let data = try? JSONSerialization.data(withJSONObject: document, options: encoderOptions)
        else {
            return
        }

        try? data.write(to: dataDirectory.appendingPathComponent(fileName), options: .atomic)
    }

    private func seed(fileName: String, to destination: URL) {
        if let bundledURL = Bundle.main.resourceURL?
            .appendingPathComponent("Web")
            .appendingPathComponent(fileName),
           fileManager.fileExists(atPath: bundledURL.path) {
            try? fileManager.copyItem(at: bundledURL, to: destination)
            return
        }

        let fallback: [String: Any] = fileName == "levels.json" ? ["levels": []] : ["games": []]
        save(fallback, named: fileName)
    }
}
