import Combine
import Foundation

struct QwertZnakeLesson: Codable, Identifiable {
    var id: String
    var title: String
    var number: Int
    var newKeys: [String]
    var taughtKeys: [String]
    var oldKeys: [String]
    var demoTargets: [String]
    var feedTargets: [String]
    var writeTargets: [String]
    var writePrompts: [String]
    var nextLessonId: String?
    var kind: String? = nil
    var newControlKeys: [String]? = nil
    var taughtControlKeys: [String]? = nil
    var isBackspaceLesson: Bool { kind == "backspace" }

    func targets(for stage: QwertZnakeLearningStage) -> [String] {
        switch stage {
        case .demo: return demoTargets
        case .feed: return feedTargets
        case .write: return writeTargets
        case .result: return []
        }
    }
}

enum QwertZnakeLearningStage: String, Codable, CaseIterable {
    case demo, feed, write, result

    var title: String {
        switch self {
        case .demo: return "Finger kennenlernen"
        case .feed: return "Schlange füttern"
        case .write: return "Jetzt schreiben"
        case .result: return "Geschafft!"
        }
    }
}

struct QwertZnakeLearningKeyMetric: Codable {
    var targets = 0
    var attemptedTargets = 0
    var correctFirstTry = 0
    var attempts = 0
    var errors = 0
    var corrections = 0
    var correct = 0
    var streak = 0

    init() {}

    private enum CodingKeys: String, CodingKey {
        case targets, attemptedTargets, correctFirstTry, attempts, errors, corrections, correct, streak
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        targets = try values.decodeIfPresent(Int.self, forKey: .targets) ?? 0
        attemptedTargets = try values.decodeIfPresent(Int.self, forKey: .attemptedTargets) ?? targets
        correctFirstTry = try values.decodeIfPresent(Int.self, forKey: .correctFirstTry) ?? 0
        attempts = try values.decodeIfPresent(Int.self, forKey: .attempts) ?? 0
        errors = try values.decodeIfPresent(Int.self, forKey: .errors) ?? 0
        corrections = try values.decodeIfPresent(Int.self, forKey: .corrections) ?? 0
        correct = try values.decodeIfPresent(Int.self, forKey: .correct) ?? max(0, attempts - errors)
        streak = try values.decodeIfPresent(Int.self, forKey: .streak) ?? 0
    }

    var reliable: Bool { targets >= 20 && Double(correctFirstTry) / Double(max(1, targets)) >= 0.9 }
}

struct QwertZnakeLearningStageData: Codable {
    var index = 0
    var typed: [String] = []
    var firstTry: [Bool?]
    var characterAttempts = 0
    var errors = 0
    var corrections = 0
    var backspaces = 0
    var activeMs = 0
    var hintsUsed = 0
    var keyMetrics: [String: QwertZnakeLearningKeyMetric] = [:]
    var guidedDeleted: [Bool]?

    init(targetCount: Int, guided: Bool = false) {
        firstTry = Array(repeating: nil, count: targetCount)
        guidedDeleted = guided ? Array(repeating: false, count: targetCount) : nil
    }
}

struct QwertZnakeLearningSession: Codable {
    var id = UUID().uuidString
    var lessonId: String
    var curriculumVersion: String
    var stage: QwertZnakeLearningStage = .demo
    var paused = false
    var stages: [String: QwertZnakeLearningStageData]
    var completedAt: Date?
    // Optional for compatibility with snapshots saved before automatic per-key help.
    var correctStreaks: [String: Int]?
    var arcadeChallengeCompleted: Bool?
}

struct QwertZnakeLearningStageResult: Codable {
    var targets: Int
    var completedTargets: Int
    var attemptedTargets: Int
    var correctFirstTry: Int
    var characterAttempts: Int
    var errors: Int
    var corrections: Int
    var backspaces: Int
    var activeMs: Int
    var hintsUsed: Int
    var accuracy: Double
    var perKey: [String: QwertZnakeLearningKeyMetric]
}

struct QwertZnakeLearningResult: Codable, Identifiable {
    var id: String
    var sessionId: String
    var lessonId: String
    var curriculumVersion: String
    var completedAt: Date
    var scoringStages: [String]
    var stages: [String: QwertZnakeLearningStageResult]
    var targets: Int
    var completedTargets: Int
    var attemptedTargets: Int
    var correctFirstTry: Int
    var characterAttempts: Int
    var errors: Int
    var corrections: Int
    var backspaces: Int
    var activeMs: Int
    var hintsUsed: Int
    var perKey: [String: QwertZnakeLearningKeyMetric]
    var introducedKeys: [String]
    var taughtKeys: [String]
    var firstTryAccuracy: Double
    var accuracy: Double
    var stars: Int
    var accuracyPercent: Int

