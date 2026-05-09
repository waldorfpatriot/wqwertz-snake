import Foundation

final class AnalyticsBuilder {
    private let isoFormatter = ISO8601DateFormatter()

    func build(from games: [[String: Any]]) -> [String: Any] {
        let records = games.enumerated().map { normalize(record: $0.element, index: $0.offset) }
            .sorted { ($0["timestampMs"] as? Double ?? 0) < ($1["timestampMs"] as? Double ?? 0) }

        var totals = bucket()
        var byGame: [String: [String: Any]] = [:]
        var bySource: [String: [String: Any]] = [:]
        var bySourceGame: [String: [String: Any]] = [:]
        var dailyOverall: [String: [String: Any]] = [:]
        var dailyByGame: [String: [String: [String: Any]]] = [:]

        for record in records {
            add(record, to: &totals)

            let game = record["game"] as? String ?? "qwertZnake"
            let source = record["source"] as? String ?? "iPad"
            let date = record["date"] as? String ?? "unknown"
            let sourceGameKey = source + "\u{0}" + game

            ensureBucket(&byGame, key: game, seed: ["game": game])
            add(record, to: &byGame[game]!)

            ensureBucket(&bySource, key: source, seed: ["source": source])
            add(record, to: &bySource[source]!)

            ensureBucket(&bySourceGame, key: sourceGameKey, seed: ["source": source, "game": game])
            add(record, to: &bySourceGame[sourceGameKey]!)

            ensureBucket(&dailyOverall, key: date, seed: ["date": date])
            add(record, to: &dailyOverall[date]!)

            if dailyByGame[game] == nil {
                dailyByGame[game] = [:]
            }
            ensureBucket(&dailyByGame[game]!, key: date, seed: ["date": date, "game": game])
            add(record, to: &dailyByGame[game]![date]!)
        }

        var dailyByGameObject: [String: Any] = [:]
        for game in dailyByGame.keys.sorted() {
            dailyByGameObject[game] = dailyByGame[game]!.values
                .map(finalize)
                .sorted { String(describing: $0["date"] ?? "") < String(describing: $1["date"] ?? "") }
        }

        return [
            "generatedAt": isoFormatter.string(from: Date()),
            "totals": finalize(totals),
            "byGame": byGame.values.map(finalize).sorted { double($0["durationSeconds"]) > double($1["durationSeconds"]) },
            "bySource": bySource.values.map(finalize).sorted { double($0["durationSeconds"]) > double($1["durationSeconds"]) },
            "bySourceGame": bySourceGame.values.map(finalize).sorted { double($0["durationSeconds"]) > double($1["durationSeconds"]) },
            "series": [
                "overall": dailyOverall.values.map(finalize).sorted { String(describing: $0["date"] ?? "") < String(describing: $1["date"] ?? "") },
                "byGame": dailyByGameObject
            ],
            "records": Array(records.sorted { double($0["timestampMs"]) > double($1["timestampMs"]) }.prefix(250))
        ]
    }

    private func normalize(record: [String: Any], index: Int) -> [String: Any] {
        let timestamp = clean(record["timestamp"] as? String, fallback: "")
        let dateValue = timestamp.isEmpty ? nil : isoFormatter.date(from: timestamp)
        let timestampMs = dateValue?.timeIntervalSince1970 ?? 0
        let duration = max(0, Int(double(record["duration"])))
        let accuracy: Any = record["accuracy"] == nil ? NSNull() : roundMetric(double(record["accuracy"]))
        let wpm: Any = record["wpm"] == nil ? NSNull() : Int(max(0, double(record["wpm"])))
        let lines: Any = record["lines"] == nil ? NSNull() : Int(max(0, double(record["lines"])))

        return [
            "id": record["id"] ?? index + 1,
            "timestamp": dateValue == nil ? NSNull() : isoFormatter.string(from: dateValue!),
            "timestampMs": timestampMs,
            "date": dateValue.map { String(isoFormatter.string(from: $0).prefix(10)) } ?? "unknown",
            "player": clean(record["name"] as? String, fallback: "Anonym"),
            "game": inferGame(record),
            "source": clean(record["source"] as? String, fallback: "iPad"),
            "points": Int(max(0, double(record["points"]))),
            "kpm": Int(max(0, double(record["kpm"]))),
            "accuracy": accuracy,
            "wpm": wpm,
            "level": Int(max(0, double(record["level"]))),
            "lines": lines,
            "durationSeconds": duration,
            "durationMinutes": roundMetric(Double(duration) / 60),
            "difficulty": clean(record["difficulty"] as? String, fallback: "medium"),
            "gridSize": clean(record["gridSize"] as? String, fallback: "medium"),
            "fingersUsed": record["fingersUsed"] as? [String: Any] ?? [:]
        ]
    }

    private func bucket(seed: [String: Any] = [:]) -> [String: Any] {
        var result = seed
        result["sessions"] = 0
        result["durationSeconds"] = 0
        result["points"] = 0
        result["bestPoints"] = 0
        result["bestKpm"] = 0
        result["bestAccuracy"] = NSNull()
        result["bestWpm"] = 0
        result["kpmTotal"] = 0.0
        result["accuracyTotal"] = 0.0
        result["accuracyCount"] = 0
        result["wpmTotal"] = 0.0
        result["wpmCount"] = 0
        result["firstPlayedAt"] = NSNull()
        result["lastPlayedAt"] = NSNull()
        result["players"] = Set<String>()
        return result
    }

