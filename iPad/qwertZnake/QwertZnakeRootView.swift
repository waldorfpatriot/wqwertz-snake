import SwiftUI

struct QwertZnakeRootView: View {
    @ObservedObject var game: QwertZnakeGameModel
    @StateObject private var learning = QwertZnakeLearningModel()
    @State private var showArcade = false
    @State private var selectedPanel: SidePanel = .results
    @FocusState private var gameControlsFocused: Bool

    private let timer = Timer.publish(every: 0.11, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if showArcade {
                VStack(spacing: 0) {
                    HStack {
                        Button("Tippen lernen", systemImage: "arrow.left") {
                            if game.phase == .playing { game.startOrResume() }
                            for key in game.pressedKeys { game.release(key) }
                            showArcade = false
                        }
                        .buttonStyle(.bordered)
                        Spacer()
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 8)
                    .background(Color(red: 0.05, green: 0.06, blue: 0.07))
                    arcadeBody
                }
            } else {
                QwertZnakeLearningView(model: learning) {
                    learning.suspend()
                    showArcade = true
                }
            }
        }
        .arcadeWindowChrome()
    }

    // Arcade input and its timer subscribe only while the Arcade view is visible.
    private var arcadeBody: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                VStack(spacing: 0) {
                    HeaderView(game: game)
                    QwertZnakeBoardView(game: game)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                }

                Divider()
                    .overlay(Color.white.opacity(0.12))

                SidePanelView(game: game, selection: $selectedPanel)
                    .frame(width: 320)
            }

            QwertZnakeKeyboard(model: game)
        }
        .background(Color(red: 0.05, green: 0.06, blue: 0.07))
        .foregroundStyle(Color.white)
        .focusable()
        .focused($gameControlsFocused)
        .onTapGesture {
            gameControlsFocused = true
        }
        .task {
            gameControlsFocused = true
            await game.loadLocalState()
        }
        .onKeyPress { keyPress in
            guard let key = normalizedHardwareKey(from: keyPress) else {
                return .ignored
            }
            game.press(key)
            game.release(key)
            return .handled
        }
        .onReceive(timer) { _ in
            game.tick()
        }
        .onChange(of: game.phase) { _, phase in
            if phase == .gameOver {
                Task {
                    await game.submitCurrentResult()
                }
            }
        }
    }

    private func normalizedHardwareKey(from keyPress: KeyPress) -> String? {
        if !keyPress.modifiers.intersection([.command, .control, .option]).isEmpty {
            return nil
        }

        let characters = keyPress.characters.lowercased()
        guard characters.count == 1 else { return nil }
        return characters
    }
}

private struct HeaderView: View {
    @ObservedObject var game: QwertZnakeGameModel

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("qwertZnake")
                    .font(.system(size: 30, weight: .black, design: .rounded))
                Text(game.activeLevelName)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.72))
            }

            Spacer(minLength: 12)

            MetricPill(title: "Punkte", value: "\(game.score)")
            MetricPill(title: "Level", value: game.currentLevelNumber == 0 ? "-" : "\(game.currentLevelNumber)")
            MetricPill(title: "T/Min", value: "\(game.kpm)")
            MetricPill(title: "Genauigkeit", value: "\(Int(game.accuracy))%")

            Button {
                game.startOrResume()
            } label: {
                Label(primaryActionTitle, systemImage: primaryActionIcon)
            }
            .buttonStyle(PrimaryButtonStyle())

            Button {
                game.restart()
            } label: {
                Image(systemName: "arrow.counterclockwise")
                    .accessibilityLabel("Restart")
            }
            .buttonStyle(IconButtonStyle())
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(Color.black.opacity(0.35))
    }

    private var primaryActionTitle: String {
        switch game.phase {
        case .playing: return "Pause"
        case .paused: return "Weiter"
        case .ready, .gameOver: return "Start"
        }
    }

    private var primaryActionIcon: String {
        switch game.phase {
        case .playing: return "pause.fill"
        default: return "play.fill"
        }
    }
}

