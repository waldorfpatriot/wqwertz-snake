import SwiftUI

@main
struct QwertZnakeApp: App {
    var body: some Scene {
        WindowGroup {
            IPadArcadeView()
        }
    }
}

struct IPadArcadeView: View {
    @StateObject private var keyboardModel = ArcadeKeyboardModel()

    var body: some View {
        VStack(spacing: 0) {
            WebArcadeView(keyboardModel: keyboardModel)
                .ignoresSafeArea(.container, edges: [.top, .horizontal])

            IPadQwertzKeyboard(model: keyboardModel)
        }
        .background(Color.black)
        .ignoresSafeArea(.container, edges: [.top, .horizontal])
        .statusBarHidden(true)
    }
}

struct IPadQwertzKeyboard: View {
    @ObservedObject var model: ArcadeKeyboardModel

    private let rows = [
        ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
        ["y", "x", "c", "v", "b", "n", "m", ",", ".", "-"],
        [" "]
    ]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(Array(rows.enumerated()), id: \.offset) { rowIndex, row in
                HStack(spacing: 6) {
                    ForEach(Array(row.enumerated()), id: \.offset) { keyIndex, key in
                        if shouldInsertSeparator(row: rowIndex, key: keyIndex) {
                            KeyboardHandSeparator()
                        }

                        KeyboardKey(
                            key: key,
                            direction: model.state.direction(for: key),
                            isPressed: model.pressedKeys.contains(key) || model.state.activeKeys.contains(key),
                            isRejected: model.state.rejectedKeys.contains(key)
                        )
                        .keyboardTouch(
                            isPressed: model.pressedKeys.contains(key),
                            onPress: { model.press(key) },
                            onRelease: { model.release(key) }
                        )
                    }
                }
                .padding(.leading, rowIndex == 0 ? 18 : 0)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Color(red: 0.08, green: 0.09, blue: 0.10), Color(red: 0.02, green: 0.02, blue: 0.03)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.10))
                .frame(height: 1)
        }
    }

    private func shouldInsertSeparator(row: Int, key: Int) -> Bool {
        row < 3 && key == 5
    }
}

struct KeyboardKey: View {
    let key: String
    let direction: ArcadeDirection?
    let isPressed: Bool
    let isRejected: Bool

    private var isSpace: Bool {
        key == " "
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Text(isSpace ? "PLAY / PAUSE" : key.uppercased())
                .font(.system(size: isSpace ? 13 : 19, weight: .bold, design: .rounded))
                .foregroundStyle(foregroundColor)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .frame(width: isSpace ? 250 : 50, height: 44)
                .background(backgroundColor)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(borderColor, lineWidth: direction == nil ? 1 : 3)
                )
                .shadow(color: shadowColor, radius: isPressed ? 12 : 3, y: isPressed ? 2 : 1)
                .scaleEffect(isPressed ? 1.07 : direction == nil ? 1 : 1.04)

            if let direction {
                DirectionBadge(direction: direction)
                    .offset(x: 8, y: -8)
            }

            if isRejected {
                Text("X")
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundStyle(Color.white)
                    .frame(width: isSpace ? 250 : 50, height: 44)
            }
        }
        .animation(.spring(response: 0.18, dampingFraction: 0.68), value: isPressed)
        .accessibilityLabel(accessibilityLabel)
    }

    private var backgroundColor: Color {
        if isRejected { return Color(red: 0.88, green: 0.16, blue: 0.14) }
        if isSpace { return Color(red: 0.82, green: 0.84, blue: 0.86) }

        switch fingerClass {
        case "finger-pinky":
            return Color(red: 0.98, green: 0.30, blue: 0.32)
        case "finger-ring":
            return Color(red: 0.94, green: 0.53, blue: 0.12)
        case "finger-middle":
            return Color(red: 0.94, green: 0.78, blue: 0.16)
        case "finger-index":
            return Color(red: 0.17, green: 0.68, blue: 0.28)
        default:
            return Color(red: 0.82, green: 0.84, blue: 0.86)
        }
    }

    private var foregroundColor: Color {
        fingerClass == "finger-middle" || isSpace ? Color(red: 0.11, green: 0.12, blue: 0.13) : Color.white
    }

    private var borderColor: Color {
        direction == nil ? Color.white.opacity(0.14) : Color.white.opacity(0.88)
    }

    private var shadowColor: Color {
        isPressed ? Color.white.opacity(0.36) : Color.black.opacity(0.24)
    }

    private var accessibilityLabel: String {
        if isSpace { return "Play pause" }
        if let direction { return "\(key.uppercased()) \(direction.rawValue)" }
        return key.uppercased()
    }

    private var fingerClass: String {
        switch key {
        case "q", "a", "y", "p", "ü", "ö", "ä", "-":
            return "finger-pinky"
        case "w", "s", "x", "o", "l", ".":
            return "finger-ring"
        case "e", "d", "c", "i", "k", ",":
            return "finger-middle"
        case "r", "f", "v", "t", "g", "b", "z", "h", "n", "u", "j", "m":
            return "finger-index"
        default:
            return ""
        }
    }
}

struct DirectionBadge: View {
    let direction: ArcadeDirection

    var body: some View {
        Image(systemName: direction.symbolName)
            .font(.system(size: 10, weight: .black))
            .foregroundStyle(Color.white)
            .frame(width: 20, height: 20)
            .background(Circle().fill(Color(red: 0.18, green: 0.19, blue: 0.20)))
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
    }
}

struct KeyboardHandSeparator: View {
    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [Color.clear, Color.white.opacity(0.42), Color.clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: 2, height: 44)
            .padding(.horizontal, 3)
    }
}

private extension View {
    func keyboardTouch(isPressed: Bool, onPress: @escaping () -> Void, onRelease: @escaping () -> Void) -> some View {
        gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        onPress()
                    }
                }
                .onEnded { _ in
                    onRelease()
                }
        )
    }
}