    init(id: String, lessonId: String, curriculumVersion: String, completedAt: Date,
         stages: [String: QwertZnakeLearningStageResult], targets: Int, correctFirstTry: Int,
         characterAttempts: Int, errors: Int, corrections: Int, backspaces: Int, activeMs: Int,
         hintsUsed: Int, perKey: [String: QwertZnakeLearningKeyMetric], introducedKeys: [String], taughtKeys: [String]) {
        self.id = id
        sessionId = id
        self.lessonId = lessonId
        self.curriculumVersion = curriculumVersion
        self.completedAt = completedAt
        scoringStages = ["feed", "write"]
        self.stages = stages
        self.targets = targets
        completedTargets = targets
        attemptedTargets = targets
        self.correctFirstTry = correctFirstTry
        self.characterAttempts = characterAttempts
        self.errors = errors
        self.corrections = corrections
        self.backspaces = backspaces
        self.activeMs = activeMs
        self.hintsUsed = hintsUsed
        self.perKey = perKey
        self.introducedKeys = introducedKeys
        self.taughtKeys = taughtKeys
        let ratio = Double(correctFirstTry) / Double(max(1, targets))
        firstTryAccuracy = ratio
        accuracy = ratio
        stars = ratio >= 0.95 ? 3 : ratio >= 0.9 ? 2 : 1
        accuracyPercent = Int((ratio * 100).rounded())
    }

    private enum CodingKeys: String, CodingKey {
        case id, sessionId, lessonId, curriculumVersion, completedAt, scoringStages, stages
        case targets, completedTargets, attemptedTargets, correctFirstTry, characterAttempts
        case errors, corrections, backspaces, activeMs, hintsUsed, perKey, introducedKeys, taughtKeys
        case firstTryAccuracy, accuracy, stars, accuracyPercent
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        sessionId = try values.decodeIfPresent(String.self, forKey: .sessionId) ?? id
        lessonId = try values.decode(String.self, forKey: .lessonId)
        curriculumVersion = try values.decode(String.self, forKey: .curriculumVersion)
        let timestamp = try values.decode(Double.self, forKey: .completedAt)
        // Older native results encoded Date as seconds since 2001. New results use browser epoch-ms.
        completedAt = abs(timestamp) >= 100_000_000_000
            ? Date(timeIntervalSince1970: timestamp / 1000)
            : Date(timeIntervalSinceReferenceDate: timestamp)
        scoringStages = try values.decodeIfPresent([String].self, forKey: .scoringStages) ?? ["feed", "write"]
        // A legacy aggregate has no recoverable per-stage history; do not fabricate a breakdown.
        stages = try values.decodeIfPresent([String: QwertZnakeLearningStageResult].self, forKey: .stages) ?? [:]
        targets = try values.decode(Int.self, forKey: .targets)
        completedTargets = try values.decodeIfPresent(Int.self, forKey: .completedTargets) ?? targets
        attemptedTargets = try values.decodeIfPresent(Int.self, forKey: .attemptedTargets) ?? targets
        correctFirstTry = try values.decode(Int.self, forKey: .correctFirstTry)
        characterAttempts = try values.decode(Int.self, forKey: .characterAttempts)
        errors = try values.decode(Int.self, forKey: .errors)
        corrections = try values.decode(Int.self, forKey: .corrections)
        backspaces = try values.decode(Int.self, forKey: .backspaces)
        activeMs = try values.decode(Int.self, forKey: .activeMs)
        hintsUsed = try values.decode(Int.self, forKey: .hintsUsed)
        perKey = try values.decodeIfPresent([String: QwertZnakeLearningKeyMetric].self, forKey: .perKey) ?? [:]
        introducedKeys = try values.decodeIfPresent([String].self, forKey: .introducedKeys) ?? []
        taughtKeys = try values.decodeIfPresent([String].self, forKey: .taughtKeys) ?? []
        let ratio = Double(correctFirstTry) / Double(max(1, targets))
        firstTryAccuracy = ratio
        accuracy = ratio
        stars = ratio >= 0.95 ? 3 : ratio >= 0.9 ? 2 : 1
        accuracyPercent = Int((ratio * 100).rounded())
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(sessionId, forKey: .sessionId)
        try values.encode(lessonId, forKey: .lessonId)
        try values.encode(curriculumVersion, forKey: .curriculumVersion)
        try values.encode((completedAt.timeIntervalSince1970 * 1000).rounded(), forKey: .completedAt)
        try values.encode(scoringStages, forKey: .scoringStages)
        try values.encode(stages, forKey: .stages)
        try values.encode(targets, forKey: .targets)
        try values.encode(completedTargets, forKey: .completedTargets)
        try values.encode(attemptedTargets, forKey: .attemptedTargets)
        try values.encode(correctFirstTry, forKey: .correctFirstTry)
        try values.encode(characterAttempts, forKey: .characterAttempts)
        try values.encode(errors, forKey: .errors)
        try values.encode(corrections, forKey: .corrections)
        try values.encode(backspaces, forKey: .backspaces)
        try values.encode(activeMs, forKey: .activeMs)
        try values.encode(hintsUsed, forKey: .hintsUsed)
        try values.encode(perKey, forKey: .perKey)
        try values.encode(introducedKeys, forKey: .introducedKeys)
        try values.encode(taughtKeys, forKey: .taughtKeys)
        try values.encode(firstTryAccuracy, forKey: .firstTryAccuracy)
        try values.encode(accuracy, forKey: .accuracy)
        try values.encode(stars, forKey: .stars)
        try values.encode(accuracyPercent, forKey: .accuracyPercent)
    }
}

