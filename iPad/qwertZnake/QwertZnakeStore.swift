import Foundation

struct QwertZnakeLocalStore {
    private let defaults: UserDefaults
    private let resultsKey = "qwertznake.results.v1"
    private let playerNameKey = "qwertznake.playerName.v1"
    private let gridSizeKey = "qwertznake.gridSize.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func fetchResults() -> [GameResult] {
        guard let data = defaults.data(forKey: resultsKey) else { return [] }
        do {
            return try Self.decoder.decode([GameResult].self, from: data)
                .filter(\.isQwertZnake)
                .sorted { $0.points > $1.points }
        } catch {
            return []
        }
    }

    func save(_ result: ResultSubmission) throws {
        var results = fetchResults()
        let storedResult = GameResult(
            id: Int(Date().timeIntervalSince1970 * 1000),
            timestamp: Date(),
            name: result.name,
            points: result.points,
            kpm: result.kpm,
            accuracy: result.accuracy,
            wpm: result.wpm,
            level: result.level,
            duration: result.duration,
            difficulty: result.difficulty,
            gridSize: result.gridSize,
            game: result.game,
            source: result.source
        )

        results.append(storedResult)
        results.sort { $0.points > $1.points }
        results = Array(results.prefix(100))

        let data = try Self.encoder.encode(results)
        defaults.set(data, forKey: resultsKey)
    }

    func fetchLevels() -> [GameLevel] {
        Self.defaultLevels
    }

    func fetchPlayerName() -> String {
        let saved = defaults.string(forKey: playerNameKey)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return saved?.isEmpty == false ? saved! : "Anonym"
    }

    func savePlayerName(_ value: String) {
        defaults.set(String(value.prefix(30)), forKey: playerNameKey)
    }

    func fetchGridSize() -> GridSize {
        guard let value = defaults.string(forKey: gridSizeKey),
              let size = GridSize(rawValue: value) else {
            return .medium
        }
        return size
    }

    func saveGridSize(_ value: GridSize) {
        defaults.set(value.rawValue, forKey: gridSizeKey)
    }

    private static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private static let defaultLevels: [GameLevel] = [
        GameLevel(
            id: 1,
            name: "Vier Ecken",
            gridSize: .small,
            barriers: [
                GridPoint(x: 0, y: 0), GridPoint(x: 1, y: 0), GridPoint(x: 18, y: 0), GridPoint(x: 19, y: 0),
                GridPoint(x: 0, y: 1), GridPoint(x: 19, y: 1), GridPoint(x: 0, y: 18), GridPoint(x: 19, y: 18),
                GridPoint(x: 0, y: 19), GridPoint(x: 1, y: 19), GridPoint(x: 18, y: 19), GridPoint(x: 19, y: 19)
            ]
        ),
        GameLevel(
            id: 2,
            name: "Mittelspur",
            gridSize: .medium,
            barriers: (6...23).map { GridPoint(x: 14, y: $0) } + (6...23).map { GridPoint(x: 15, y: $0) }
        ),
        GameLevel(
            id: 3,
            name: "Fenster",
            gridSize: .medium,
            barriers: (8...21).flatMap { index in
                [
                    GridPoint(x: index, y: 8),
                    GridPoint(x: index, y: 21),
                    GridPoint(x: 8, y: index),
                    GridPoint(x: 21, y: index)
                ]
            }
        ),
        GameLevel(
            id: 4,
            name: "Doppellinie",
            gridSize: .big,
            barriers: (8...31).flatMap { y in
                [GridPoint(x: 12, y: y), GridPoint(x: 27, y: y)]
            }
        ),
        GameLevel(
            id: 5,
            name: "Kreuzung",
            gridSize: .big,
            barriers: (7...32).map { GridPoint(x: 20, y: $0) } + (7...32).map { GridPoint(x: $0, y: 20) }
        )
    ]
}

struct GameResult: Identifiable, Codable, Equatable {
    let id: Int
    let timestamp: Date?
    let name: String
    let points: Int
    let kpm: Int
    let accuracy: Double?
    let wpm: Int?
    let level: Int?
    let duration: Int?
    let difficulty: String?
    let gridSize: String?
    let game: String?
    let source: String?

    var isQwertZnake: Bool {
        let haystack = "\(game ?? "") \(source ?? "")".lowercased()
        return haystack.isEmpty || haystack.contains("qwertznake") || haystack.contains("snake") || haystack.contains("znake") || haystack.contains("native")
    }

    var displayDate: String {
        guard let timestamp else { return "-" }
        return timestamp.formatted(date: .abbreviated, time: .shortened)
    }
}

struct GameLevel: Identifiable, Codable, Equatable {
    let id: Int
    let name: String
    let gridSize: GridSize?
    let barriers: [GridPoint]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case gridSize
        case barriers
    }

    init(id: Int, name: String, gridSize: GridSize?, barriers: [GridPoint]) {
        self.id = id
        self.name = name
        self.gridSize = gridSize
        self.barriers = barriers
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        gridSize = try container.decodeIfPresent(GridSize.self, forKey: .gridSize) ?? .big
        barriers = try container.decodeIfPresent([GridPoint].self, forKey: .barriers) ?? []
    }
}

struct GridPoint: Hashable, Codable {
    var x: Int
    var y: Int
}

enum GridSize: String, Codable, CaseIterable, Identifiable {
    case small
    case medium
    case big

    var id: String { rawValue }

    var dimension: Int {
        switch self {
        case .small: return 20
        case .medium: return 30
        case .big: return 40
        }
    }

    var title: String {
        switch self {
        case .small: return "20 x 20"
        case .medium: return "30 x 30"
        case .big: return "40 x 40"
        }
    }
}

struct ResultSubmission: Encodable {
    let name: String
    let points: Int
    let kpm: Int
    let accuracy: Double
    let wpm: Int
    let level: Int
    let duration: Int
    let fingersUsed: [String: Int]
    let difficulty: String
    let gridSize: String
    let game = "qwertZnake"
    let source = "native-ipad"
}
