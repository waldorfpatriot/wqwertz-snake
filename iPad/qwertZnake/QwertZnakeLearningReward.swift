import SwiftUI

enum LearningApplePhase: Int, CaseIterable {
    case whole, oneBite, twoBites, top
}

enum LearningRewardPhase: Int, CaseIterable {
    case whole, oneBite, twoBites, top, celebration

    var apple: LearningApplePhase { LearningApplePhase(rawValue: min(rawValue, 3)) ?? .top }
}

struct QwertZnakeLearningReward: Identifiable {
    var id = UUID().uuidString
    var completedStage: QwertZnakeLearningStage?
    var targetCount: Int
    var bridgeStep: Int?
    var stars: Int?
    var phase: LearningRewardPhase = .whole

    var isBridge: Bool { bridgeStep != nil }
    var title: String {
        if isBridge { return "Gut gelenkt!" }
        switch completedStage {
        case .demo: return "Finger gefunden!"
        case .feed: return "Apfel erreicht!"
        case .write: return "Wörter geschafft!"
        default: return "Geschafft!"
        }
    }
    var message: String {
        if isBridge { return "Du hast die ganze Strecke mit F, J, D und K geschafft." }
        switch completedStage {
        case .demo: return "Deine Hände sind bereit. Jetzt fütterst du deine Schlange."
        case .feed: return "Jede richtige Taste hat dich ans Ziel gebracht. Jetzt wird daraus Schreiben."
        case .write: return "Die ganze Lektion ist geschafft. Deine Sterne bleiben gespeichert."
        default: return "Deine Schlange freut sich über deinen Fortschritt."
        }
    }
}

struct LearningRewardPresentation: View {
    var reward: QwertZnakeLearningReward
    var paused: Bool
    var onPhase: (LearningRewardPhase, String) -> Void
    var onFinish: (String) -> Void
    var onHome: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    @AccessibilityFocusState private var rewardFocused: Bool

    var body: some View {
        Group {
            if reward.phase == .celebration {
                ZStack {
                    Color(red: 0.04, green: 0.08, blue: 0.07).opacity(0.98).ignoresSafeArea()
                    if !reduceMotion, !paused {
                        GeometryReader { geometry in
                            ForEach(0..<24, id: \.self) { index in
                                Capsule()
                                    .fill([Color.yellow, .green, .orange, .mint][index % 4].opacity(0.8))
                                    .frame(width: 8, height: 17)
                                    .rotationEffect(.degrees(Double(index * 37)))
                                    .position(x: geometry.size.width * CGFloat((index * 43) % 100) / 100,
                                              y: geometry.size.height * (appeared ? 0.88 : 0.06) + CGFloat(index % 5) * 13)
                            }
                        }.allowsHitTesting(false)
                    }
                    VStack(spacing: 20) {
                        Text("🐍").font(.system(size: 100)).scaleEffect(appeared || reduceMotion ? 1 : 0.72)
                        Text(reward.title).font(.system(size: 40, weight: .black, design: .rounded))
                            .accessibilityAddTraits(.isHeader).accessibilityFocused($rewardFocused)
                            .onAppear { rewardFocused = true }
                        Text(reward.message).font(.title3).multilineTextAlignment(.center)
                            .foregroundStyle(.white.opacity(0.76)).frame(maxWidth: 550)
                        if let stars = reward.stars {
                            Text(String(repeating: "★", count: stars) + String(repeating: "☆", count: max(0, 3 - stars)))
                                .font(.system(size: 48)).foregroundStyle(.yellow)
                        }
                        Button(paused ? "Pause beenden und weiter" : "Weiter", systemImage: "arrow.right") { onFinish(reward.id) }
                            .buttonStyle(.borderedProminent).controlSize(.large).tint(.green).foregroundStyle(.black)
                        Text("Weiter mit der Leertaste").font(.callout).foregroundStyle(.white.opacity(0.6))
                        Button("Zu den Lektionen") { onHome() }.buttonStyle(.bordered)
                        if paused { Text("Die Animation macht Pause.").font(.callout).foregroundStyle(.white.opacity(0.6)) }
                    }
                    .padding(28).foregroundStyle(.white)
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel(reward.title)
            } else {
                Color.clear.allowsHitTesting(false)
            }
        }
        .task(id: reward.id + ":\(paused):\(reduceMotion)") {
            guard !paused else { return }
            let pending = LearningRewardPhase.allCases.filter { $0.rawValue > reward.phase.rawValue }
            do {
                for phase in pending {
                    try await Task.sleep(for: .milliseconds(400))
                    guard !Task.isCancelled else { return }
                    onPhase(phase, reward.id)
                    if phase == .celebration, !reduceMotion {
                        withAnimation(.easeOut(duration: 1.1)) { appeared = true }
                    }
                }
                try await Task.sleep(for: .milliseconds(reduceMotion ? 1000 : 1400))
                guard !Task.isCancelled else { return }
                onFinish(reward.id)
            } catch { /* Leaving, pausing or replacing this reward cancels its sequence. */ }
        }
    }
}

struct LearningTypingRoute {
    var total: Int
    var columns: Int { min(10, max(2, total + 1)) }
    var rows: Int { max(1, (max(1, total) + 1 + columns - 1) / columns) }

