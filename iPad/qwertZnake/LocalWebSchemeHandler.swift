import Foundation
import WebKit

final class LocalWebSchemeHandler: NSObject, WKURLSchemeHandler {
    private let backend = LocalWebBackend()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let response = backend.handle(urlSchemeTask.request)
        let httpResponse = HTTPURLResponse(
            url: urlSchemeTask.request.url ?? URL(string: "qwertznake://local/")!,
            statusCode: response.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: response.headers
        )!

        urlSchemeTask.didReceive(httpResponse)
        urlSchemeTask.didReceive(response.body)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

struct LocalWebResponse {
    var statusCode: Int
    var headers: [String: String]
    var body: Data
}

final class LocalWebBackend {
    private let store = LocalWebStore()
    private let adminPassword = "Znake"
    private let maximumBodySize = 1_048_576
    private let levelGridSizes = ["small": 20, "medium": 30, "big": 40]
    private let defaultLevelGridSize = "big"

    func handle(_ request: URLRequest) -> LocalWebResponse {
        guard let url = request.url else {
            return json(["error": "Bad request"], status: 400)
        }

        let method = request.httpMethod?.uppercased() ?? "GET"
        let path = normalizedPath(url.path)

        if method == "OPTIONS" {
            return text("", status: 200, contentType: "text/plain")
        }

        switch (method, path) {
        case ("GET", "/api/statistics"):
            return json(store.statisticsGames().map { withDefaultDifficulty($0) })
        case ("POST", "/api/statistics"):
            return saveStatistics(request)
        case ("GET", "/api/levels"):
            return json(store.levels())
        case ("POST", "/api/levels"):
            return saveLevel(request)
        case ("POST", "/api/verify-password"):
            return verifyPassword(request)
        case ("GET", "/api/analytics"):
            return analytics(request)
        case ("POST", "/api/logs"):
            return saveLogs(request)
        default:
            if method == "DELETE", path.hasPrefix("/api/levels/") {
                return deleteLevel(path)
            }
            if method == "PUT", path.hasPrefix("/api/levels/") {
                return updateLevel(path, request)
            }
            return staticFile(path)
        }
    }

    private func saveStatistics(_ request: URLRequest) -> LocalWebResponse {
        guard let gameData = jsonObject(from: request) else {
            return json(["error": "Invalid JSON"], status: 400)
        }

        guard let name = gameData["name"] as? String, name.count <= 50 else {
            return json(["error": "Invalid name"], status: 400)
        }
        guard let points = number(gameData["points"]), points >= 0, points <= 10_000 else {
            return json(["error": "Invalid points"], status: 400)
        }
        guard let kpm = number(gameData["kpm"]), kpm >= 0, kpm <= 1_000 else {
            return json(["error": "Invalid kpm"], status: 400)
        }

        var stats = store.statistics()
        var games = stats["games"] as? [[String: Any]] ?? []
        let id = Int(Date().timeIntervalSince1970 * 1000)
        let source = cleanText(gameData["source"] as? String, fallback: "iPad", maxLength: 80)
        let game = cleanText(gameData["game"] as? String, fallback: inferGame(source: source, payload: gameData), maxLength: 50)

        let record: [String: Any] = [
            "id": id,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "name": cleanText(name, fallback: "Anonym", maxLength: 50),
            "points": Int(points.rounded(.down)),
            "kpm": Int(kpm.rounded(.down)),
            "accuracy": rounded(gameData["accuracy"] as? NSNumber, defaultValue: 100),
            "wpm": Int(number(gameData["wpm"])?.rounded(.down) ?? 0),
            "level": Int(number(gameData["level"])?.rounded(.down) ?? 0),
            "duration": Int(number(gameData["duration"])?.rounded(.down) ?? 0),
            "fingersUsed": gameData["fingersUsed"] as? [String: Any] ?? [:],
            "difficulty": allowed(gameData["difficulty"] as? String, values: ["simple", "medium", "hard", "ultra"], fallback: "medium"),
            "gridSize": allowed(gameData["gridSize"] as? String, values: ["small", "medium", "big"], fallback: "medium"),
            "game": game,
            "source": source
        ]

        games.append(record)
        games.sort { number($0["points"]) ?? 0 > number($1["points"]) ?? 0 }
        stats["games"] = Array(games.prefix(1000))
        store.saveStatistics(stats)

        return json(["success": true, "id": id], status: 201)
    }