struct QwertZnakeLearningProfile: Codable, Identifiable {
    var id = UUID().uuidString
    var nickname: String
    var currentLessonId: String
    var bestStars: [String: Int] = [:]
    var results: [QwertZnakeLearningResult] = []
    var appliedResultIds: Set<String> = []
    var keyMetrics: [String: QwertZnakeLearningKeyMetric] = [:]
    var resume: QwertZnakeLearningSession?
    var showFingerHelp = true
    var snakeColor = "mint"
    var hat = "none"
    var bridgeComplete = false
    // Missing in legacy profiles. A generated placeholder must be named before practice.
    var nameEntered: Bool?
    // A completed lesson stays resumable until its ten-point Arcade round is finished.
    var pendingArcadeSession: QwertZnakeLearningSession?
}

@MainActor
final class QwertZnakeLearningModel: ObservableObject {
    let curriculumVersion: String
    let lessons: [QwertZnakeLesson]
    let classroom: QwertZnakeClassroomClient
    let arcadeGame: QwertZnakeGameModel
    @Published private(set) var profiles: [QwertZnakeLearningProfile]
    @Published private(set) var activeProfileId: String
    @Published private(set) var session: QwertZnakeLearningSession?
    @Published private(set) var feedback = ""
    @Published private(set) var lastCorrect: Bool?
    @Published private(set) var storageMessage: String?
    @Published private(set) var bridgeIndex: Int?
    // Presentation only: the next stage/result is already saved before its reward starts.
    @Published private(set) var reward: QwertZnakeLearningReward?

    private static let storageKey = "qwertznake-native-learning-v1"
    private let defaults: UserDefaults
    private var lastTick: Date?
    private let bridgeKeys = ["j", "j", "k", "k", "f", "f", "d", "j"]

    private struct Curriculum: Decodable {
        var curriculumVersion: String
        var lessons: [QwertZnakeLesson]
    }

    private struct SavedState: Codable {
        var schemaVersion = 1
        var curriculumVersion: String
        var activeProfileId: String
        var profiles: [QwertZnakeLearningProfile]
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        classroom = QwertZnakeClassroomClient(defaults: defaults)
        arcadeGame = QwertZnakeGameModel(localStore: QwertZnakeLocalStore(defaults: defaults))
        let curriculum = Self.loadCurriculum()
        curriculumVersion = curriculum.curriculumVersion
        lessons = curriculum.lessons
        let first = curriculum.lessons[0].id
        if let data = defaults.data(forKey: Self.storageKey),
           let saved = try? JSONDecoder().decode(SavedState.self, from: data),
           saved.schemaVersion == 1, !saved.profiles.isEmpty,
           saved.profiles.count <= 100 {
            let ids = Set(curriculum.lessons.map(\.id))
            let normalizedProfiles = saved.profiles.map { raw in
                var profile = raw
                profile.nickname = String(raw.nickname.prefix(40))
                if !ids.contains(profile.currentLessonId) { profile.currentLessonId = first }
                profile.bestStars = profile.bestStars.filter { ids.contains($0.key) && (1...3).contains($0.value) }
                profile.results = Array(profile.results.filter { ids.contains($0.lessonId) && $0.curriculumVersion == curriculum.curriculumVersion }.suffix(50))
                if saved.curriculumVersion != curriculum.curriculumVersion {
                    // Never resume or combine assessment data from a changed curriculum.
                    profile.resume = nil
                    profile.pendingArcadeSession = nil
                    profile.bestStars = [:]
                    profile.keyMetrics = [:]
                    profile.results = []
                    profile.appliedResultIds = []
                    profile.currentLessonId = first
                    profile.bridgeComplete = false
                    profile.snakeColor = "mint"
                    profile.hat = "none"
                }
                if var resume = profile.resume {
                    // The first lesson now retries directly; preserve the old recorded error.
                    if resume.lessonId == "home-fj", var writing = resume.stages["write"], writing.typed.count > writing.index {
                        writing.typed = Array(writing.typed.prefix(writing.index))
                        resume.stages["write"] = writing
                    }
                    profile.resume = Self.valid(resume: resume, curriculum: curriculum) ? resume : nil
                }
                if let pending = profile.pendingArcadeSession {
                    let lesson = curriculum.lessons.first { $0.id == pending.lessonId }
                    if !Self.valid(resume: pending, curriculum: curriculum) || pending.stage != .result ||
                        lesson?.number.isMultiple(of: 3) != true || pending.arcadeChallengeCompleted == true {
                        profile.pendingArcadeSession = nil
                    }
                }
                return profile
            }
            profiles = normalizedProfiles
            activeProfileId = normalizedProfiles.contains { $0.id == saved.activeProfileId } ? saved.activeProfileId : normalizedProfiles[0].id
        } else {
            let profile = QwertZnakeLearningProfile(nickname: "", currentLessonId: first)
            profiles = [profile]
            activeProfileId = profile.id
        }
        classroom.onNameIssue = { [weak self] profileId, acceptedName in
            guard let self, let index = self.profiles.firstIndex(where: { $0.id == profileId }) else { return }
            if let acceptedName { self.profiles[index].nickname = acceptedName; self.persist() }
            else if profileId == self.activeProfileId { self.suspend() }
        }
        syncClassroom()
    }

