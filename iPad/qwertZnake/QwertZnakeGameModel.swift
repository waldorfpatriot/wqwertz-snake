import Combine
import Foundation

@MainActor
final class QwertZnakeGameModel: ObservableObject {
    enum Phase: Equatable {
        case ready
        case playing
        case paused
        case gameOver
    }

    struct Direction: Equatable {
        var x: Int
        var y: Int
    }

    @Published var phase: Phase = .ready
    @Published var playerName = "Anonym" {
        didSet {
            localStore.savePlayerName(playerName)
        }
    }
    @Published var gridSize: GridSize = .medium {
        didSet {
            localStore.saveGridSize(gridSize)
        }
    }
    @Published private(set) var score = 0
    @Published private(set) var currentLevelNumber = 0
    @Published private(set) var activeLevelName = "Freies Spiel"
    @Published private(set) var snake: [GridPoint] = []
    @Published private(set) var food = GridPoint(x: 8, y: 8)
    @Published private(set) var barriers: Set<GridPoint> = []
    @Published private(set) var results: [GameResult] = []
    @Published private(set) var levels: [GameLevel] = []
    @Published private(set) var pressedKeys: Set<String> = []
    @Published private(set) var errorMessage: String?
    @Published private(set) var isSyncing = false
    @Published private(set) var lastRunSaved = true

    @Published private(set) var controlKeys: [ArcadeDirection: String] = [
        .up: "t",
        .down: "b",
        .left: "f",
        .right: "j"
    ]

    private let localStore: QwertZnakeLocalStore
    private var direction = Direction(x: 1, y: 0)
    private var nextDirection = Direction(x: 1, y: 0)
    private var pointsInCurrentLevel = 0
    private var gameStart = Date()
    private var totalKeystrokes = 0
    private var acceptedKeystrokes = 0
    private var fingerUsage: [String: Int] = [:]
    private var hasSubmittedCurrentRun = false
    private var learnedKeys: Set<String>?
    private var learningScoreTarget: Int?

    init(localStore: QwertZnakeLocalStore = QwertZnakeLocalStore()) {
        self.localStore = localStore
        playerName = localStore.fetchPlayerName()
        gridSize = localStore.fetchGridSize()
        resetBoard()
    }

    var dimension: Int {
        gridSize.dimension
    }

    var filteredLevels: [GameLevel] {
        levels.filter { ($0.gridSize ?? .big) == gridSize }
    }

    var kpm: Int {
        let minutes = max(Date().timeIntervalSince(gameStart) / 60, 0.01)
        return Int(Double(totalKeystrokes) / minutes)
    }

    var accuracy: Double {
        guard totalKeystrokes > 0 else { return 100 }
        return (Double(acceptedKeystrokes) / Double(totalKeystrokes) * 1000).rounded() / 10
    }

    var wpm: Int {
        let minutes = max(Date().timeIntervalSince(gameStart) / 60, 0.01)
        return Int((Double(acceptedKeystrokes) / 5) / minutes)
    }

    var elapsedSeconds: Int {
        max(0, Int(Date().timeIntervalSince(gameStart)))
    }

    func configureLearningChallenge(taughtKeys: [String], target: Int = 10) {
        let controls: [ArcadeDirection: String] = [.up: "d", .down: "k", .left: "f", .right: "j"]
        let learned = Set(taughtKeys)
        guard controls.values.allSatisfy({ learned.contains($0) }) else { return }
        learnedKeys = learned
        controlKeys = controls
        learningScoreTarget = target
        pressedKeys.removeAll()
        restart()
    }

    func pauseLearningChallenge() {
        if learningScoreTarget != nil, phase == .playing { phase = .paused }
        pressedKeys.removeAll()
    }

    func loadLocalState() async {
        isSyncing = true
        defer { isSyncing = false }

        levels = localStore.fetchLevels()
        results = localStore.fetchResults()
        applyCurrentLevel()
        errorMessage = nil
    }

    func startOrResume() {
        switch phase {
        case .ready, .gameOver:
            resetBoard()
            gameStart = Date()
            totalKeystrokes = 0
            acceptedKeystrokes = 0
            fingerUsage = [:]
            hasSubmittedCurrentRun = false
            lastRunSaved = true
            phase = .playing
        case .paused:
            phase = .playing
        case .playing:
            phase = .paused
        }
    }

    func restart() {
        phase = .ready
        resetBoard()
    }

    func resetForGridSizeChange() {
        phase = .ready
        resetBoard()
    }

    func press(_ key: String) {
        if let learnedKeys, !learnedKeys.contains(key) { return }
        guard !pressedKeys.contains(key) else { return }
        pressedKeys.insert(key)
        handle(key)
    }

    func release(_ key: String) {
        pressedKeys.remove(key)
    }