struct QwertZnakeBoardView: View {
    @ObservedObject var game: QwertZnakeGameModel
    var showsOverlay = true

    var body: some View {
        GeometryReader { proxy in
            let length = min(proxy.size.width, proxy.size.height)
            let boardRect = CGRect(
                x: (proxy.size.width - length) / 2,
                y: (proxy.size.height - length) / 2,
                width: length,
                height: length
            )

            ZStack {
                Canvas { context, _ in
                    drawBoard(in: &context, rect: boardRect)
                }

                if showsOverlay, game.phase != .playing {
                    OverlayView(game: game)
                        .frame(width: min(360, length * 0.86))
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .background(Color(red: 0.08, green: 0.10, blue: 0.11))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    private func drawBoard(in context: inout GraphicsContext, rect: CGRect) {
        context.fill(Path(rect), with: .color(Color(red: 0.06, green: 0.08, blue: 0.09)))

        let cell = rect.width / CGFloat(game.dimension)
        let gridColor = Color.white.opacity(game.dimension > 30 ? 0.035 : 0.06)
        for index in 0...game.dimension {
            let offset = rect.minX + CGFloat(index) * cell
            var vertical = Path()
            vertical.move(to: CGPoint(x: offset, y: rect.minY))
            vertical.addLine(to: CGPoint(x: offset, y: rect.maxY))
            context.stroke(vertical, with: .color(gridColor), lineWidth: 0.5)

            let y = rect.minY + CGFloat(index) * cell
            var horizontal = Path()
            horizontal.move(to: CGPoint(x: rect.minX, y: y))
            horizontal.addLine(to: CGPoint(x: rect.maxX, y: y))
            context.stroke(horizontal, with: .color(gridColor), lineWidth: 0.5)
        }

        for barrier in game.barriers {
            context.fill(cellPath(for: barrier, in: rect, cell: cell), with: .color(Color(red: 0.34, green: 0.38, blue: 0.42)))
        }

        context.fill(cellPath(for: game.food, in: rect, cell: cell, inset: cell * 0.14), with: .color(Color(red: 0.97, green: 0.23, blue: 0.24)))

        for (index, segment) in game.snake.enumerated() {
            let color = index == 0 ? Color(red: 0.40, green: 0.92, blue: 0.36) : Color(red: 0.17, green: 0.68, blue: 0.28)
            context.fill(cellPath(for: segment, in: rect, cell: cell, inset: cell * 0.09), with: .color(color))
        }
    }

    private func cellPath(for point: GridPoint, in rect: CGRect, cell: CGFloat, inset: CGFloat = 0) -> Path {
        Path(
            roundedRect: CGRect(
                x: rect.minX + CGFloat(point.x) * cell,
                y: rect.minY + CGFloat(point.y) * cell,
                width: cell,
                height: cell
            ).insetBy(dx: inset, dy: inset),
            cornerRadius: max(1, cell * 0.18)
        )
    }
}

private struct OverlayView: View {
    @ObservedObject var game: QwertZnakeGameModel

    var body: some View {
        VStack(spacing: 12) {
            Text(title)
                .font(.system(size: 26, weight: .black, design: .rounded))
            Text(message)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.76))
                .multilineTextAlignment(.center)

            if game.phase == .gameOver {
                HStack(spacing: 8) {
                    MetricPill(title: "Punkte", value: "\(game.score)")
                    MetricPill(title: "T/Min", value: "\(game.kpm)")
                }

                Text(game.lastRunSaved ? "Ergebnis gespeichert" : "Ergebnis wird gespeichert")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.64))
            }

            Button {
                game.startOrResume()
            } label: {
                Label(game.phase == .paused ? "Weiter" : "Start", systemImage: "play.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding(22)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        )
    }

    private var title: String {
        switch game.phase {
        case .ready: return "Bereit?"
        case .paused: return "Pause"
        case .gameOver: return "Game Over"
        case .playing: return ""
        }
    }

    private var message: String {
        switch game.phase {
        case .ready:
            return "Nutze T, B, F und J oder die native Tastatur."
        case .paused:
            return "Weiter mit Leertaste oder Start."
        case .gameOver:
            return "Dein Lauf wurde lokal gespeichert."
        case .playing:
            return ""
        }
    }
}

private enum SidePanel: String, CaseIterable, Identifiable {
    case results = "Ergebnisse"
    case levels = "Level"

    var id: String { rawValue }
}

private struct SidePanelView: View {
    @ObservedObject var game: QwertZnakeGameModel
    @Binding var selection: SidePanel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Panel", selection: $selection) {
                ForEach(SidePanel.allCases) { panel in
                    Text(panel.rawValue).tag(panel)
                }
            }
            .pickerStyle(.segmented)

            TextField("Name", text: $game.playerName)
                .textFieldStyle(.roundedBorder)

            Picker("Spielfeld", selection: $game.gridSize) {
                ForEach(GridSize.allCases) { size in
                    Text(size.title).tag(size)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: game.gridSize) { _, _ in
                game.resetForGridSizeChange()
            }

            if game.isSyncing {
                ProgressView()
                    .controlSize(.small)
            }

            if let error = game.errorMessage {
                Text(error)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(red: 1.0, green: 0.48, blue: 0.42))
            }

            Divider()
                .overlay(Color.white.opacity(0.16))

            switch selection {
            case .results:
                ResultsList(results: game.results)
            case .levels:
                LevelsList(levels: game.filteredLevels)
            }
        }
        .padding(16)
        .background(Color(red: 0.08, green: 0.09, blue: 0.10))
    }
}

