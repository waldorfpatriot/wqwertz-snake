import SwiftUI

struct QwertZnakeLearningView: View {
    @ObservedObject var model: QwertZnakeLearningModel
    @ObservedObject private var classroom: QwertZnakeClassroomClient
    var onArcade: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var lessonFocused: Bool
    @FocusState private var nicknameFocused: Bool
    @State private var creatingProfile = false
    @State private var editingName = false
    @State private var classroomSettings = false
    @State private var nickname = ""
    @State private var pressedKeys: Set<String> = []
    @State private var spaceHeld = false
    @State private var helpPinned = false

    private let accent = Color(red: 0.72, green: 0.93, blue: 0.53)
    private var helpVisible: Bool {
        model.shouldShowFingerHelp(pinned: helpPinned)
    }
    private var displayedStage: QwertZnakeLearningStage? { model.reward?.completedStage ?? model.stage }
    private var displayedTargets: [String] {
        guard let stage = displayedStage else { return [] }
        return model.lesson?.targets(for: stage) ?? []
    }
    private var displayedIndex: Int { model.reward?.targetCount ?? model.targetIndex }
    private var highlightedKey: String? { model.needsBackspace ? "backspace" : model.expectedKey }

    init(model: QwertZnakeLearningModel, onArcade: @escaping () -> Void) {
        self.model = model
        classroom = model.classroom
        self.onArcade = onArcade
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 20) {
                    if let message = model.storageMessage {
                        Text(message).foregroundStyle(.orange).font(.callout)
                    }
                    if !classroom.status.isEmpty { classroomStatus }
                    if model.requiresName { nameGate }
                    else if model.session == nil { home }
                    else if model.bridgeIndex != nil || model.reward?.isBridge == true { bridge }
                    else if model.reward != nil { lesson }
                    else if model.needsArcadeChallenge {
                        LearningArcadeChallenge(model: model, game: model.arcadeGame) { lessonFocused = true }
                    }
                    else if model.stage == .result { result }
                    else { lesson }
                }
                .frame(maxWidth: 950)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            if !model.requiresName, model.session != nil, model.stage != .result || model.bridgeIndex != nil || model.reward != nil {
                learningKeyboard
            }
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.08))
        .foregroundStyle(.white)
        .accessibilityHidden(model.reward?.phase == .celebration)
        .overlay {
            if let reward = model.reward {
                LearningRewardPresentation(reward: reward, paused: model.isPaused,
                    onPhase: { model.updateRewardPhase($0, id: $1) },
                    onFinish: { model.finishReward(id: $0); pressedKeys.removeAll(); lessonFocused = true },
                    onHome: { model.goHome(); pressedKeys.removeAll(); lessonFocused = true })
            }
        }
        .focusable()
        .focused($lessonFocused)
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            if model.requiresName { nicknameFocused = true } else { lessonFocused = true }
            while !Task.isCancelled {
                model.syncClassroom()
                do { try await Task.sleep(for: .seconds(15)) } catch { return }
            }
        }
        .onKeyPress(phases: [.down, .repeat, .up]) { event in
            handleKey(event)
        }
        .onChange(of: model.stage) { _, _ in helpPinned = false }
        .onChange(of: model.reward?.id) { _, _ in pressedKeys.removeAll() }
        .onChange(of: lessonFocused) { _, focused in
            if !focused { pressedKeys.removeAll(); spaceHeld = false }
        }
        .onChange(of: model.session?.id) { _, id in
            if id == nil { pressedKeys.removeAll(); spaceHeld = false }
        }
        .onChange(of: model.activeProfileId) { _, _ in
            nickname = model.requiresName ? "" : model.profile.nickname
            nicknameFocused = model.requiresName
            lessonFocused = !model.requiresName
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                model.suspend()
                pressedKeys.removeAll()
                spaceHeld = false
            } else if !creatingProfile { lessonFocused = true }
        }
        .onDisappear {
            model.suspend()
            pressedKeys.removeAll()
            spaceHeld = false
        }
        .sheet(isPresented: $creatingProfile, onDismiss: {
            nicknameFocused = false
            lessonFocused = true
        }) {
            profileForm
        }
        .sheet(isPresented: $classroomSettings) {
            QwertZnakeClassroomSettingsView(classroom: classroom) { classroomSettings = false; lessonFocused = true }
        }
    }

    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 14) {
                title
                Spacer()
                profileMenu
                navigationButtons
            }
            VStack(alignment: .leading, spacing: 12) {
                HStack { title; Spacer(); profileMenu }
                navigationButtons
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(.white.opacity(0.04))
    }

    private var title: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Tippen lernen").font(.system(size: 25, weight: .black, design: .rounded))
            Text(model.lesson?.title ?? "Dein kleines Schlangenabenteuer")
                .font(.subheadline).foregroundStyle(.white.opacity(0.65))
        }
    }

    private var profileMenu: some View {
        Menu {
            ForEach(model.profiles) { profile in
                Button {
                    pressedKeys.removeAll()
                    model.switchProfile(profile.id)
                } label: {
                    if profile.id == model.activeProfileId { Label(profile.nickname, systemImage: "checkmark") }
                    else { Text(profile.nickname) }
                }
            }
            Divider()
            Button("Namen ändern", systemImage: "pencil") {
                model.suspend(); pressedKeys.removeAll()
                editingName = true; nickname = model.requiresName ? "" : model.profile.nickname
                creatingProfile = true
            }
            Button("Neues Lernprofil", systemImage: "person.badge.plus") {
                model.suspend()
                pressedKeys.removeAll()
                nickname = ""
                editingName = false
                creatingProfile = true
            }
        } label: {
            Label(model.profile.nickname.isEmpty ? "Name eingeben" : model.profile.nickname, systemImage: "person.crop.circle")
                .lineLimit(1).frame(maxWidth: 180)
        }
        .buttonStyle(.bordered)
    }

    private var navigationButtons: some View {
        HStack(spacing: 10) {
            Button("Klasse", systemImage: "tablecells") {
                model.suspend(); pressedKeys.removeAll(); classroomSettings = true
            }.buttonStyle(.bordered)
            if model.session != nil {
                Button("Lektionen", systemImage: "square.grid.2x2") {
                    model.goHome()
                    pressedKeys.removeAll()
                    lessonFocused = true
                }.buttonStyle(.bordered)
                if model.stage != .result || model.bridgeIndex != nil || model.reward != nil || model.needsArcadeChallenge {
                    Button(model.isPaused ? "Weiter" : "Pause", systemImage: model.isPaused ? "play.fill" : "pause.fill") {
                        model.togglePause()
                        pressedKeys.removeAll()
                        lessonFocused = true
                    }.buttonStyle(.bordered)
                }
            }
            Button("Arcade spielen", systemImage: "gamecontroller") {
                model.suspend()
                onArcade()
            }.buttonStyle(.bordered).disabled(model.requiresName)
        }
    }

    private var nameGate: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Wie heißt du?").font(.system(size: 34, weight: .black, design: .rounded))
            Text("Gib zuerst deinen Namen ein. So bleiben deine Ergebnisse bei dir und erscheinen in der gemeinsamen Lektionstabelle.")
                .font(.title3).foregroundStyle(.white.opacity(0.75))
            TextField("Dein Name", text: $nickname).textFieldStyle(.roundedBorder)
                .focused($nicknameFocused).onSubmit { enterNameAndStart() }
            Text("Zum Beispiel Mia K. Bei gleichen Vornamen ergänzt ihr den Anfangsbuchstaben des Nachnamens.")
                .font(.callout).foregroundStyle(.white.opacity(0.65))
            Button("Mit meinem Namen starten", systemImage: "play.fill", action: enterNameAndStart)
                .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                .disabled(!QwertZnakeClassroomClient.validName(QwertZnakeClassroomClient.cleanedName(nickname)))
            Text("Dein bisheriger Lernfortschritt bleibt erhalten. Auch ohne Verbindung kannst du üben; Ergebnisse werden später übertragen.")
                .font(.caption).foregroundStyle(.white.opacity(0.6))
        }
        .padding(24).frame(maxWidth: .infinity, alignment: .leading)
        .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
        .onAppear {
            if model.requiresName { nickname = model.profile.nickname == "Lernkind" ? "" : model.profile.nickname; nicknameFocused = true }
        }
    }

    private var classroomStatus: some View {
        HStack(spacing: 12) {
            Text(classroom.status).font(.callout).foregroundStyle(.white.opacity(0.72))
            Spacer()
            if classroom.isSyncing { ProgressView().controlSize(.small) }
            if classroom.nameConflicts.contains(model.activeProfileId) {
                Button("Namen ändern") {
                    model.suspend(); editingName = true; nickname = model.profile.nickname; creatingProfile = true
                }.buttonStyle(.bordered)
            } else if classroom.serverURL.isEmpty {
                Button("Klassenserver verbinden") { model.suspend(); classroomSettings = true }.buttonStyle(.bordered)
            }
        }
        .padding(12).background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 12))
    }

    private func enterNameAndStart() {
        guard QwertZnakeClassroomClient.validName(QwertZnakeClassroomClient.cleanedName(nickname)) else { return }
        model.renameProfile(nickname)
        nicknameFocused = false; lessonFocused = true
        model.resumeCurrent()
    }

    private var home: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Ein Buchstabe. Ein Snack. Ein kleiner Erfolg.")
                    .font(.system(size: 30, weight: .black, design: .rounded))
                Text("Deine Schlange wartet auf dich. Entdecke zwei neue Tasten, füttere sie und schreibe deine ersten Wörter. Fehler darfst du in Ruhe korrigieren.")
                    .font(.title3).foregroundStyle(.white.opacity(0.76))
                Text("Am besten übst du mit einer angeschlossenen QWERTZ-Tastatur. Die Bildschirmtasten helfen dir beim Ausprobieren.")
                    .font(.callout).foregroundStyle(.white.opacity(0.6))
                Button {
                    model.resumeCurrent()
                    lessonFocused = true
                } label: {
                    Label(model.hasResume ? "Lektion fortsetzen" : "Los geht’s: \(model.currentLessonTitle)", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                .controlSize(.large)
            }
            .padding(24).frame(maxWidth: .infinity, alignment: .leading)
            .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))

            garden

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 14)], spacing: 14) {
                ForEach(model.lessons) { lesson in
                    Button {
                        model.start(lesson.id, resume: model.profile.resume?.lessonId == lesson.id)
                        lessonFocused = true
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Lektion \(lesson.number)").font(.caption).foregroundStyle(.white.opacity(0.6))
                                Spacer()
                                if !model.available(lesson) { Image(systemName: "lock.fill").font(.caption) }
                            }
                            Text(lesson.title).font(.headline)
                            Text((lesson.newKeys + (lesson.newControlKeys ?? [])).map(QwertZnakeLearningModel.label).joined(separator: " · "))
                                .font(.title3.weight(.bold)).foregroundStyle(accent)
                            Text(starsText(model.profile.bestStars[lesson.id] ?? 0))
                                .foregroundStyle(.yellow)
                        }
                        .frame(maxWidth: .infinity, minHeight: 105, alignment: .leading)
                        .padding(16)
                        .background(.white.opacity(model.available(lesson) ? 0.07 : 0.025), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain).disabled(!model.available(lesson))
                    .accessibilityLabel("Lektion \(lesson.number), \(lesson.title), \(model.available(lesson) ? "verfügbar" : "nach der vorherigen Lektion verfügbar")")
                }
            }
            Text("Jeder Abschluss öffnet die nächste Lektion. Ab 90 % Genauigkeit empfehlen wir weiterzugehen; du entscheidest selbst.")
                .font(.callout).foregroundStyle(.white.opacity(0.65))
            Text("Nach jeder dritten Lektion wartet eine Arcade-Runde: Sammle 10 Punkte mit den Tasten, die du schon gelernt hast.")
                .font(.callout).foregroundStyle(accent)
        }
    }

    private var lesson: some View {
        VStack(spacing: 18) {
            HStack {
                Text(displayedStage?.title ?? "").font(.headline)
                Spacer()
                Text(model.lesson?.isBackspaceLesson == true ? "\(displayedIndex) / \(displayedTargets.count) Löschrunden" : displayedStage == .feed ? "\(displayedIndex) / \(displayedTargets.count) Snacks" : "\(displayedIndex) / \(displayedTargets.count)")
                    .monospacedDigit().foregroundStyle(accent)
            }
            ProgressView(value: Double(displayedIndex), total: Double(max(1, displayedTargets.count))).tint(accent)
            if model.isPaused, model.reward == nil {
                VStack(spacing: 14) {
                    Text("Deine Schlange macht Pause.").font(.title2.weight(.bold))
                    Text("Alles ist gespeichert. Mit Weiter oder Escape geht es weiter.")
                    Button("Weiter", systemImage: "play.fill") { model.togglePause(); lessonFocused = true }
                        .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                }.padding(30)
            } else {
                targetCard
                if model.lesson?.isBackspaceLesson == true, model.reward == nil { guidedCorrectionCard }
                LearningSnakeBoard(step: displayedIndex, total: displayedTargets.count,
                    colorName: model.profile.snakeColor, hat: model.profile.hat,
                    applePhase: model.reward?.phase.apple ?? .whole)
                    .frame(height: 200)
                if model.reward == nil {
                    if displayedStage == .demo { demoInstructions }
                    else if displayedStage == .write { writingPrompt }
                    fingerHelp
                    feedback
                } else {
                    Text(model.isPaused ? "Die Belohnung macht Pause. Mit Weiter geht es weiter." : "Deine Schlange knabbert am Apfel.")
                        .font(.callout.weight(.semibold)).foregroundStyle(accent)
                }
            }
        }
    }

    private var targetCard: some View {
        VStack(spacing: 4) {
            Text(model.reward != nil ? "Apfel erreicht!" : model.needsBackspace ? "Zuerst korrigieren" : "Tippe diese Taste")
                .font(.subheadline).foregroundStyle(.white.opacity(0.64))
            Text(model.reward != nil ? "✓" : model.needsBackspace ? "⌫" : (model.expectedKey == " " ? "␣" : model.expectedKey?.uppercased() ?? ""))
                .font(.system(size: 70, weight: .black, design: .rounded))
                .foregroundStyle(model.lastCorrect == false ? .orange : accent)
            if model.expectedKey == " ", !model.needsBackspace { Text("Leertaste · mit dem Daumen").font(.headline) }
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18))
        .animation(.easeOut(duration: 0.16), value: model.expectedKey)
    }

    private var demoInstructions: some View {
        VStack(spacing: 12) {
            if model.lesson?.isBackspaceLesson == true {
                Text("Die Rücktaste ⌫ liegt rechts oben über Enter. Drücke sie mit dem rechten kleinen Finger, dann kehrt er zu Ö zurück.")
                    .font(.title3.weight(.semibold)).multilineTextAlignment(.center)
                Text("Wir haben ein falsches F oder J vorbereitet. Erst löschen, dann den richtigen Buchstaben tippen.")
                    .font(.callout).foregroundStyle(.white.opacity(0.7))
            } else {
            Text(model.lesson?.id == "home-fj" ? "Finde die kleinen Erhebungen auf F und J. Dort liegen deine Zeigefinger." : "Entdecke deine neuen Tasten. Nach dem Tippen kehren die Finger zur Grundreihe zurück.")
                .font(.title3.weight(.semibold)).multilineTextAlignment(.center)
            Text("Links: A · S · D · F     Rechts: J · K · L · Ö")
                .font(.callout).foregroundStyle(.white.opacity(0.7))
            Text("Tippe jede gezeigte Taste einzeln. Du kannst die Erklärung auch überspringen.")
                .font(.callout).foregroundStyle(.white.opacity(0.6))
            Button("Ich habe die Finger gefunden", systemImage: "checkmark") {
                model.demonstrate(); lessonFocused = true
            }.buttonStyle(.bordered)
            }
        }
    }

    private var guidedCorrectionCard: some View {
        let expected = model.typingExpectedKey ?? "f"
        let wrong = expected == "f" ? "j" : "f"
        let pending = model.guidedCorrectionPending
        return VStack(spacing: 12) {
            HStack(spacing: 18) {
                Text(pending ? wrong : "│")
                    .font(.system(size: 42, weight: .bold, design: .monospaced))
                    .foregroundStyle(pending ? .orange : .white.opacity(0.65))
                    .frame(width: 90, height: 64).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                Image(systemName: "arrow.right").foregroundStyle(.white.opacity(0.5))
                Text(expected).font(.system(size: 42, weight: .bold, design: .monospaced)).foregroundStyle(accent)
                    .frame(width: 90, height: 64).background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
            Text(pending ? "1. Das vorbereitete falsche Zeichen mit Rücktaste ⌫ löschen." : "2. Jetzt \(QwertZnakeLearningModel.label(expected)) tippen.")
                .font(.headline).multilineTextAlignment(.center)
            if pending {
                Button("⌫ Falsches Zeichen löschen") { model.backspace(); lessonFocused = true }
                    .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
            }
            Text("Rechter kleiner Finger zur Rücktaste, danach zurück zu Ö. Die vorbereiteten Fehler zählen nicht als deine Fehler.")
                .font(.caption).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.center)
        }
        .padding(18).frame(maxWidth: .infinity)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 16))
    }

    private var writingPrompt: some View {
        VStack(spacing: 14) {
            HStack(spacing: 3) {
                ForEach(Array(model.targets.enumerated()), id: \.offset) { index, key in
                    Text(key == " " ? "␣" : key)
                        .font(.system(size: 25, weight: .bold, design: .monospaced))
                        .foregroundStyle(index < model.targetIndex ? accent : index == model.targetIndex ? .white : .white.opacity(0.4))
                        .padding(.vertical, 6).padding(.horizontal, 1)
                        .background(index == model.targetIndex ? .white.opacity(0.1) : .clear, in: RoundedRectangle(cornerRadius: 4))
                }
            }
            .minimumScaleFactor(0.4).lineLimit(1)
            if model.needsBackspace, !model.guidedCorrectionPending {
                Button("⌫ Löschen und korrigieren") { model.backspace(); lessonFocused = true }
                    .buttonStyle(.borderedProminent).tint(.orange).foregroundStyle(.black)
            } else {
                Text(model.lesson?.id == "home-fj" ? "Bei einem Fehler tippst du die gezeigte Taste einfach noch einmal. Dein Abschlussstern bleibt." : "Du kannst mit Rücktaste ⌫ korrigieren. Ein Fehler nimmt dir keinen Abschlussstern weg.")
                    .font(.callout).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.center)
            }
        }
    }

    private var fingerHelp: some View {
        VStack(spacing: 12) {
            if helpVisible, let key = highlightedKey {
                Text(LearningFinger.forKey(key).instruction)
                    .font(.headline).foregroundStyle(accent)
                Text("Nach dem Tippen zurück zur Grundreihe. Die App erkennt die gedrückte Taste, nicht deinen Finger.")
                    .font(.caption).foregroundStyle(.white.opacity(0.6)).multilineTextAlignment(.center)
            }
            Button(helpVisible ? "Fingerhilfe ausblenden" : "Fingerhilfe", systemImage: "hand.raised") {
                if helpVisible { model.setFingerHelp(false); helpPinned = false }
                else { model.showHelp(); helpPinned = true }
                lessonFocused = true
            }.buttonStyle(.bordered)
        }
    }

    private var feedback: some View {
        Text(model.feedback)
            .font(.callout.weight(.semibold))
            .foregroundStyle(model.lastCorrect == false ? .orange : .white.opacity(0.75))
            .multilineTextAlignment(.center).frame(minHeight: 40)
            .accessibilityAddTraits(.updatesFrequently)
    }

    private var result: some View {
        VStack(spacing: 20) {
            if let result = model.result {
                Text("Lektion geschafft!").font(.system(size: 35, weight: .black, design: .rounded))
                if model.session?.arcadeChallengeCompleted == true {
                    Label("Arcade geschafft: 10 Punkte!", systemImage: "gamecontroller.fill")
                        .font(.title3.weight(.bold)).foregroundStyle(accent)
                }
                Text(starsText(result.stars)).font(.system(size: 48)).foregroundStyle(.yellow)
                Text("\((result.firstTryAccuracy * 100).formatted(.number.precision(.fractionLength(1)))) % beim ersten Versuch")
                    .font(.title2.weight(.bold))
                Text("\(result.correctFirstTry) von \(result.targets) Zeichen sofort richtig · \(result.corrections) Korrekturen")
                    .font(.callout).foregroundStyle(.white.opacity(0.65))
                Text("Dein Abschlussstern bleibt. Für zwei Sterne brauchst du 90 %, für drei 95 %.")
                    .font(.callout).multilineTextAlignment(.center)
                Text("Heute entdeckt: \(((model.lesson?.newKeys ?? []) + (model.lesson?.newControlKeys ?? [])).map(QwertZnakeLearningModel.label).joined(separator: " · "))")
                    .font(.headline).foregroundStyle(accent)
                Text(result.firstTryAccuracy >= 0.9 ? "Du bist bereit für die nächsten Tasten." : "Noch eine Runde hilft dir, sicherer zu werden. Du darfst auch weitergehen.")
                    .multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.7))
                HStack(spacing: 14) {
                    Button("Noch einmal üben", systemImage: "arrow.counterclockwise") {
                        model.start(result.lessonId); lessonFocused = true
                    }.buttonStyle(.bordered)
                    if model.lesson?.nextLessonId != nil {
                        Button("Nächste Lektion", systemImage: "arrow.right", action: continueResult)
                            .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                    } else {
                        Button("Arcade spielen", systemImage: "gamecontroller", action: continueResult)
                            .buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                    }
                }
                Text(model.lesson?.nextLessonId != nil ? "Nächste Lektion mit der Leertaste" : "Arcade spielen mit der Leertaste")
                    .font(.callout).foregroundStyle(.white.opacity(0.65))
                if result.lessonId == "home-dk", !model.profile.bridgeComplete {
                    Button("Lenken ausprobieren: F · J · D · K", systemImage: "arrow.turn.up.right") {
                        model.beginBridge(); lessonFocused = true
                    }.buttonStyle(.bordered)
                }
                let practice = result.perKey.filter { !$0.value.reliable && $0.value.errors > 0 }.map(\.key).sorted()
                if !practice.isEmpty {
                    Text("Diese Tasten kannst du noch üben: \(practice.map(QwertZnakeLearningModel.label).joined(separator: " · "))")
                        .font(.callout).foregroundStyle(.white.opacity(0.7))
                }
                garden
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var garden: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Dein Garten · \(model.completedCount) von \(model.lessons.count) Lektionen geschafft")
                .font(.headline)
            if model.completedCount == 0 {
                Text("Mit jeder neuen abgeschlossenen Lektion wächst eine Pflanze. Deine Sterne bleiben beim Wiederholen erhalten.")
                    .font(.callout).foregroundStyle(.white.opacity(0.65))
            } else {
                Text(String(repeating: "🌱 ", count: model.completedCount)).font(.system(size: 27))
                    .accessibilityLabel("\(model.completedCount) Pflanzen")
            }
            HStack {
                Text("Schlangenfarbe").font(.callout)
                Button("Minze") { model.setCosmetic(color: "mint") }.buttonStyle(.bordered)
                if model.completedCount >= 3 { Button("Gold") { model.setCosmetic(color: "gold") }.buttonStyle(.bordered) }
                if model.completedCount >= 6 { Button("Violett") { model.setCosmetic(color: "violet") }.buttonStyle(.bordered) }
            }
            if model.completedCount >= 2 {
                HStack {
                    Text("Hut").font(.callout)
                    Button("Ohne") { model.setCosmetic(hat: "none") }.buttonStyle(.bordered)
                    Button("🌸") { model.setCosmetic(hat: "flower") }.buttonStyle(.bordered).accessibilityLabel("Blumenhut")
                    if model.completedCount >= 8 {
                        Button("👑") { model.setCosmetic(hat: "crown") }.buttonStyle(.bordered).accessibilityLabel("Krone")
                    }
                }
            }
            if !model.reliableKeys.isEmpty {
                Text("Schon sicher geübt: \(model.reliableKeys.map(QwertZnakeLearningModel.label).joined(separator: " · "))")
                    .font(.callout).foregroundStyle(accent)
            }
            Text("Sicher geübt bedeutet: mindestens 20 Zielzeichen und 90 % beim ersten Versuch. Das ist eine Hilfe, keine Sperre.")
                .font(.caption).foregroundStyle(.white.opacity(0.55))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 16))
    }

    private var bridge: some View {
        VStack(spacing: 16) {
            Text("Lenken in Ruhe").font(.title.weight(.black))
            Text("F ←    J →    D ↑    K ↓").font(.title2.monospaced().bold()).foregroundStyle(accent)
            Text("Diese Tasten bleiben für die ganze Runde gleich. Die Schlange wartet auf die richtige Taste.")
                .multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.7))
            if model.isPaused, model.reward == nil {
                Button("Weiter") { model.togglePause(); lessonFocused = true }.buttonStyle(.borderedProminent)
            } else {
                targetCard
                LearningBridgeBoard(step: model.reward?.bridgeStep ?? model.bridgeIndex ?? 0,
                    applePhase: model.reward?.phase.apple ?? .whole).frame(height: 220)
                if model.reward == nil { fingerHelp; feedback }
                else { Text("Deine Schlange hat den Apfel am Streckenende erreicht.").foregroundStyle(accent) }
            }
        }
    }

    private var learningKeyboard: some View {
        VStack(spacing: 6) {
            HStack { Spacer(minLength: 0); backspaceKey }
            ForEach(Array(learningKeyboardRows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 4) {
                    ForEach(row, id: \.self) { key in
                        let taught = model.lesson?.taughtKeys.contains(key) == true
                        Button {
                            withAnimation(.easeOut(duration: 0.15)) { model.submit(key) }
                            lessonFocused = true
                        } label: {
                            VStack(spacing: 2) {
                                Text(key == " " ? "Leertaste" : key.uppercased())
                                    .font(.system(size: key == " " ? 14 : 18, weight: .bold, design: .rounded))
                                if key == "f" || key == "j" { Capsule().fill(.white).frame(width: 12, height: 2) }
                            }
                            .frame(maxWidth: key == " " ? 250 : .infinity, minHeight: 37)
                            .background(key == highlightedKey ? accent : taught ? .white.opacity(0.12) : .white.opacity(0.025), in: RoundedRectangle(cornerRadius: 6))
                            .foregroundStyle(key == highlightedKey ? .black : taught ? .white : .white.opacity(0.22))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(key == highlightedKey ? accent : .clear, lineWidth: 2))
                        }
                        .buttonStyle(.plain).disabled(!taught || model.isPaused || model.reward != nil)
                        .accessibilityLabel(QwertZnakeLearningModel.label(key) + (key == highlightedKey ? ", gesuchte Taste" : ""))
                        .anchorPreference(key: LearningKeyboardKeyFrames.self, value: .bounds) { [key: $0] }
                    }
                    if row != [" "] {
                        if row.count == 10 { Color.clear.frame(maxWidth: .infinity, minHeight: 37).accessibilityHidden(true) }
                        if row.first == "a" {
                            Text("Enter ↵").font(.callout.weight(.semibold)).foregroundStyle(.white.opacity(0.25))
                                .frame(width: 96, height: 37).background(.white.opacity(0.025), in: RoundedRectangle(cornerRadius: 6))
                        } else { Color.clear.frame(width: 96, height: 37).accessibilityHidden(true) }
                    }
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .padding(.bottom, 48)
        .frame(maxWidth: 900).frame(maxWidth: .infinity)
        .background(.white.opacity(0.035))
        .overlayPreferenceValue(LearningKeyboardKeyFrames.self) { anchors in
            GeometryReader { geometry in
                if helpVisible {
                    LearningKeyboardHands(
                        frames: anchors.mapValues { geometry[$0] },
                        expectedKey: highlightedKey,
                        motionId: "\(model.session?.id ?? ""):\(model.stage?.rawValue ?? ""):\(model.targetIndex):\(model.bridgeIndex ?? -1):\(highlightedKey ?? "")",
                        paused: model.isPaused
                    )
                }
            }
            .allowsHitTesting(false)
        }
    }

    private var backspaceKey: some View {
        let taught = model.lesson?.id != "home-fj"
        let active = highlightedKey == "backspace"
        return Button {
            model.backspace(); lessonFocused = true
        } label: {
            Text("⌫ Rücktaste").font(.callout.weight(.bold))
                .frame(width: 96, height: 37)
                .background(active ? accent : taught ? .white.opacity(0.12) : .white.opacity(0.025), in: RoundedRectangle(cornerRadius: 6))
                .foregroundStyle(active ? .black : taught ? .white : .white.opacity(0.25))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(active ? accent : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain).disabled(!taught || model.isPaused || model.reward != nil)
        .accessibilityLabel("Rücktaste, rechter kleiner Finger" + (active ? ", gesuchte Taste" : ""))
        .anchorPreference(key: LearningKeyboardKeyFrames.self, value: .bounds) { ["backspace": $0] }
    }

    private var profileForm: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(editingName ? "Deinen Namen ändern" : "Dein Lernprofil").font(.title.weight(.bold))
            Text("Verwende deinen Namen, zum Beispiel Mia K. Dein Lernfortschritt und deine Einträge bleiben zugeordnet.").foregroundStyle(.secondary)
            TextField("Dein Name", text: $nickname)
                .textFieldStyle(.roundedBorder).focused($nicknameFocused)
                .onSubmit { createProfile() }
            HStack {
                Button("Abbrechen") { creatingProfile = false }
                Spacer()
                Button(editingName ? "Namen speichern" : "Profil anlegen") { createProfile() }
                    .buttonStyle(.borderedProminent)
                    .disabled(!QwertZnakeClassroomClient.validName(QwertZnakeClassroomClient.cleanedName(nickname)))
            }
        }
        .padding(30).frame(minWidth: 300, idealWidth: 440, minHeight: 260)
        .task { nicknameFocused = true }
    }

    private func createProfile() {
        guard QwertZnakeClassroomClient.validName(QwertZnakeClassroomClient.cleanedName(nickname)) else { return }
        if editingName { model.renameProfile(nickname) } else { model.createProfile(nickname) }
        creatingProfile = false
    }

    private func continueResult() {
        guard model.stage == .result, model.bridgeIndex == nil, model.reward == nil, !model.needsArcadeChallenge else { return }
        if let next = model.lesson?.nextLessonId {
            model.start(next)
            lessonFocused = true
        } else {
            model.suspend()
            onArcade()
        }
    }

    private func handleKey(_ event: KeyPress) -> KeyPress.Result {
        let key: String
        if event.key == .escape { key = "Escape" }
        else if event.key == .delete { key = "Backspace" }
        else if event.key == .space { key = " " }
        else { key = event.characters.lowercased() }
        if event.phase == .up {
            pressedKeys.remove(key)
            if key == " " { spaceHeld = false }
            return .handled
        }
        guard !creatingProfile, !classroomSettings, !nicknameFocused, !model.requiresName, model.session != nil,
              event.modifiers.intersection([.command, .control, .option]).isEmpty else { return .ignored }
        if model.needsArcadeChallenge, model.reward == nil {
            guard model.lesson?.taughtKeys.contains(key) == true else { return .ignored }
            guard event.phase == .down, !pressedKeys.contains(key) else { return .handled }
            pressedKeys.insert(key)
            model.submit(key)
            return .handled
        }
        if key == " " {
            guard event.phase == .down, !spaceHeld else { return .handled }
            // Keep this latch through reward and lesson changes until the key is released.
            spaceHeld = true
            if let reward = model.reward {
                if reward.phase == .celebration { model.finishReward(id: reward.id); lessonFocused = true }
                return .handled
            }
            if model.stage == .result, model.bridgeIndex == nil {
                continueResult()
                return .handled
            }
        }
        guard event.phase == .down,
              !pressedKeys.contains(key) else { return .ignored }
        guard key == "Escape" || key == "Backspace" ||
            (key.count == 1 && key.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) })) else { return .ignored }
        pressedKeys.insert(key)
        if key == "Escape" { model.togglePause() }
        else if key == "Backspace" { model.backspace() }
        else { withAnimation(.easeOut(duration: 0.15)) { model.submit(key) } }
        return .handled
    }

    private func starsText(_ count: Int) -> String {
        String(repeating: "★", count: count) + String(repeating: "☆", count: max(0, 3 - count))
    }
}