    private func ensureBucket(_ buckets: inout [String: [String: Any]], key: String, seed: [String: Any]) {
        if buckets[key] == nil {
            buckets[key] = bucket(seed: seed)
        }
    }

    private func add(_ record: [String: Any], to bucket: inout [String: Any]) {
        bucket["sessions"] = int(bucket["sessions"]) + 1
        bucket["durationSeconds"] = int(bucket["durationSeconds"]) + int(record["durationSeconds"])
        bucket["points"] = int(bucket["points"]) + int(record["points"])
        bucket["bestPoints"] = max(int(bucket["bestPoints"]), int(record["points"]))
        bucket["bestKpm"] = max(int(bucket["bestKpm"]), int(record["kpm"]))
        bucket["kpmTotal"] = double(bucket["kpmTotal"]) + double(record["kpm"])

        if !(record["accuracy"] is NSNull) {
            let accuracy = double(record["accuracy"])
            if bucket["bestAccuracy"] is NSNull {
                bucket["bestAccuracy"] = accuracy
            } else {
                bucket["bestAccuracy"] = max(double(bucket["bestAccuracy"]), accuracy)
            }
            bucket["accuracyTotal"] = double(bucket["accuracyTotal"]) + accuracy
            bucket["accuracyCount"] = int(bucket["accuracyCount"]) + 1
        }

        if !(record["wpm"] is NSNull) {
            bucket["bestWpm"] = max(int(bucket["bestWpm"]), int(record["wpm"]))
            bucket["wpmTotal"] = double(bucket["wpmTotal"]) + double(record["wpm"])
            bucket["wpmCount"] = int(bucket["wpmCount"]) + 1
        }

        if let timestamp = record["timestamp"] as? String, !timestamp.isEmpty {
            if bucket["firstPlayedAt"] is NSNull || timestamp < (bucket["firstPlayedAt"] as? String ?? "") {
                bucket["firstPlayedAt"] = timestamp
            }
            if bucket["lastPlayedAt"] is NSNull || timestamp > (bucket["lastPlayedAt"] as? String ?? "") {
                bucket["lastPlayedAt"] = timestamp
            }
        }

        var players = bucket["players"] as? Set<String> ?? []
        players.insert(record["player"] as? String ?? "Anonym")
        bucket["players"] = players
    }

    private func finalize(_ bucket: [String: Any]) -> [String: Any] {
        let sessions = int(bucket["sessions"])
        var result = bucket
        result["durationMinutes"] = roundMetric(double(bucket["durationSeconds"]) / 60)
        result["averageDurationSeconds"] = sessions > 0 ? roundMetric(double(bucket["durationSeconds"]) / Double(sessions)) : 0
        result["averagePoints"] = sessions > 0 ? roundMetric(double(bucket["points"]) / Double(sessions)) : 0
        result["averageKpm"] = sessions > 0 ? roundMetric(double(bucket["kpmTotal"]) / Double(sessions)) : 0
        result["averageAccuracy"] = int(bucket["accuracyCount"]) > 0 ? roundMetric(double(bucket["accuracyTotal"]) / Double(int(bucket["accuracyCount"]))) : NSNull()
        result["averageWpm"] = int(bucket["wpmCount"]) > 0 ? roundMetric(double(bucket["wpmTotal"]) / Double(int(bucket["wpmCount"]))) : NSNull()
        result["uniquePlayers"] = (bucket["players"] as? Set<String>)?.count ?? 0
        result.removeValue(forKey: "kpmTotal")
        result.removeValue(forKey: "accuracyTotal")
        result.removeValue(forKey: "accuracyCount")
        result.removeValue(forKey: "wpmTotal")
        result.removeValue(forKey: "wpmCount")
        result.removeValue(forKey: "players")
        return result
    }

    private func inferGame(_ record: [String: Any]) -> String {
        let explicit = clean(record["game"] as? String, fallback: "")
        if !explicit.isEmpty { return explicit }

        let source = clean(record["source"] as? String, fallback: "").lowercased()
        if source.contains("tetris") || source.contains("qwertzis") { return "qwertzis" }
        if source.contains("pong") { return "qwertzPong" }
        if source.contains("breakout") { return "qwertz Breakout" }
        if source.contains("invaders") { return "qwertz Invaders" }
        if source.contains("snake") || source.contains("znake") || source.contains("index") { return "qwertZnake" }
        if record["lines"] != nil { return "qwertzis" }
        if record["rally"] != nil || record["winner"] != nil { return "qwertzPong" }
        return "qwertZnake"
    }

    private func clean(_ value: String?, fallback: String) -> String {
        let cleaned = (value ?? fallback)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "<", with: "")
            .replacingOccurrences(of: ">", with: "")
        return cleaned.isEmpty ? fallback : cleaned
    }

    private func roundMetric(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    private func int(_ value: Any?) -> Int {
        Int(double(value))
    }

    private func double(_ value: Any?) -> Double {
        if let value = value as? NSNumber { return value.doubleValue }
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        if let value = value as? String { return Double(value) ?? 0 }
        return 0
    }
}