    func point(_ step: Int) -> CGPoint {
        let index = min(max(0, step), max(1, total))
        let row = index / columns
        return CGPoint(x: row.isMultiple(of: 2) ? index % columns : columns - 1 - index % columns, y: row)
    }
}

struct LearningSnakeBoard: View {
    var step: Int
    var total: Int
    var colorName: String
    var hat: String
    var applePhase: LearningApplePhase = .whole

    var body: some View {
        let route = LearningTypingRoute(total: max(1, total))
        LearningRouteBoard(points: (0...max(1, total)).map(route.point), columns: route.columns, rows: route.rows,
            step: step, colorName: colorName, hat: hat, applePhase: applePhase)
            .accessibilityLabel("Sichere Schlangenstrecke. \(min(step, total)) von \(total) Schritten. Der Apfel wartet am Ende.")
    }
}

struct LearningBridgeBoard: View {
    var step: Int
    var applePhase: LearningApplePhase = .whole
    private let points: [CGPoint] = [
        CGPoint(x: 1, y: 1), CGPoint(x: 2, y: 1), CGPoint(x: 3, y: 1),
        CGPoint(x: 3, y: 2), CGPoint(x: 3, y: 3), CGPoint(x: 2, y: 3),
        CGPoint(x: 1, y: 3), CGPoint(x: 1, y: 2), CGPoint(x: 2, y: 2)
    ]

    var body: some View {
        LearningRouteBoard(points: points, columns: 5, rows: 5, step: step,
            colorName: "mint", hat: "none", applePhase: applePhase)
            .accessibilityLabel("Lenkstrecke. Der Apfel wartet fest am letzten Punkt.")
    }
}

private struct LearningRouteBoard: View {
    var points: [CGPoint]
    var columns: Int
    var rows: Int
    var step: Int
    var colorName: String
    var hat: String
    var applePhase: LearningApplePhase

    var body: some View {
        GeometryReader { geometry in
            // The extra cell of inset keeps a large, readable apple inside the board.
            let cell = max(1, min(56, (geometry.size.width - 24) / CGFloat(columns + 1), (geometry.size.height - 24) / CGFloat(rows + 1)))
            let origin = CGPoint(x: (geometry.size.width - cell * CGFloat(columns)) / 2,
                                 y: (geometry.size.height - cell * CGFloat(rows)) / 2)
            let positions = points.map { CGPoint(x: origin.x + ($0.x + 0.5) * cell, y: origin.y + ($0.y + 0.5) * cell) }
            ZStack {
                Canvas { context, _ in
                    var path = Path()
                    for (index, point) in positions.enumerated() {
                        if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                    }
                    context.stroke(path, with: .color(.white.opacity(0.24)), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [2, 8]))
                    let head = min(max(0, step), max(0, points.count - 1))
                    for index in max(0, head - 2)...head {
                        let point = positions[index]
                        let rect = CGRect(x: point.x - cell * 0.35, y: point.y - cell * 0.35, width: cell * 0.7, height: cell * 0.7)
                        context.fill(Path(roundedRect: rect, cornerRadius: cell * 0.18), with: .color(snakeColor.opacity(index == head ? 1 : 0.65)))
                        if index == head {
                            context.draw(Text(hat == "flower" ? "🌸" : hat == "crown" ? "👑" : "• •").font(.system(size: cell * 0.3)), at: point)
                        }
                    }
                }
                if let endpoint = positions.last {
                    LearningAppleView(phase: applePhase)
                        .frame(width: cell * 1.65, height: cell * 1.65)
                        .position(endpoint)
                }
            }
        }
        .background(.white.opacity(0.025), in: RoundedRectangle(cornerRadius: 16))
    }