    var profile: QwertZnakeLearningProfile { profiles[profileIndex] }
    var requiresName: Bool { needsName(profile) || classroom.needsNameCorrection.contains(activeProfileId) }
    private var profileIndex: Int { profiles.firstIndex { $0.id == activeProfileId } ?? 0 }
    var lesson: QwertZnakeLesson? { lessons.first { $0.id == session?.lessonId } }
    var stage: QwertZnakeLearningStage? { session?.stage }
    var isPaused: Bool { session?.paused ?? false }
    var needsArcadeChallenge: Bool {
        stage == .result && lesson?.number.isMultiple(of: 3) == true && session?.arcadeChallengeCompleted != true
    }
    var targets: [String] { guard let lesson, let stage else { return [] }; return lesson.targets(for: stage) }
    var targetIndex: Int { guard let stage else { return 0 }; return session?.stages[stage.rawValue]?.index ?? 0 }
    var typingExpectedKey: String? {
        guard reward == nil else { return nil }
        if let bridgeIndex, bridgeIndex < bridgeKeys.count { return bridgeKeys[bridgeIndex] }
        return targetIndex < targets.count ? targets[targetIndex] : nil
    }
    var guidedCorrectionPending: Bool {
        guard reward == nil, lesson?.isBackspaceLesson == true, let stage, targetIndex < targets.count else { return false }
        let flags = session?.stages[stage.rawValue]?.guidedDeleted ?? []
        return targetIndex >= flags.count || !flags[targetIndex]
    }
    var expectedKey: String? { guidedCorrectionPending ? "backspace" : typingExpectedKey }
    var guidedWrongKey: String? { guard guidedCorrectionPending, let key = typingExpectedKey else { return nil }; return key == "f" ? "j" : "f" }
    var needsBackspace: Bool {
        guidedCorrectionPending || stage == .write && (session?.stages["write"]?.typed.count ?? 0) > targetIndex
    }
    var completedCount: Int { profile.bestStars.count }
    var result: QwertZnakeLearningResult? {
        guard let session, session.stage == .result else { return nil }
        return makeResult(session)
    }
    private var recommendedLesson: QwertZnakeLesson {
        if let pending = profile.pendingArcadeSession, let lesson = lessons.first(where: { $0.id == pending.lessonId }) { return lesson }
        if let current = lessons.first(where: { $0.id == profile.currentLessonId }), available(current) { return current }
        return lessons.first(where: { available($0) && profile.bestStars[$0.id] == nil }) ?? lessons[0]
    }
    var currentLessonTitle: String { recommendedLesson.title }
    var hasResume: Bool { profile.pendingArcadeSession != nil || (profile.resume.map { $0.stage != .result } ?? false) }
    var reliableKeys: [String] { profile.keyMetrics.keys.filter { profile.keyMetrics[$0]?.reliable == true }.sorted() }
    var introducedKeys: [String] {
        lessons.filter { profile.bestStars[$0.id] != nil }.flatMap(\.newKeys)
    }

    func shouldShowFingerHelp(pinned: Bool) -> Bool {
        guard reward == nil else { return false }
        if lesson?.isBackspaceLesson == true { return pinned || profile.showFingerHelp || lastCorrect == false }
        if pinned || stage == .demo || lastCorrect == false { return true }
        guard let key = expectedKey, let stage else { return false }
        let streak = session?.correctStreaks?[stage.rawValue + ":" + key] ?? 0
        let metric = session?.stages[stage.rawValue]?.keyMetrics[key]
        if (metric?.errors ?? 0) > 0, streak < 3 { return true }
        guard profile.showFingerHelp else { return false }
        if profile.keyMetrics[key]?.reliable == true { return false }
        return streak < 6
    }

    func available(_ lesson: QwertZnakeLesson) -> Bool {
        if let pending = profile.pendingArcadeSession,
           let milestone = lessons.first(where: { $0.id == pending.lessonId }), lesson.number > milestone.number { return false }
        return lesson.number == 1 || profile.bestStars[lesson.id] != nil || profile.resume?.lessonId == lesson.id ||
            lessons.first { $0.number == lesson.number - 1 }.map { profile.bestStars[$0.id] != nil } == true
    }

    func createProfile(_ nickname: String) {
        let cleaned = QwertZnakeClassroomClient.cleanedName(nickname)
        guard QwertZnakeClassroomClient.validName(cleaned), profiles.count < 100 else { return }
        goHome()
        var newProfile = QwertZnakeLearningProfile(nickname: cleaned, currentLessonId: lessons[0].id)
        newProfile.nameEntered = true
        profiles.append(newProfile)
        activeProfileId = newProfile.id
        persist()
        syncClassroom()
    }

    func renameProfile(_ name: String) {
        let cleaned = QwertZnakeClassroomClient.cleanedName(name)
        guard QwertZnakeClassroomClient.validName(cleaned) else { return }
        profiles[profileIndex].nickname = cleaned
        profiles[profileIndex].nameEntered = true
        classroom.clearNameIssue(profileId: activeProfileId)
        persist()
        syncClassroom()
    }

    func syncClassroom() {
        for profile in profiles where !needsName(profile) {
            classroom.remember(profileId: profile.id, name: profile.nickname, results: profile.results)
        }
        Task { await classroom.syncNow() }
    }

    private func needsName(_ profile: QwertZnakeLearningProfile) -> Bool {
        let name = QwertZnakeClassroomClient.cleanedName(profile.nickname)
        return !QwertZnakeClassroomClient.validName(name) || (name == "Lernkind" && profile.nameEntered != true)
    }

    func switchProfile(_ id: String) {
        guard id != activeProfileId, profiles.contains(where: { $0.id == id }) else { return }
        goHome()
        activeProfileId = id
        feedback = ""
        persist()
    }