private struct ResultsList: View {
    let results: [GameResult]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(Array(results.prefix(50).enumerated()), id: \.element.id) { index, result in
                    HStack(spacing: 10) {
                        Text("\(index + 1)")
                            .font(.system(size: 13, weight: .black, design: .rounded))
                            .foregroundStyle(Color.white.opacity(0.56))
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .lineLimit(1)
                            Text(result.displayDate)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(Color.white.opacity(0.52))
                        }

                        Spacer(minLength: 8)

                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(result.points)")
                                .font(.system(size: 17, weight: .black, design: .rounded))
                            Text("\(result.kpm) T/Min")
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .foregroundStyle(Color.white.opacity(0.58))
                        }
                    }
                    .padding(10)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                if results.isEmpty {
                    EmptyPanelText("Noch keine qwertZnake Ergebnisse.")
                }
            }
        }
    }
}

private struct LevelsList: View {
    let levels: [GameLevel]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(Array(levels.enumerated()), id: \.element.id) { index, level in
                    HStack(spacing: 10) {
                        Text("\(index + 1)")
                            .font(.system(size: 13, weight: .black, design: .rounded))
                            .foregroundStyle(Color.white.opacity(0.56))
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(level.name)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .lineLimit(1)
                            Text("\(level.barriers.count) Barrieren")
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(Color.white.opacity(0.52))
                        }

                        Spacer()
                    }
                    .padding(10)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                if levels.isEmpty {
                    EmptyPanelText("Keine lokalen Level für diese Spielfeldgröße.")
                }
            }
        }
    }
}

private struct EmptyPanelText: View {
    let value: String

    init(_ value: String) {
        self.value = value
    }

    var body: some View {
        Text(value)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.white.opacity(0.58))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 12)
    }
}

private struct MetricPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.58))
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
        }
        .frame(minWidth: 68)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .black, design: .rounded))
            .foregroundStyle(Color(red: 0.05, green: 0.06, blue: 0.07))
            .padding(.horizontal, 14)
            .frame(height: 42)
            .background(Color(red: 0.78, green: 0.91, blue: 0.30), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .opacity(configuration.isPressed ? 0.78 : 1)
    }
}

private struct IconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .black))
            .foregroundStyle(Color.white)
            .frame(width: 42, height: 42)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .opacity(configuration.isPressed ? 0.65 : 1)
    }
}

private extension View {
    @ViewBuilder
    func arcadeWindowChrome() -> some View {
        #if os(iOS)
        self.statusBarHidden(true)
        #else
        self
        #endif
    }
}
