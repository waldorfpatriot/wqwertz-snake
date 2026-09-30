import Combine
import Foundation
import SwiftUI

struct QwertZnakeClassroomIdentity: Codable {
    var pupilId: String
    var token: String
    var name: String
}

struct QwertZnakeClassroomLesson: Decodable, Identifiable {
    var id: String
    var title: String
    var number: Int?
    var index: Int?
}

struct QwertZnakeClassroomCell: Decodable {
    var accuracyPercent: Int
    var correctFirstTry: Int
    var targets: Int
    var errors: Int
    var corrections: Int
    var activeMs: Int
    var attemptCount: Int
    var lastCompletedAt: Double
}

struct QwertZnakeClassroomRow: Decodable, Identifiable {
    var pupilId: String
    var name: String
    var cells: [String: QwertZnakeClassroomCell]
    var id: String { pupilId }
}

struct QwertZnakeClassroomClass: Decodable, Identifiable {
    var id: String
    var name: String
    var pupilCount: Int
}

struct QwertZnakeClassroomLeaderboard: Decodable {
    var curriculumVersion: String
    var lessons: [QwertZnakeClassroomLesson]
    var rows: [QwertZnakeClassroomRow]
    // Older classroom servers can still display their existing lesson table.
    var classes: [QwertZnakeClassroomClass]?
    var activeClassId: String?
    var classId: String?
}

struct QwertZnakeClassroomError: LocalizedError {
    var message: String
    var code: String
    var statusCode: Int? = nil
    var errorDescription: String? { message }
}

@MainActor
final class QwertZnakeClassroomClient: ObservableObject {
    @Published private(set) var serverURL: String
    @Published private(set) var status = ""
    @Published private(set) var isSyncing = false
    @Published private(set) var pendingCount = 0
    @Published private(set) var nameConflicts: Set<String> = []
    @Published private(set) var needsNameCorrection: Set<String> = []
    var onNameIssue: ((String, String?) -> Void)?

    private struct PendingResult: Codable {
        var profileId: String
        var result: QwertZnakeLearningResult
    }
    private struct Saved: Codable {
        var serverURL = ""
        var names: [String: String] = [:]
        // Identity and upload receipts are scoped to both server and local profile.
        var identities: [String: QwertZnakeClassroomIdentity] = [:]
        var enrollments: [String: String]?
        var quarantined: [String: [String]]?
        var uploaded: [String: [String]] = [:]
        var pending: [PendingResult] = []
    }
    private struct ErrorBody: Decodable { var error: String; var code: String? }
    private let storageKey = "qwertznake-native-classroom-v1"
    private let defaults: UserDefaults
    private let transport: URLSession
    private var saved: Saved