    func start(_ lessonId: String, resume: Bool = false) {
        guard !requiresName, let lesson = lessons.first(where: { $0.id == lessonId }), available(lesson) else { return }
        reward = nil
        arcadeGame.pauseLearningChallenge()
        if let saved = profile.pendingArcadeSession, saved.lessonId == lessonId {
            session = saved
            session?.paused = false
        } else if resume, let saved = profile.resume, saved.lessonId == lessonId {
            session = saved
            session?.paused = false
        } else {
            session = QwertZnakeLearningSession(
                lessonId: lesson.id, curriculumVersion: curriculumVersion,
                stages: Dictionary(uniqueKeysWithValues: [QwertZnakeLearningStage.demo, .feed, .write].map {
                    ($0.rawValue, QwertZnakeLearningStageData(targetCount: lesson.targets(for: $0).count, guided: lesson.isBackspaceLesson))
                })
            )
        }
        profiles[profileIndex].currentLessonId = lessonId
        bridgeIndex = nil
        lastTick = Date()
        feedback = lesson.isBackspaceLesson ? "Lösche zuerst das vorbereitete falsche Zeichen. Tippe danach den richtigen Buchstaben." : stage == .demo ? "Lege deine Finger auf die Grundreihe. Tippe die gezeigte Taste einzeln." : "Schön, dass du weitermachst!"
        lastCorrect = nil
        saveSession()
        if stage == .result {
            applyResult()
            prepareArcadeChallenge()
        }
    }

    func resumeCurrent() {
        if let pending = profile.pendingArcadeSession { start(pending.lessonId, resume: true) }
        else if let resume = profile.resume, resume.stage != .result { start(resume.lessonId, resume: true) }
        else { start(recommendedLesson.id) }
    }