    private func saveLevel(_ request: URLRequest) -> LocalWebResponse {
        guard let levelData = jsonObject(from: request) else {
            return json(["error": "Invalid JSON"], status: 400)
        }
        guard let name = levelData["name"] as? String, !name.isEmpty, name.count <= 50 else {
            return json(["error": "Invalid level name"], status: 400)
        }
        let gridSize = allowed(levelData["gridSize"] as? String, values: Array(levelGridSizes.keys), fallback: defaultLevelGridSize)
        let gridDimension = levelGridSizes[gridSize] ?? levelGridSizes[defaultLevelGridSize]!
        guard let barriers = levelData["barriers"] as? [[String: Any]], barriers.count <= gridDimension * gridDimension else {
            return json(["error": "Invalid barriers"], status: 400)
        }

        let normalizedBarriers = barriers.compactMap { barrier -> [String: Int]? in
            guard let x = number(barrier["x"]), let y = number(barrier["y"]) else { return nil }
            let xi = Int(x.rounded(.down))
            let yi = Int(y.rounded(.down))
            guard xi >= 0, xi < gridDimension, yi >= 0, yi < gridDimension else { return nil }
            return ["x": xi, "y": yi]
        }
        guard normalizedBarriers.count == barriers.count else {
            return json(["error": "Invalid barrier coordinates"], status: 400)
        }

        var document = store.levelsDocument()
        var levels = document["levels"] as? [[String: Any]] ?? []
        guard levels.count < 100 else {
            return json(["error": "Maximum levels reached"], status: 400)
        }

        let id = Int(Date().timeIntervalSince1970 * 1000)
        levels.append([
            "id": id,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "name": cleanText(name, fallback: "Level", maxLength: 50),
            "gridSize": gridSize,
            "barriers": normalizedBarriers
        ])
        document["levels"] = levels
        store.saveLevels(document)

        return json(["success": true, "id": id], status: 201)
    }