private struct LearningArcadeChallenge: View {
    @ObservedObject var model: QwertZnakeLearningModel
    @ObservedObject var game: QwertZnakeGameModel
    var onFocus: () -> Void

    private let timer = Timer.publish(every: 0.18, on: .main, in: .common).autoconnect()
    private let accent = Color(red: 0.72, green: 0.93, blue: 0.53)

    var body: some View {
        VStack(spacing: 18) {
            Text("Arcade-Zeit!").font(.system(size: 34, weight: .black, design: .rounded))
            Text("Lektion \(model.lesson?.number ?? 0) geschafft. Sammle jetzt 10 Punkte bei qwertZnake.")
                .font(.title3.weight(.semibold)).multilineTextAlignment(.center)
            Text("F links · J rechts · D hoch · K runter")
                .font(.headline).foregroundStyle(accent)
            Text("Alle Spieltasten hast du schon gelernt. Jeder Apfel bringt einen Punkt.")
                .font(.callout).foregroundStyle(.white.opacity(0.7)).multilineTextAlignment(.center)
            HStack {
                Text("\(game.score) / 10 Punkte").font(.title2.weight(.bold)).monospacedDigit()
                Spacer()
                ProgressView(value: Double(game.score), total: 10).tint(accent).frame(maxWidth: 220)
            }
            ZStack {
                QwertZnakeBoardView(game: game, showsOverlay: false)
                if model.isPaused || game.phase != .playing {
                    VStack(spacing: 14) {
                        Text(model.isPaused || game.phase == .paused ? "Pause" : game.phase == .gameOver ? "Noch ein Versuch!" : "Bereit für 10 Punkte?")
                            .font(.title2.weight(.bold))
                        if game.phase == .gameOver {
                            Text("Du hast \(game.score) Punkte gesammelt. Beim nächsten Versuch geht es wieder bei 0 los.")
                                .multilineTextAlignment(.center)
                        }
                        Button(model.isPaused || game.phase == .paused ? "Weiter" : game.phase == .gameOver ? "Noch einmal spielen" : "Spiel starten", systemImage: "play.fill") {
                            if model.isPaused { model.togglePause() }
                            else { model.startArcadeChallenge() }
                            onFocus()
                        }.buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black)
                    }
                    .padding(24).frame(maxWidth: 340)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
            }.frame(maxWidth: 480)
            HStack(spacing: 12) {
                ForEach(ArcadeDirection.allCases, id: \.self) { direction in
                    if let key = game.controlKeys[direction], model.lesson?.taughtKeys.contains(key) == true {
                        Button {
                            model.submit(key)
                            onFocus()
                        } label: {
                            Label(key.uppercased(), systemImage: direction.symbolName)
                                .font(.title3.weight(.bold)).frame(minWidth: 70, minHeight: 44)
                        }
                        .buttonStyle(.bordered).tint(accent)
                        .disabled(model.isPaused || game.phase != .playing)
                    }
                }
            }
            Text("Bei 10 Punkten geht es mit deinem Lernabenteuer weiter.")
                .font(.callout).foregroundStyle(.white.opacity(0.65))
        }
        .onReceive(timer) { _ in model.tickArcadeChallenge() }
    }
}

private let learningKeyboardRows = [
    ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
    ["y", "x", "c", "v", "b", "n", "m", ",", ".", "-"], [" "]
]