    func tick() {
        guard phase == .playing else { return }

        direction = nextDirection
        var head = GridPoint(x: snake[0].x + direction.x, y: snake[0].y + direction.y)
        head.x = wrapped(head.x)
        head.y = wrapped(head.y)

        if snake.contains(head) || barriers.contains(head) {
            endGame()
            return
        }

        snake.insert(head, at: 0)

        if head == food {
            score += 1
            pointsInCurrentLevel += 1
            if let target = learningScoreTarget, score >= target {
                phase = .gameOver
                return
            }
            spawnFood()
            advanceLevelIfNeeded()
        } else {
            _ = snake.popLast()
        }
    }

    func submitCurrentResult() async {
        guard phase == .gameOver, !hasSubmittedCurrentRun else { return }
        hasSubmittedCurrentRun = true

        let submission = ResultSubmission(
            name: playerName.isEmpty ? "Anonym" : playerName,
            points: score,
            kpm: kpm,
            accuracy: accuracy,
            wpm: wpm,
            level: currentLevelNumber,
            duration: elapsedSeconds,
            fingersUsed: fingerUsage,
            difficulty: "medium",
            gridSize: gridSize.rawValue
        )

        do {
            try localStore.save(submission)
            lastRunSaved = true
            results = localStore.fetchResults()
            errorMessage = nil
        } catch {
            hasSubmittedCurrentRun = false
            lastRunSaved = false
            errorMessage = error.localizedDescription
        }
    }

    private func handle(_ key: String) {
        if key == " " {
            startOrResume()
            return
        }

        guard phase == .playing else { return }

        totalKeystrokes += 1
        fingerUsage[fingerClass(for: key), default: 0] += 1

        guard let arcadeDirection = controlKeys.first(where: { $0.value == key })?.key else {
            return
        }

        let candidate = arcadeDirection.vector
        if candidate.x + direction.x == 0 && candidate.y + direction.y == 0 {
            return
        }

        acceptedKeystrokes += 1
        nextDirection = candidate
    }

    private func resetBoard() {
        let center = max(4, dimension / 2)
        snake = [
            GridPoint(x: center, y: center),
            GridPoint(x: center - 1, y: center),
            GridPoint(x: center - 2, y: center)
        ]
        direction = Direction(x: 1, y: 0)
        nextDirection = direction
        score = 0
        pointsInCurrentLevel = 0
        currentLevelNumber = 0
        applyCurrentLevel()
        spawnFood()
    }

    private func advanceLevelIfNeeded() {
        guard learningScoreTarget == nil else { return }
        guard pointsInCurrentLevel >= 10 else { return }
        pointsInCurrentLevel = 0

        let nextIndex = currentLevelNumber
        let available = filteredLevels
        guard nextIndex < available.count else {
            return
        }

        currentLevelNumber = nextIndex + 1
        activeLevelName = available[nextIndex].name
        barriers = Set(available[nextIndex].barriers.filter { point in
            point.x >= 0 && point.y >= 0 && point.x < dimension && point.y < dimension
        })
        spawnFood()
    }

    private func applyCurrentLevel() {
        if learningScoreTarget != nil {
            barriers = []
            activeLevelName = "Lernrunde"
            return
        }
        let available = filteredLevels
        guard currentLevelNumber > 0, currentLevelNumber <= available.count else {
            barriers = []
            activeLevelName = available.isEmpty ? "Freies Spiel" : "Start"
            spawnFood()
            return
        }

        let level = available[currentLevelNumber - 1]
        activeLevelName = level.name
        barriers = Set(level.barriers.filter { $0.x < dimension && $0.y < dimension })
        spawnFood()
    }

    private func spawnFood() {
        var candidates: [GridPoint] = []
        for y in 0..<dimension {
            for x in 0..<dimension {
                let point = GridPoint(x: x, y: y)
                if !snake.contains(point), !barriers.contains(point) {
                    candidates.append(point)
                }
            }
        }
        food = candidates.randomElement() ?? GridPoint(x: 0, y: 0)
    }

    private func endGame() {
        phase = .gameOver
        lastRunSaved = false
    }

    private func wrapped(_ value: Int) -> Int {
        if value < 0 { return dimension - 1 }
        if value >= dimension { return 0 }
        return value
    }

    private func fingerClass(for key: String) -> String {
        switch key {
        case "q", "a", "y", "p", "ü", "ö", "ä", "-":
            return "pinky"
        case "w", "s", "x", "o", "l", ".":
            return "ring"
        case "e", "d", "c", "i", "k", ",":
            return "middle"
        case "r", "f", "v", "t", "g", "b", "z", "h", "n", "u", "j", "m":
            return "index"
        default:
            return "other"
        }
    }
}

enum ArcadeDirection: String, CaseIterable {
    case up
    case down
    case left
    case right

    var symbolName: String {
        switch self {
        case .up: return "arrow.up"
        case .down: return "arrow.down"
        case .left: return "arrow.left"
        case .right: return "arrow.right"
        }
    }

    var vector: QwertZnakeGameModel.Direction {
        switch self {
        case .up: return .init(x: 0, y: -1)
        case .down: return .init(x: 0, y: 1)
        case .left: return .init(x: -1, y: 0)
        case .right: return .init(x: 1, y: 0)
        }
    }
}