    private func updateLevel(_ path: String, _ request: URLRequest) -> LocalWebResponse {
        guard let id = Int(path.split(separator: "/").last ?? "") else {
            return json(["error": "Level not found"], status: 404)
        }
        guard let levelData = jsonObject(from: request) else {
            return json(["error": "Invalid JSON"], status: 400)
        }
        guard let name = levelData["name"] as? String, !name.isEmpty, name.count <= 50 else {
            return json(["error": "Invalid level name"], status: 400)
        }

        let gridSize = allowed(levelData["gridSize"] as? String, values: Array(levelGridSizes.keys), fallback: defaultLevelGridSize)
        let gridDimension = levelGridSizes[gridSize] ?? levelGridSizes[defaultLevelGridSize]!
        guard let barriers = levelData["barriers"] as? [[String: Any]], barriers.count <= gridDimension * gridDimension else {
            return json(["error": "Invalid barriers"], status: 400)
        }

        let normalizedBarriers = barriers.compactMap { barrier -> [String: Int]? in
            guard let x = number(barrier["x"]), let y = number(barrier["y"]) else { return nil }
            let xi = Int(x.rounded(.down))
            let yi = Int(y.rounded(.down))
            guard xi >= 0, xi < gridDimension, yi >= 0, yi < gridDimension else { return nil }
            return ["x": xi, "y": yi]
        }
        guard normalizedBarriers.count == barriers.count else {
            return json(["error": "Invalid barrier coordinates"], status: 400)
        }

        var document = store.levelsDocument()
        var levels = document["levels"] as? [[String: Any]] ?? []
        guard let index = levels.firstIndex(where: { Int(number($0["id"]) ?? -1) == id }) else {
            return json(["error": "Level not found"], status: 404)
        }

        var updated = levels[index]
        updated["name"] = cleanText(name, fallback: "Level", maxLength: 50)
        updated["gridSize"] = gridSize
        updated["barriers"] = normalizedBarriers
        updated["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        levels[index] = updated
        document["levels"] = levels
        store.saveLevels(document)

        return json(["success": true, "id": id])
    }

    private func deleteLevel(_ path: String) -> LocalWebResponse {
        guard let id = Int(path.split(separator: "/").last ?? "") else {
            return json(["error": "Level not found"], status: 404)
        }

        var document = store.levelsDocument()
        var levels = document["levels"] as? [[String: Any]] ?? []
        let originalCount = levels.count
        levels.removeAll { Int(number($0["id"]) ?? -1) == id }
        guard levels.count < originalCount else {
            return json(["error": "Level not found"], status: 404)
        }

        document["levels"] = levels
        store.saveLevels(document)
        return json(["success": true])
    }

    private func verifyPassword(_ request: URLRequest) -> LocalWebResponse {
        guard let payload = jsonObject(from: request) else {
            return json(["error": "Invalid request"], status: 400)
        }

        return json(["valid": payload["password"] as? String == adminPassword])
    }

    private func analytics(_ request: URLRequest) -> LocalWebResponse {
        let password = request.value(forHTTPHeaderField: "X-Admin-Password") ?? ""
        guard password == adminPassword else {
            return json(["error": "Unauthorized"], status: 401)
        }

        return json(AnalyticsBuilder().build(from: store.statisticsGames()))
    }

    private func saveLogs(_ request: URLRequest) -> LocalWebResponse {
        guard let body = requestBody(request), body.count <= maximumBodySize else {
            return json(["error": "Request too large"], status: 413)
        }

        let logCount = store.appendLogs(from: body)
        return json(["success": true, "logged": logCount])
    }

    private func staticFile(_ rawPath: String) -> LocalWebResponse {
        let path = normalizedPath(rawPath) == "/" ? "/index.html" : normalizedPath(rawPath)
        let cleaned = path.removingPercentEncoding?
            .trimmingCharacters(in: CharacterSet(charactersIn: "/")) ?? "index.html"

        guard !cleaned.contains(".."), let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("Web") else {
            return text("Forbidden", status: 403)
        }

        let fileURL = resourceRoot.appendingPathComponent(cleaned)
        let resolvedRoot = resourceRoot.resolvingSymlinksInPath().path
        let resolvedFile = fileURL.resolvingSymlinksInPath().path
        guard resolvedFile.hasPrefix(resolvedRoot) else {
            return text("Forbidden", status: 403)
        }

        guard let mimeType = mimeType(for: fileURL.pathExtension) else {
            return text("Forbidden", status: 403)
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            return text("File not found", status: 404)
        }

        return dataResponse(data, status: 200, contentType: mimeType)
    }

    private func jsonObject(from request: URLRequest) -> [String: Any]? {
        guard let data = requestBody(request), data.count <= maximumBodySize else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func requestBody(_ request: URLRequest) -> Data? {
        if let body = request.httpBody {
            return body
        }
        guard let stream = request.httpBodyStream else {
            return Data()
        }

        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
            if data.count > maximumBodySize { return nil }
        }

        return data
    }

    private func withDefaultDifficulty(_ game: [String: Any]) -> [String: Any] {
        var result = game
        if result["difficulty"] == nil {
            result["difficulty"] = "medium"
        }
        return result
    }

    private func rounded(_ value: NSNumber?, defaultValue: Double) -> Double {
        let raw = value?.doubleValue ?? defaultValue
        return (raw * 10).rounded() / 10
    }

    private func normalizedPath(_ path: String) -> String {
        let trimmed = path.split(separator: "?").first.map(String.init) ?? path
        return trimmed.isEmpty ? "/" : trimmed
    }

    private func allowed(_ value: String?, values: [String], fallback: String) -> String {
        guard let value, values.contains(value) else { return fallback }
        return value
    }

    private func cleanText(_ value: String?, fallback: String, maxLength: Int) -> String {
        let cleaned = String((value ?? fallback).prefix(maxLength))
            .replacingOccurrences(of: "<", with: "")
            .replacingOccurrences(of: ">", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? fallback : cleaned
    }

    private func inferGame(source: String, payload: [String: Any]) -> String {
        let lower = source.lowercased()
        if lower.contains("tetris") || lower.contains("qwertzis") { return "qwertzis" }
        if lower.contains("pong") { return "qwertzPong" }
        if lower.contains("breakout") { return "qwertz Breakout" }
        if lower.contains("invaders") { return "qwertz Invaders" }
        if lower.contains("snake") || lower.contains("znake") || lower.contains("index") { return "qwertZnake" }
        if payload["lines"] != nil { return "qwertzis" }
        if payload["rally"] != nil || payload["winner"] != nil { return "qwertzPong" }
        return "qwertZnake"
    }

    private func number(_ value: Any?) -> Double? {
        if let number = value as? NSNumber { return number.doubleValue }
        if let string = value as? String { return Double(string) }
        return nil
    }

    private func json(_ object: Any, status: Int = 200) -> LocalWebResponse {
        let body = (try? JSONSerialization.data(withJSONObject: object, options: [])) ?? Data("{}".utf8)
        return dataResponse(body, status: status, contentType: "application/json")
    }

    private func text(_ value: String, status: Int, contentType: String = "text/plain") -> LocalWebResponse {
        dataResponse(Data(value.utf8), status: status, contentType: contentType)
    }

    private func dataResponse(_ data: Data, status: Int, contentType: String) -> LocalWebResponse {
        LocalWebResponse(
            statusCode: status,
            headers: [
                "Content-Type": contentType,
                "Content-Length": String(data.count),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
            ],
            body: data
        )
    }

    private func mimeType(for pathExtension: String) -> String? {
        switch pathExtension.lowercased() {
        case "html": "text/html"
        case "css": "text/css"
        case "js": "application/javascript"
        case "json": "application/json"
        case "txt": "text/plain"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "gif": "image/gif"
        case "svg": "image/svg+xml"
        case "ico": "image/x-icon"
        case "pdf": "application/pdf"
        default: nil
        }
    }
}