    private var snakeColor: Color {
        switch colorName {
        case "gold": return .yellow
        case "violet": return .purple
        default: return Color(red: 0.45, green: 0.86, blue: 0.63)
        }
    }
}

struct LearningAppleView: View {
    var phase: LearningApplePhase

    var body: some View {
        Canvas { context, size in
            let transform = CGAffineTransform(scaleX: size.width / 256, y: size.height / 256)
            if phase != .top {
                var apple = Path()
                apple.move(to: CGPoint(x: 128, y: 74))
                apple.addCurve(to: CGPoint(x: 42, y: 83), control1: CGPoint(x: 106, y: 58), control2: CGPoint(x: 63, y: 60))
                apple.addCurve(to: CGPoint(x: 47, y: 203), control1: CGPoint(x: 16, y: 111), control2: CGPoint(x: 21, y: 161))
                apple.addCurve(to: CGPoint(x: 128, y: 223), control1: CGPoint(x: 69, y: 238), control2: CGPoint(x: 98, y: 241))
                apple.addCurve(to: CGPoint(x: 213, y: 196), control1: CGPoint(x: 160, y: 241), control2: CGPoint(x: 190, y: 232))
                apple.addCurve(to: CGPoint(x: 214, y: 85), control1: CGPoint(x: 240, y: 154), control2: CGPoint(x: 237, y: 112))
                apple.addCurve(to: CGPoint(x: 128, y: 74), control1: CGPoint(x: 192, y: 62), control2: CGPoint(x: 151, y: 59))
                apple.closeSubpath()
                var rim = Path()
                rim.move(to: CGPoint(x: 40, y: 89))
                rim.addCurve(to: CGPoint(x: 73, y: 119), control1: CGPoint(x: 58, y: 88), control2: CGPoint(x: 75, y: 103))
                rim.addCurve(to: CGPoint(x: 81, y: 158), control1: CGPoint(x: 92, y: 122), control2: CGPoint(x: 97, y: 146))
                rim.addCurve(to: CGPoint(x: 58, y: 196), control1: CGPoint(x: 90, y: 177), control2: CGPoint(x: 76, y: 193))
                var cut = Path()
                cut.move(to: CGPoint(x: 0, y: 84)); cut.addLine(to: CGPoint(x: 40, y: 89))
                cut.addCurve(to: CGPoint(x: 73, y: 119), control1: CGPoint(x: 58, y: 88), control2: CGPoint(x: 75, y: 103))
                cut.addCurve(to: CGPoint(x: 81, y: 158), control1: CGPoint(x: 92, y: 122), control2: CGPoint(x: 97, y: 146))
                cut.addCurve(to: CGPoint(x: 58, y: 196), control1: CGPoint(x: 90, y: 177), control2: CGPoint(x: 76, y: 193))
                cut.addLine(to: CGPoint(x: 0, y: 199)); cut.closeSubpath()
                let mirror = CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: 256, ty: 0)
                context.drawLayer { layer in
                    layer.fill(apple.applying(transform), with: .linearGradient(Gradient(colors: [
                        Color(red: 0.97, green: 0.51, blue: 0.42),
                        Color(red: 0.93, green: 0.39, blue: 0.35),
                        Color(red: 0.81, green: 0.28, blue: 0.28)
                    ]), startPoint: .zero, endPoint: CGPoint(x: size.width, y: size.height)))
                    layer.stroke(apple.applying(transform), with: .color(Color(red: 0.74, green: 0.27, blue: 0.27)), lineWidth: size.width * 3 / 256)
                    let cream = Color(red: 1, green: 0.93, blue: 0.81)
                    if phase.rawValue >= LearningApplePhase.oneBite.rawValue {
                        layer.stroke(rim.applying(transform), with: .color(cream), style: StrokeStyle(lineWidth: size.width * 12 / 256, lineCap: .round))
                    }
                    if phase.rawValue >= LearningApplePhase.twoBites.rawValue {
                        layer.stroke(rim.applying(mirror).applying(transform), with: .color(cream), style: StrokeStyle(lineWidth: size.width * 12 / 256, lineCap: .round))
                    }
                    layer.blendMode = .destinationOut
                    if phase.rawValue >= LearningApplePhase.oneBite.rawValue {
                        layer.fill(cut.applying(transform), with: .color(.black))
                    }
                    if phase.rawValue >= LearningApplePhase.twoBites.rawValue {
                        layer.fill(cut.applying(mirror).applying(transform), with: .color(.black))
                    }
                }
            }
            var stem = Path()
            stem.move(to: CGPoint(x: 126, y: 77))
            stem.addCurve(to: CGPoint(x: 120, y: 25), control1: CGPoint(x: 119, y: 58), control2: CGPoint(x: 113, y: 41))
            context.stroke(stem.applying(transform), with: .color(Color(red: 0.33, green: 0.47, blue: 0.28)), style: StrokeStyle(lineWidth: size.width * 11 / 256, lineCap: .round))
            var leaf = Path()
            leaf.move(to: CGPoint(x: 131, y: 58))
            leaf.addCurve(to: CGPoint(x: 194, y: 23), control1: CGPoint(x: 137, y: 24), control2: CGPoint(x: 173, y: 15))
            leaf.addCurve(to: CGPoint(x: 131, y: 58), control1: CGPoint(x: 185, y: 52), control2: CGPoint(x: 158, y: 70))
            context.fill(leaf.applying(transform), with: .color(Color(red: 0.40, green: 0.66, blue: 0.33)))
            context.stroke(leaf.applying(transform), with: .color(Color(red: 0.26, green: 0.54, blue: 0.27)), lineWidth: size.width * 3 / 256)
            var vein = Path()
            vein.move(to: CGPoint(x: 136, y: 56)); vein.addLine(to: CGPoint(x: 181, y: 30))
            context.stroke(vein.applying(transform), with: .color(Color(red: 0.82, green: 0.91, blue: 0.66)), lineWidth: max(1, size.width * 3 / 256))
            var smallLeaf = Path()
            smallLeaf.move(to: CGPoint(x: 123, y: 57))
            smallLeaf.addCurve(to: CGPoint(x: 76, y: 44), control1: CGPoint(x: 112, y: 34), control2: CGPoint(x: 87, y: 32))
            smallLeaf.addCurve(to: CGPoint(x: 123, y: 57), control1: CGPoint(x: 86, y: 63), control2: CGPoint(x: 109, y: 68))
            context.fill(smallLeaf.applying(transform), with: .color(Color(red: 0.54, green: 0.74, blue: 0.40)))
            if phase == .top {
                var calyx = Path()
                calyx.move(to: CGPoint(x: 126, y: 74))
                calyx.addCurve(to: CGPoint(x: 105, y: 83), control1: CGPoint(x: 116, y: 70), control2: CGPoint(x: 106, y: 76))
                calyx.addCurve(to: CGPoint(x: 128, y: 83), control1: CGPoint(x: 113, y: 91), control2: CGPoint(x: 123, y: 87))
                calyx.addCurve(to: CGPoint(x: 152, y: 82), control1: CGPoint(x: 135, y: 90), control2: CGPoint(x: 146, y: 90))
                calyx.addCurve(to: CGPoint(x: 126, y: 74), control1: CGPoint(x: 148, y: 73), control2: CGPoint(x: 136, y: 69))
                context.fill(calyx.applying(transform), with: .color(Color(red: 0.46, green: 0.68, blue: 0.35)))
            }
        }
        .accessibilityLabel(["Apfel", "Apfel mit einem Biss", "Apfel mit zwei Bissen", "Nur das grüne Blatt und der Stiel bleiben"][phase.rawValue])
    }
}