    init(defaults: UserDefaults = .standard, transport: URLSession = .shared) {
        self.defaults = defaults
        self.transport = transport
        saved = defaults.data(forKey: storageKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
        serverURL = saved.serverURL
        pendingCount = saved.pending.count
    }

    static func cleanedName(_ raw: String) -> String {
        String(raw.precomposedStringWithCompatibilityMapping.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ").prefix(40))
    }

    static func validName(_ name: String) -> Bool {
        guard !name.isEmpty, name.count <= 40, name.utf8.count <= 150,
              name.unicodeScalars.contains(where: { CharacterSet.alphanumerics.contains($0) }) else { return false }
        let punctuation = CharacterSet(charactersIn: " .'-’")
        return name.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || CharacterSet.nonBaseCharacters.contains($0) || punctuation.contains($0) }
    }

    func configureServer(_ raw: String) throws {
        let address = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if address.isEmpty {
            serverURL = ""; saved.serverURL = ""; nameConflicts = []; needsNameCorrection = []
            status = "Ohne Klassenserver bleiben Ergebnisse auf diesem Gerät vorgemerkt."; persist(); return
        }
        guard var parts = URLComponents(string: address), ["https", "http"].contains(parts.scheme?.lowercased() ?? ""),
              parts.host != nil, parts.user == nil, parts.password == nil else {
            throw QwertZnakeClassroomError(message: "Gib die vollständige Klassenserver-Adresse mit https:// oder http:// ein.", code: "INVALID_URL")
        }
        parts.query = nil; parts.fragment = nil
        guard let url = parts.url else { throw QwertZnakeClassroomError(message: "Diese Server-Adresse ist ungültig.", code: "INVALID_URL") }
        serverURL = url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        saved.serverURL = serverURL
        nameConflicts = []
        needsNameCorrection = []
        status = "Klassenserver gespeichert. Die Verbindung wird geprüft."
        persist()
    }

    func remember(profileId: String, name: String, results: [QwertZnakeLearningResult]) {
        let name = Self.cleanedName(name)
        guard Self.validName(name) else { return }
        var changed = saved.names[profileId] != name
        saved.names[profileId] = name
        let receiptIds = Set((saved.uploaded[identityKey(profileId)] ?? []) + (saved.quarantined?[identityKey(profileId)] ?? []))
        for result in results where result.stages["demo"] != nil && result.stages["feed"] != nil && result.stages["write"] != nil {
            guard !receiptIds.contains(result.id), !saved.pending.contains(where: { $0.profileId == profileId && $0.result.id == result.id }) else { continue }
            saved.pending.append(PendingResult(profileId: profileId, result: result))
            changed = true
        }
        if saved.pending.count > 5000 {
            // A long offline period still retains every pupil's best result for every lesson.
            var best: [String: PendingResult] = [:]
            for entry in saved.pending {
                let key = entry.profileId + ":" + entry.result.lessonId
                if let previous = best[key], previous.result.firstTryAccuracy > entry.result.firstTryAccuracy { continue }
                best[key] = entry
            }
            saved.pending = Array(best.values).sorted { $0.result.completedAt < $1.result.completedAt }
            status = "Viele Ergebnisse sind noch offline. Die besten Trefferwerte je Kind und Lektion bleiben vorgemerkt."
        }
        if changed { persist() }
    }

    func clearNameIssue(profileId: String) {
        nameConflicts.remove(profileId)
        needsNameCorrection.remove(profileId)
    }

    func syncNow() async {
        guard !isSyncing else { return }
        guard !serverURL.isEmpty else {
            status = pendingCount > 0 ? "\(pendingCount) Ergebnisse warten auf einen Klassenserver." : "Üben ist offline möglich. Verbinde für die gemeinsame Tabelle einen Klassenserver."
            return
        }
        isSyncing = true
        defer { isSyncing = false }
        let server = serverURL
        var failures: [String] = []
        var verifiedServer = false
        for (profileId, name) in saved.names.sorted(by: { $0.key < $1.key }) {
            guard serverURL == server, !Task.isCancelled else { return }
            if needsNameCorrection.contains(profileId) { continue }
            let scope = identityKey(profileId, server: server)
            var identity = saved.identities[scope]
            do {
                if var existing = identity {
                    if !verifiedServer {
                        let data = try await request(server: server, path: "api/learning/me", token: existing.token)
                        existing.name = try JSONDecoder().decode(QwertZnakeClassroomIdentityResponse.self, from: data).name
                        verifiedServer = true
                    }
                    identity = existing
                } else {
                    let enrollment: String
                    if let existing = saved.enrollments?[scope] { enrollment = existing }
                    else {
                        enrollment = (0..<32).map { _ in String(format: "%02x", UInt8.random(in: .min ... .max)) }.joined()
                        if saved.enrollments == nil { saved.enrollments = [:] }
                        saved.enrollments?[scope] = enrollment
                        persist() // Keep the same credential if the first server response is lost.
                    }
                    let data = try await request(server: server, path: "api/learning/pupils", method: "POST", body: ["name": name, "enrollmentKey": enrollment])
                    identity = try JSONDecoder().decode(QwertZnakeClassroomIdentity.self, from: data)
                    verifiedServer = true
                }
                guard let owned = identity else { continue }
                if owned.name != name {
                    let data = try await request(server: server, path: "api/learning/me", method: "PATCH", token: owned.token, body: ["name": name])
                    identity?.name = try JSONDecoder().decode(QwertZnakeClassroomIdentityResponse.self, from: data).name
                }
                guard serverURL == server, saved.names[profileId] == name else { continue }
                saved.identities[scope] = identity
                nameConflicts.remove(profileId)
                persist()
            } catch {
                guard serverURL == server else { return }
                if let failure = error as? QwertZnakeClassroomError, ["NAME_TAKEN", "INVALID_NAME"].contains(failure.code) {
                    let acceptedName = identity?.name
                    if let acceptedName {
                        // A failed rename keeps the existing classroom identity and clears the rejected alias.
                        saved.names[profileId] = acceptedName
                        saved.identities[scope] = identity
                        onNameIssue?(profileId, acceptedName)
                    } else {
                        needsNameCorrection.insert(profileId)
                        onNameIssue?(profileId, nil)
                    }
                    if failure.code == "NAME_TAKEN" { nameConflicts.insert(profileId) }
                    failures.append(failure.code == "NAME_TAKEN"
                        ? "Der Name „\(name)“ ist bereits vergeben. Ergänze zum Beispiel den Anfangsbuchstaben des Nachnamens."
                        : failure.message)
                    persist()
                    if acceptedName == nil { continue }
                } else {
                    failures.append(error.localizedDescription + " Ergebnisse bleiben vorgemerkt; du kannst weiterüben.")
                    continue
                }
            }
            guard let owned = identity else { continue }
            for entry in saved.pending.filter({ $0.profileId == profileId }) {
                guard serverURL == server, !Task.isCancelled else { return }
                do {
                    let payload = try JSONEncoder().encode(ResultBody(result: entry.result))
                    let data = try await request(server: server, path: "api/learning/results", method: "POST", token: owned.token, encodedBody: payload)
                    guard let receipt = try? JSONDecoder().decode(ResultReceipt.self, from: data),
                          !receipt.receiptId.isEmpty, receipt.resultId == entry.result.id,
                          receipt.acceptedAt.isFinite, receipt.acceptedAt >= 0 else {
                        throw QwertZnakeClassroomError(message: "Der Klassenserver hat dieses Ergebnis noch nicht gültig bestätigt.", code: "INVALID_RECEIPT")
                    }
                    guard serverURL == server else { return }
                    saved.pending.removeAll { $0.profileId == profileId && $0.result.id == entry.result.id }
                    var receipts = saved.uploaded[scope] ?? []
                    if !receipts.contains(entry.result.id) { receipts.append(entry.result.id) }
                    saved.uploaded[scope] = Array(receipts.suffix(1000))
                    persist()
                } catch {
                    guard serverURL == server else { return }
                    let failure = error as? QwertZnakeClassroomError
                    let permanent = failure?.statusCode.map { (400..<500).contains($0) && ![401, 403, 408, 429].contains($0) } ?? false
                    if permanent {
                        // Retain local progress, isolate the rejected ID, and continue with later valid results.
                        saved.pending.removeAll { $0.profileId == profileId && $0.result.id == entry.result.id }
                        if saved.quarantined == nil { saved.quarantined = [:] }
                        var ids = saved.quarantined?[scope] ?? []
                        if !ids.contains(entry.result.id) { ids.append(entry.result.id) }
                        saved.quarantined?[scope] = Array(ids.suffix(1000))
                        persist()
                        failures.append("Ein Ergebnis konnte nicht übertragen werden. Dein Lernfortschritt bleibt erhalten. " + error.localizedDescription)
                    } else {
                        failures.append(error.localizedDescription + " Ergebnisse bleiben vorgemerkt; du kannst weiterüben.")
                        break
                    }
                }
            }
        }
        if let failure = failures.first { status = failure }
        else if !needsNameCorrection.isEmpty { /* Keep the specific name correction visible. */ }
        else if !verifiedServer { status = "Klassenserver gespeichert. Gib deinen Namen ein oder öffne die Tabelle der Lehrkraft." }
        else { status = pendingCount == 0 ? "Mit dem Klassenserver verbunden. Alle Ergebnisse sind übertragen." : "\(pendingCount) Ergebnisse warten auf die Übertragung." }
    }

    func leaderboard(password: String) async throws -> QwertZnakeClassroomLeaderboard {
        guard !serverURL.isEmpty else { throw QwertZnakeClassroomError(message: "Trage zuerst den Klassenserver ein.", code: "NO_SERVER") }
        let data = try await request(server: serverURL, path: "api/learning/leaderboard", adminPassword: password)
        return try JSONDecoder().decode(QwertZnakeClassroomLeaderboard.self, from: data)
    }

    func createClass(name: String, password: String) async throws -> QwertZnakeClassroomLeaderboard {
        try await manageClassroom(path: "api/learning/classes", method: "POST", password: password, body: ["name": name])
    }

    func selectClass(classId: String, password: String) async throws -> QwertZnakeClassroomLeaderboard {
        try await manageClassroom(path: "api/learning/classes/active", method: "PATCH", password: password, body: ["classId": classId])
    }

    func movePupil(pupilId: String, classId: String, password: String) async throws -> QwertZnakeClassroomLeaderboard {
        try await manageClassroom(path: "api/learning/pupils/" + pupilId, method: "PATCH", password: password, body: ["classId": classId])
    }

    func deletePupil(pupilId: String, password: String) async throws -> QwertZnakeClassroomLeaderboard {
        try await manageClassroom(path: "api/learning/pupils/" + pupilId, method: "DELETE", password: password)
    }

    private func manageClassroom(path: String, method: String, password: String, body: [String: String]? = nil) async throws -> QwertZnakeClassroomLeaderboard {
        guard !serverURL.isEmpty else { throw QwertZnakeClassroomError(message: "Trage zuerst den Klassenserver ein.", code: "NO_SERVER") }
        let data = try await request(server: serverURL, path: path, method: method, adminPassword: password, body: body)
        return try JSONDecoder().decode(QwertZnakeClassroomLeaderboard.self, from: data)
    }

    private struct ResultBody: Encodable { var result: QwertZnakeLearningResult }
    private struct ResultReceipt: Decodable { var receiptId: String; var resultId: String; var duplicate: Bool; var acceptedAt: Double }
    private struct QwertZnakeClassroomIdentityResponse: Decodable { var name: String }

    private func identityKey(_ profileId: String, server: String? = nil) -> String { (server ?? serverURL) + "|" + profileId }

    private func request(server: String, path: String, method: String = "GET", token: String? = nil,
                         adminPassword: String? = nil, body: [String: String]? = nil, encodedBody: Data? = nil) async throws -> Data {
        guard let base = URL(string: server) else { throw QwertZnakeClassroomError(message: "Die Klassenserver-Adresse fehlt.", code: "NO_SERVER") }
        var request = URLRequest(url: base.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 12
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let adminPassword { request.setValue(adminPassword, forHTTPHeaderField: "x-admin-password") }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        if let encodedBody { request.httpBody = encodedBody }
        if request.httpBody != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await transport.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            let failure = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw QwertZnakeClassroomError(message: failure?.error ?? "Der Klassenserver ist gerade nicht erreichbar.", code: failure?.code ?? "REQUEST_FAILED", statusCode: (response as? HTTPURLResponse)?.statusCode)
        }
        return data
    }

    private func persist() {
        pendingCount = saved.pending.count
        if let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: storageKey) }
    }
}