    func submit(_ rawKey: String) {
        if needsArcadeChallenge, reward == nil {
            guard !isPaused, lesson?.taughtKeys.contains(rawKey.lowercased()) == true else { return }
            arcadeGame.press(rawKey.lowercased())
            arcadeGame.release(rawKey.lowercased())
            return
        }
        guard reward == nil, var current = session, !current.paused, current.stage != .result || bridgeIndex != nil else { return }
        let key = rawKey.lowercased()
        if key == "backspace" { backspace(); return }
        guard key.count == 1, key.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }) else { return }
        if guidedCorrectionPending {
            feedback = "Erst mit Rücktaste ⌫ löschen, danach \(Self.label(typingExpectedKey ?? "")) tippen."
            return
        }
        if let index = bridgeIndex {
            guard index < bridgeKeys.count else { return }
            lastCorrect = key == bridgeKeys[index]
            if lastCorrect == true {
                bridgeIndex = index + 1
                feedback = "Gut gesteuert! Die Tasten bleiben gleich."
                if index + 1 == bridgeKeys.count {
                    bridgeIndex = nil
                    profiles[profileIndex].bridgeComplete = true
                    feedback = "Du kennst jetzt F, J, D und K zum Lenken."
                    persist()
                    reward = QwertZnakeLearningReward(completedStage: nil, targetCount: bridgeKeys.count,
                        bridgeStep: bridgeKeys.count, stars: nil)
                    lastTick = nil
                }
            } else { feedback = "Die Schlange wartet. Tippe \(Self.label(bridgeKeys[index]))." }
            return
        }
        tick()
        current = session ?? current
        guard let lesson, var data = current.stages[current.stage.rawValue] else { return }
        let targets = lesson.targets(for: current.stage)
        guard data.index < targets.count else { return }
        let expected = targets[data.index]
        let blocked = current.stage == .write && data.typed.count > data.index
        let correct = !blocked && key == expected
        if current.correctStreaks == nil { current.correctStreaks = [:] }
        let streakKey = current.stage.rawValue + ":" + expected
        var metric = data.keyMetrics[expected, default: QwertZnakeLearningKeyMetric()]
        metric.attempts += 1
        data.characterAttempts += 1
        if data.firstTry[data.index] == nil { data.firstTry[data.index] = correct }
        if correct {
            current.correctStreaks?[streakKey, default: 0] += 1
            data.typed.append(key)
            data.index += 1
            feedback = current.stage == .feed ? "Lecker! Ein Snack für deine Schlange." : "Prima. Weiter so!"
        } else {
            current.correctStreaks?[streakKey] = 0
            data.firstTry[data.index] = false
            data.errors += 1
            metric.errors += 1
            if current.stage == .write, !blocked, lesson.id != "home-fj" { data.typed.append(key) }
            feedback = current.stage == .write && lesson.id != "home-fj" ? "Mit Rücktaste ⌫ korrigieren. Dein Fortschritt bleibt." : "Die Schlange wartet. Versuche noch einmal \(Self.label(expected))."
        }
        data.keyMetrics[expected] = metric
        lastCorrect = correct
        current.stages[current.stage.rawValue] = data
        session = current
        if data.index == targets.count { advance() }
        else { saveSession() }
    }

    func backspace() {
        if guidedCorrectionPending {
            guard reward == nil, var current = session, !current.paused, let stage,
                  var data = current.stages[stage.rawValue] else { return }
            tick()
            data.activeMs = session?.stages[stage.rawValue]?.activeMs ?? data.activeMs
            if data.guidedDeleted == nil { data.guidedDeleted = Array(repeating: false, count: targets.count) }
            data.guidedDeleted?[data.index] = true
            current.stages[stage.rawValue] = data
            session = current
            lastCorrect = nil
            feedback = "Gut gelöscht! Tippe jetzt \(Self.label(typingExpectedKey ?? "")), dann zurück zur Grundreihe."
            saveSession()
            return
        }
        guard reward == nil, var current = session, current.stage == .write, !current.paused,
              var data = current.stages["write"], !data.typed.isEmpty else { return }
        tick()
        data.activeMs = session?.stages["write"]?.activeMs ?? data.activeMs
        data.backspaces += 1
        if data.typed.count > data.index {
            data.corrections += 1
            if let lesson, data.index < lesson.writeTargets.count {
                let key = lesson.writeTargets[data.index]
                data.keyMetrics[key, default: QwertZnakeLearningKeyMetric()].corrections += 1
            }
        } else { data.index -= 1 }
        data.typed.removeLast()
        current.stages["write"] = data
        session = current
        lastCorrect = nil
        feedback = "Gut korrigiert. Tippe die gezeigte Taste."
        saveSession()
    }

    func demonstrate() {
        guard reward == nil, var current = session, current.stage == .demo, !current.paused, let lesson,
              var data = current.stages["demo"] else { return }
        if lesson.isBackspaceLesson, data.guidedDeleted?.allSatisfy({ $0 }) != true { return }
        data.index = lesson.demoTargets.count
        data.typed = lesson.demoTargets
        data.firstTry = data.firstTry.map { $0 ?? true }
        current.stages["demo"] = data
        session = current
        advance()
    }

    func togglePause() {
        guard session != nil, stage != .result || bridgeIndex != nil || reward != nil || needsArcadeChallenge else { return }
        tick()
        session?.paused.toggle()
        if needsArcadeChallenge {
            if isPaused { arcadeGame.pauseLearningChallenge() }
            else if arcadeGame.phase == .paused { arcadeGame.startOrResume() }
        }
        lastTick = reward == nil ? Date() : nil
        feedback = isPaused ? "Pause. Weiter mit der Schaltfläche oder Escape." : "Weiter geht’s. Deine Schlange wartet auf dich."
        saveSession()
    }

    func suspend() {
        guard session != nil else { return }
        tick()
        arcadeGame.pauseLearningChallenge()
        session?.paused = true
        bridgeIndex = nil
        reward = nil
        saveSession()
        lastTick = nil
    }

    func goHome() {
        suspend()
        session = nil
        bridgeIndex = nil
        lastCorrect = nil
    }

    func showHelp() {
        guard reward == nil else { return }
        if !profile.showFingerHelp { profiles[profileIndex].showFingerHelp = true }
        if let stage, stage != .result, !isPaused {
            session?.stages[stage.rawValue]?.hintsUsed += 1
            saveSession()
        } else { persist() }
    }

    func setFingerHelp(_ shown: Bool) {
        profiles[profileIndex].showFingerHelp = shown
        persist()
    }

    func setCosmetic(color: String? = nil, hat: String? = nil) {
        if let color, color == "mint" || color == "gold" && completedCount >= 3 || color == "violet" && completedCount >= 6 {
            profiles[profileIndex].snakeColor = color
        }
        if let hat, hat == "none" || hat == "flower" && completedCount >= 2 || hat == "crown" && completedCount >= 8 {
            profiles[profileIndex].hat = hat
        }
        persist()
    }

    func beginBridge() {
        guard reward == nil, !needsArcadeChallenge, stage == .result, lesson?.id == "home-dk", !profile.bridgeComplete else { return }
        session?.paused = false
        bridgeIndex = 0
        feedback = "F links · J rechts · D hoch · K runter. Die Schlange wartet an jeder Ecke."
        lastCorrect = nil
    }

    private func advance() {
        guard var current = session else { return }
        let completedStage = current.stage
        let targetCount = lesson?.targets(for: completedStage).count ?? 0
        switch current.stage {
        case .demo:
            current.stage = .feed
            feedback = "Jede richtige Taste bringt deine Schlange einen Schritt zum Apfel weiter."
        case .feed:
            current.stage = .write
            feedback = "Schreibe die kleine Folge. Mit Löschen kannst du korrigieren."
        case .write:
            current.stage = .result
            current.completedAt = Date()
            feedback = "Du hast die ganze Lektion geschafft!"
        case .result: return
        }
        session = current
        if current.stage == .result {
            applyResult()
            prepareArcadeChallenge()
        }
        else { saveSession() }
        reward = QwertZnakeLearningReward(completedStage: completedStage, targetCount: targetCount,
            bridgeStep: nil, stars: current.stage == .result ? result?.stars : nil)
        lastTick = nil
    }

    func updateRewardPhase(_ phase: LearningRewardPhase, id: String) {
        guard let current = reward, current.id == id, !isPaused,
              phase.rawValue == current.phase.rawValue + 1 else { return }
        reward?.phase = phase
    }

    func finishReward(id: String) {
        guard reward?.id == id, reward?.phase == .celebration else { return }
        reward = nil
        session?.paused = false
        lastCorrect = nil
        lastTick = stage == .result ? nil : Date()
        saveSession()
    }

    private func prepareArcadeChallenge() {
        guard needsArcadeChallenge, let lesson else { return }
        arcadeGame.configureLearningChallenge(taughtKeys: lesson.taughtKeys)
        feedback = "Arcade-Zeit! Sammle 10 Punkte mit F, J, D und K."
    }

    func startArcadeChallenge() {
        guard needsArcadeChallenge, reward == nil, !isPaused else { return }
        arcadeGame.startOrResume()
    }

    func tickArcadeChallenge() {
        guard needsArcadeChallenge, reward == nil, !isPaused else { return }
        arcadeGame.tick()
        guard arcadeGame.score >= 10 else { return }
        session?.arcadeChallengeCompleted = true
        if profiles[profileIndex].pendingArcadeSession?.id == session?.id {
            profiles[profileIndex].pendingArcadeSession = nil
        }
        if let next = lesson?.nextLessonId { profiles[profileIndex].currentLessonId = next }
        feedback = "10 Punkte! Du hast die Arcade-Runde geschafft."
        lastTick = nil
        saveSession()
    }

    private func makeResult(_ current: QwertZnakeLearningSession) -> QwertZnakeLearningResult {
        let lesson = lessons.first { $0.id == current.lessonId } ?? lessons[0]
        var stages: [String: QwertZnakeLearningStageResult] = [:]
        for stage in [QwertZnakeLearningStage.demo, .feed, .write] {
            let targets = lesson.targets(for: stage)
            guard let data = current.stages[stage.rawValue] else { continue }
            var keys: [String: QwertZnakeLearningKeyMetric] = [:]
            for (index, key) in targets.enumerated() {
                keys[key, default: QwertZnakeLearningKeyMetric()].targets += 1
                if data.firstTry[index] != nil { keys[key, default: QwertZnakeLearningKeyMetric()].attemptedTargets += 1 }
                if index < data.index, data.firstTry[index] == true { keys[key, default: QwertZnakeLearningKeyMetric()].correctFirstTry += 1 }
            }
            for key in keys.keys {
                let metric = data.keyMetrics[key] ?? QwertZnakeLearningKeyMetric()
                keys[key]?.attempts = metric.attempts
                keys[key]?.errors = metric.errors
                keys[key]?.corrections = metric.corrections
                keys[key]?.correct = max(0, metric.attempts - metric.errors)
                keys[key]?.streak = current.correctStreaks?[stage.rawValue + ":" + key] ?? 0
            }
            let attempted = data.firstTry.filter { $0 != nil }.count
            let correct = data.firstTry.prefix(data.index).filter { $0 == true }.count
            stages[stage.rawValue] = QwertZnakeLearningStageResult(
                targets: targets.count, completedTargets: data.index, attemptedTargets: attempted,
                correctFirstTry: correct, characterAttempts: data.characterAttempts, errors: data.errors,
                corrections: data.corrections, backspaces: data.backspaces, activeMs: data.activeMs,
                hintsUsed: data.hintsUsed, accuracy: attempted > 0 ? Double(correct) / Double(attempted) : 1,
                perKey: keys)
        }
        var targetCount = 0, firstCorrect = 0, attempts = 0, errors = 0, corrections = 0, backspaces = 0, activeMs = 0, hints = 0
        var perKey: [String: QwertZnakeLearningKeyMetric] = [:]
        for stage in [QwertZnakeLearningStage.feed, .write] {
            guard let data = stages[stage.rawValue] else { continue }
            targetCount += data.targets
            firstCorrect += data.correctFirstTry
            attempts += data.characterAttempts
            errors += data.errors
            corrections += data.corrections
            backspaces += data.backspaces
            activeMs += data.activeMs
            hints += data.hintsUsed
            for (key, metric) in data.perKey {
                perKey[key, default: QwertZnakeLearningKeyMetric()].targets += metric.targets
                perKey[key, default: QwertZnakeLearningKeyMetric()].attemptedTargets += metric.attemptedTargets
                perKey[key, default: QwertZnakeLearningKeyMetric()].correctFirstTry += metric.correctFirstTry
                perKey[key, default: QwertZnakeLearningKeyMetric()].attempts += metric.attempts
                perKey[key, default: QwertZnakeLearningKeyMetric()].errors += metric.errors
                perKey[key, default: QwertZnakeLearningKeyMetric()].corrections += metric.corrections
                perKey[key, default: QwertZnakeLearningKeyMetric()].correct += metric.correct
                perKey[key, default: QwertZnakeLearningKeyMetric()].streak = metric.streak
            }
        }
        return QwertZnakeLearningResult(id: current.id, lessonId: current.lessonId, curriculumVersion: current.curriculumVersion,
            completedAt: current.completedAt ?? Date(), stages: stages, targets: targetCount, correctFirstTry: firstCorrect,
            characterAttempts: attempts, errors: errors, corrections: corrections, backspaces: backspaces,
            activeMs: activeMs, hintsUsed: hints, perKey: perKey, introducedKeys: lesson.newKeys, taughtKeys: lesson.taughtKeys)
    }

    private func applyResult() {
        guard let current = session, current.stage == .result else { return }
        let result = makeResult(current)
        let index = profileIndex
        if !profiles[index].appliedResultIds.contains(result.id) {
            profiles[index].appliedResultIds.insert(result.id)
            profiles[index].results.append(result)
            profiles[index].results = Array(profiles[index].results.suffix(50))
            profiles[index].bestStars[result.lessonId] = max(profiles[index].bestStars[result.lessonId] ?? 0, result.stars)
            for (key, metric) in result.perKey {
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].targets += metric.targets
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].attemptedTargets += metric.attemptedTargets
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].correctFirstTry += metric.correctFirstTry
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].attempts += metric.attempts
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].errors += metric.errors
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].corrections += metric.corrections
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].correct += metric.correct
                profiles[index].keyMetrics[key, default: QwertZnakeLearningKeyMetric()].streak = metric.streak
            }
        }
        if needsArcadeChallenge {
            if profiles[index].pendingArcadeSession == nil || profiles[index].pendingArcadeSession?.id == current.id {
                profiles[index].pendingArcadeSession = current
            }
            profiles[index].currentLessonId = result.lessonId
        } else if let next = lessons.first(where: { $0.id == result.lessonId })?.nextLessonId {
            profiles[index].currentLessonId = next
        }
        profiles[index].resume = nil
        persist()
        syncClassroom()
    }

    private func tick() {
        guard reward == nil else { lastTick = nil; return }
        let now = Date()
        defer { lastTick = now }
        guard let previous = lastTick, var current = session,
              !current.paused, current.stage != .result,
              var data = current.stages[current.stage.rawValue] else { return }
        data.activeMs += max(0, Int(now.timeIntervalSince(previous) * 1000))
        current.stages[current.stage.rawValue] = data
        session = current
    }

    private func saveSession() {
        profiles[profileIndex].resume = stage == .result ? nil : session
        if needsArcadeChallenge,
           profiles[profileIndex].pendingArcadeSession == nil || profiles[profileIndex].pendingArcadeSession?.id == session?.id {
            profiles[profileIndex].pendingArcadeSession = session
        }
        persist()
    }

    private func persist() {
        let state = SavedState(curriculumVersion: curriculumVersion, activeProfileId: activeProfileId, profiles: profiles)
        do {
            defaults.set(try JSONEncoder().encode(state), forKey: Self.storageKey)
            storageMessage = nil
        } catch {
            storageMessage = "Dein Fortschritt konnte auf diesem Gerät gerade nicht gespeichert werden."
        }
    }

    nonisolated static func label(_ key: String) -> String { key == " " ? "Leertaste" : key == "backspace" ? "Rücktaste ⌫" : key.uppercased() }

    private static func loadCurriculum() -> Curriculum {
        if let url = Bundle.main.url(forResource: "QwertZnakeLessons", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let curriculum = try? JSONDecoder().decode(Curriculum.self, from: data),
           !curriculum.lessons.isEmpty, curriculum.curriculumVersion == "1.0.0",
           Set(curriculum.lessons.map(\.id)).count == curriculum.lessons.count,
           curriculum.lessons.allSatisfy({ lesson in
               [lesson.demoTargets, lesson.feedTargets, lesson.writeTargets].allSatisfy { !$0.isEmpty && $0.allSatisfy { $0.count == 1 && lesson.taughtKeys.contains($0) } }
           }) {
            return curriculum
        }
        let fallback = QwertZnakeLesson(id: "home-fj", title: "F und J finden", number: 1,
            newKeys: ["f", "j"], taughtKeys: ["f", "j"], oldKeys: [], demoTargets: ["f", "f", "j", "j"],
            feedTargets: Array(repeating: ["f", "j"], count: 6).flatMap { $0 },
            writeTargets: Array("fjjfffjj").map(String.init), writePrompts: ["fj", "jf", "ffjj"], nextLessonId: nil)
        return Curriculum(curriculumVersion: "1.0.0", lessons: [fallback])
    }

    private static func valid(resume: QwertZnakeLearningSession, curriculum: Curriculum) -> Bool {
        guard resume.curriculumVersion == curriculum.curriculumVersion,
              let lesson = curriculum.lessons.first(where: { $0.id == resume.lessonId }) else { return false }
        for stage in [QwertZnakeLearningStage.demo, .feed, .write] {
            let targets = lesson.targets(for: stage)
            guard let data = resume.stages[stage.rawValue], data.index >= 0, data.index <= targets.count,
                  data.firstTry.count == targets.count,
                  data.typed.count >= data.index, data.typed.count <= data.index + (stage == .write ? 1 : 0),
                  data.characterAttempts >= 0, data.errors >= 0, data.errors <= data.characterAttempts,
                  data.corrections >= 0, data.corrections <= data.backspaces, data.activeMs >= 0,
                  data.backspaces >= 0, data.hintsUsed >= 0,
                  data.firstTry.prefix(data.index).allSatisfy({ $0 != nil }),
                  data.typed.allSatisfy({ $0.count == 1 }),
                  data.typed.prefix(data.index).elementsEqual(targets.prefix(data.index)) else { return false }
            if lesson.isBackspaceLesson {
                guard let flags = data.guidedDeleted, flags.count == targets.count,
                      flags.prefix(data.index).allSatisfy({ $0 }) else { return false }
            }
            let order = QwertZnakeLearningStage.allCases
            if let past = order.firstIndex(of: stage), let current = order.firstIndex(of: resume.stage) {
                if past < current, data.index != targets.count { return false }
                if past > current, data.index != 0 || data.characterAttempts != 0 { return false }
                if past > current, lesson.isBackspaceLesson, data.guidedDeleted?.contains(true) == true { return false }
            }
            if data.typed.count > data.index,
               (data.index == targets.count || data.typed[data.index] == targets[data.index]) { return false }
            if resume.stage == .result, data.index != targets.count { return false }
        }
        return resume.stage != .result || resume.completedAt != nil
    }
}