struct QwertZnakeClassroomSettingsView: View {
    @ObservedObject var classroom: QwertZnakeClassroomClient
    var onClose: () -> Void
    @State private var address = ""
    @State private var error = ""
    @State private var showMatrix = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Text("Klassenserver").font(.title.bold()); Spacer(); Button("Fertig", action: onClose) }
            Text("Alle Geräte einer Klasse verwenden dieselbe Server-Adresse. Die Lehrkraft zeigt die gemeinsame Tabelle mit ihrem Admin-Passwort.")
                .foregroundStyle(.secondary)
            TextField("https://klassenserver.example", text: $address).textFieldStyle(.roundedBorder)
                .autocorrectionDisabled().onSubmit { connect() }
            Text("Für einen Server im Schulnetz: http://192.168.…:3080. „localhost“ erreicht nur dieses Gerät.")
                .font(.caption).foregroundStyle(.secondary)
            Button("Speichern und verbinden", action: connect).buttonStyle(.borderedProminent)
            if !error.isEmpty { Text(error).foregroundStyle(.red) }
            Text(classroom.status).font(.callout).foregroundStyle(.secondary)
            if classroom.isSyncing { ProgressView("Ergebnisse übertragen …") }
            Button("Gemeinsame Lektionstabelle", systemImage: "tablecells") { showMatrix = true }
                .buttonStyle(.bordered).disabled(classroom.serverURL.isEmpty)
            Spacer(minLength: 0)
        }
        .padding(24).frame(minWidth: 320, idealWidth: 560, minHeight: 340)
        .onAppear { address = classroom.serverURL }
        .sheet(isPresented: $showMatrix) { QwertZnakeClassroomMatrixView(classroom: classroom) }
    }

    private func connect() {
        do { try classroom.configureServer(address); error = ""; Task { await classroom.syncNow() } }
        catch { self.error = error.localizedDescription }
    }
}

struct QwertZnakeClassroomMatrixView: View {
    @ObservedObject var classroom: QwertZnakeClassroomClient
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var password = ""
    @State private var board: QwertZnakeClassroomLeaderboard?
    @State private var error = ""
    @State private var isLoading = false
    @State private var unlocked = false
    @State private var lastUpdated: Date?
    @State private var refreshId = UUID()
    @State private var active = false
    @State private var generation = UUID()
    @State private var showClassForm = false
    @State private var newClassName = ""
    @State private var pupilToDelete: QwertZnakeClassroomRow?
    @State private var showDeleteConfirmation = false
    private let nameWidth: CGFloat = 180
    private let managementWidth: CGFloat = 140
    private let lessonWidth: CGFloat = 125
    private let rowHeight: CGFloat = 54

    private enum TeacherAction {
        case selectClass(String)
        case createClass(String)
        case movePupil(String, String)
        case deletePupil(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Treffer beim Tippen").font(.title.bold())
                Spacer()
                if unlocked { Button("Aktualisieren", systemImage: "arrow.clockwise") { Task { await refresh() } }.disabled(isLoading) }
                Button("Schließen") { clearPrivateState(); dismiss() }
            }
            Text("Jede Zeile zeigt ein Kind. Jede Lektion zeigt den besten Anteil der Zeichen, die beim ersten Versuch richtig waren. Noch nicht begonnen: —.")
                .font(.callout).foregroundStyle(.secondary)
            if !unlocked {
                HStack {
                    SecureField("Admin-Passwort der Lehrkraft", text: $password).textFieldStyle(.roundedBorder)
                        .onSubmit { Task { await refresh() } }.disabled(isLoading)
                    Button("Tabelle öffnen") { Task { await refresh() } }.buttonStyle(.borderedProminent)
                        .disabled(password.isEmpty || isLoading)
                }
                Text("Das Passwort bleibt nur während dieser geöffneten Ansicht im Speicher.").font(.caption).foregroundStyle(.secondary)
            }
            if !error.isEmpty { Text(error).foregroundStyle(.red).font(.callout) }
            if isLoading, board == nil { ProgressView("Tabelle laden …") }
            if unlocked, let board {
                classControls(board)
                matrix(board)
            }
            if let lastUpdated {
                Text("Aktualisiert um \(lastUpdated.formatted(date: .omitted, time: .standard)). Aktualisierung alle 5 Sekunden.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(20).frame(minWidth: 340, idealWidth: 1050, minHeight: 500)
        .task(id: "\(refreshId):\(scenePhase)") {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(5)) } catch { return }
                if unlocked { await refresh() }
            }
        }
        .onAppear { active = true; generation = UUID() }
        .onDisappear { active = false; clearPrivateState() }
        .onChange(of: classroom.serverURL) { _, _ in clearPrivateState() }
        .alert("Kind löschen?", isPresented: $showDeleteConfirmation, presenting: pupilToDelete) { pupil in
            Button("Abbrechen", role: .cancel) { pupilToDelete = nil }
            Button("Kind löschen", role: .destructive) {
                pupilToDelete = nil
                Task { await manage(.deletePupil(pupil.pupilId)) }
            }.disabled(isLoading)
        } message: { pupil in
            Text("„\(pupil.name)“ und alle zugehörigen Ergebnisse werden vom Klassenserver gelöscht. Dies kann nicht rückgängig gemacht werden. Der Lernfortschritt auf dem Gerät bleibt erhalten.")
        }
    }

    @ViewBuilder
    private func classControls(_ board: QwertZnakeClassroomLeaderboard) -> some View {
        if let classes = board.classes, !classes.isEmpty, let currentClassId = board.activeClassId ?? board.classId {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Aktive Klasse").font(.headline)
                    Picker("Aktive Klasse", selection: Binding(
                        get: { self.board?.activeClassId ?? self.board?.classId ?? currentClassId },
                        set: { classId in
                            guard classId != (self.board?.activeClassId ?? self.board?.classId) else { return }
                            Task { await manage(.selectClass(classId)) }
                        }
                    )) {
                        ForEach(classes) { item in
                            Text("\(item.name) (\(item.pupilCount))").tag(item.id)
                        }
                    }
                    .pickerStyle(.menu).labelsHidden().disabled(isLoading)
                    Spacer()
                    Button("Neue Klasse", systemImage: "plus") { showClassForm = true }
                        .buttonStyle(.bordered).disabled(isLoading || showClassForm)
                    if isLoading { ProgressView().accessibilityLabel("Klasse wird aktualisiert") }
                }
                if let selected = classes.first(where: { $0.id == currentClassId }) {
                    Text("Neue Anmeldungen werden automatisch „\(selected.name)“ zugeordnet. Diese Auswahl gilt für alle Geräte am Klassenserver. Bereits angemeldete Kinder bleiben in ihrer Klasse.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if showClassForm {
                    HStack {
                        TextField("Name der neuen Klasse", text: $newClassName)
                            .textFieldStyle(.roundedBorder).disabled(isLoading)
                            .onSubmit { createClass() }
                        Button("Klasse anlegen") { createClass() }.buttonStyle(.borderedProminent)
                            .disabled(newClassName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                        Button("Abbrechen") { showClassForm = false; newClassName = "" }.disabled(isLoading)
                    }
                }
            }
        } else {
            Text("Dieser Klassenserver unterstützt noch keine Klassenlisten. Aktualisiere den Server, um Klassen anzulegen und Kinder zu verwalten.")
                .font(.callout).foregroundStyle(.secondary)
        }
    }

    private func matrix(_ board: QwertZnakeClassroomLeaderboard) -> some View {
        ScrollView([.horizontal, .vertical]) {
            Grid(horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    cell("Name", width: nameWidth, header: true)
                    if board.classes != nil { cell("Verwalten", width: managementWidth, header: true) }
                    ForEach(board.lessons) { lesson in lessonHeader(lesson) }
                }
                ForEach(board.rows) { row in matrixRow(row, board: board) }
            }
            if board.rows.isEmpty { Text("Noch keine Kinder angemeldet.").padding(20) }
        }
        .background(.secondary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
    }

    private func lessonHeader(_ lesson: QwertZnakeClassroomLesson) -> some View {
        let number = lesson.number ?? ((lesson.index ?? 0) + 1)
        return cell("\(number). \(lesson.title)", width: lessonWidth, header: true)
    }

    private func matrixRow(_ row: QwertZnakeClassroomRow, board: QwertZnakeClassroomLeaderboard) -> some View {
        GridRow {
            cell(row.name, width: nameWidth)
            if let classes = board.classes {
                Menu {
                    let destinations = classes.filter { $0.id != (board.classId ?? board.activeClassId) }
                    if !destinations.isEmpty {
                        Menu("In andere Klasse verschieben", systemImage: "arrow.right") {
                            ForEach(destinations) { item in
                                Button(item.name) { Task { await manage(.movePupil(row.pupilId, item.id)) } }
                            }
                        }
                    }
                    Button("Kind löschen", systemImage: "trash", role: .destructive) {
                        pupilToDelete = row
                        showDeleteConfirmation = true
                    }
                } label: {
                    Label("Verwalten", systemImage: "ellipsis.circle")
                        .font(.callout).frame(width: managementWidth - 16, height: rowHeight)
                        .padding(.horizontal, 8)
                        .overlay(Rectangle().stroke(Color.secondary.opacity(0.15), lineWidth: 0.5))
                }
                .disabled(isLoading).accessibilityLabel("\(row.name) verwalten")
            }
            ForEach(board.lessons) { lesson in scoreCell(row.cells[lesson.id]) }
        }
    }

    private func scoreCell(_ result: QwertZnakeClassroomCell?) -> some View {
        let text = result.map { "\($0.accuracyPercent) %" } ?? "—"
        let hint = result.map { "\($0.correctFirstTry) von \($0.targets) Zeichen sofort richtig · \($0.attemptCount) Versuche" } ?? "Noch nicht begonnen"
        return cell(text, width: lessonWidth, help: hint)
    }

    private func cell(_ text: String, width: CGFloat, header: Bool = false, help: String = "") -> some View {
        Text(text).font(header ? Font.caption.bold() : Font.callout).multilineTextAlignment(.leading)
            .frame(width: width - 16, height: rowHeight, alignment: .leading).padding(.horizontal, 8)
            .background(header ? Color.secondary.opacity(0.13) : Color.clear)
            .overlay(Rectangle().stroke(Color.secondary.opacity(0.15), lineWidth: 0.5))
            .help(help).accessibilityLabel(help.isEmpty ? text : text + ". " + help)
    }

    @MainActor private func refresh() async {
        guard active, !isLoading, !password.isEmpty else { return }
        let requestGeneration = generation
        let server = classroom.serverURL
        let secret = password
        isLoading = true
        defer { if generation == requestGeneration { isLoading = false } }
        do {
            let updated = try await classroom.leaderboard(password: secret)
            guard active, generation == requestGeneration, classroom.serverURL == server, !Task.isCancelled else { return }
            board = updated; error = ""; unlocked = true; lastUpdated = Date()
        } catch {
            guard active, generation == requestGeneration, classroom.serverURL == server, !Task.isCancelled else { return }
            self.error = error.localizedDescription
            if let failure = error as? QwertZnakeClassroomError, failure.statusCode == 401 || failure.statusCode == 403 { lockTable() }
        }
    }

    private func createClass() {
        let name = newClassName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        Task { await manage(.createClass(name)) }
    }

    @MainActor private func manage(_ action: TeacherAction) async {
        guard active, unlocked, !isLoading, !password.isEmpty else { return }
        let requestGeneration = generation
        let server = classroom.serverURL
        let secret = password
        isLoading = true
        defer { if generation == requestGeneration { isLoading = false } }
        do {
            let updated: QwertZnakeClassroomLeaderboard
            switch action {
            case .selectClass(let classId):
                updated = try await classroom.selectClass(classId: classId, password: secret)
            case .createClass(let name):
                updated = try await classroom.createClass(name: name, password: secret)
            case .movePupil(let pupilId, let classId):
                updated = try await classroom.movePupil(pupilId: pupilId, classId: classId, password: secret)
            case .deletePupil(let pupilId):
                updated = try await classroom.deletePupil(pupilId: pupilId, password: secret)
            }
            guard active, generation == requestGeneration, classroom.serverURL == server, !Task.isCancelled else { return }
            board = updated; error = ""; lastUpdated = Date()
            if case .createClass = action { showClassForm = false; newClassName = "" }
        } catch {
            guard active, generation == requestGeneration, classroom.serverURL == server, !Task.isCancelled else { return }
            self.error = error.localizedDescription
            if let failure = error as? QwertZnakeClassroomError, failure.statusCode == 401 || failure.statusCode == 403 { lockTable() }
        }
    }

    private func lockTable() {
        unlocked = false; board = nil; lastUpdated = nil
        showClassForm = false; newClassName = ""; pupilToDelete = nil; showDeleteConfirmation = false
    }

    private func clearPrivateState() {
        generation = UUID(); password = ""; isLoading = false; error = ""
        lockTable()
    }
}
