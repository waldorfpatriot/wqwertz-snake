import SwiftUI

struct LearningKeyboardKeyFrames: PreferenceKey {
    static var defaultValue: [String: Anchor<CGRect>] = [:]

    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue(), uniquingKeysWith: { _, next in next })
    }
}

struct LearningFinger {
    var right: Bool
    var index: Int // Little, ring, middle, index, thumb.
    var instruction: String

    static func forKey(_ key: String) -> LearningFinger {
        let right = key == "backspace" || key == " " || "zhnujmikolpüöä,.-".contains(key)
        let index: Int
        let name: String
        switch key {
        case "backspace", "q", "a", "y", "p", "ü", "ö", "ä", "-": index = 0; name = "kleiner Finger"
        case "w", "s", "x", "o", "l", ".": index = 1; name = "Ringfinger"
        case "e", "d", "c", "i", "k", ",": index = 2; name = "Mittelfinger"
        case " ": index = 4; name = "Daumen"
        default: index = 3; name = "Zeigefinger"
        }
        return LearningFinger(right: right, index: index,
            instruction: "\(QwertZnakeLearningModel.label(key)) — \(right ? "rechter" : "linker") \(name)")
    }
}

struct LearningKeyboardHands: View {
    var frames: [String: CGRect]
    var expectedKey: String?
    var motionId: String
    var paused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var posedKey: String?
    @State private var reach: CGFloat = 0

    var body: some View {
        LearningHandCanvas(frames: frames, activeKey: posedKey, reach: reach)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .task(id: motionId + ":\(paused):\(reduceMotion)") {
                if reduceMotion || paused {
                    var transaction = Transaction()
                    transaction.disablesAnimations = true
                    withTransaction(transaction) {
                        posedKey = paused ? nil : expectedKey
                        reach = paused ? 0 : 1
                    }
                    return
                }
                // Finish the previous reach at home before demonstrating a new target.
                withAnimation(.easeInOut(duration: 0.16)) { reach = 0 }
                do { try await Task.sleep(for: .milliseconds(175)) }
                catch { return }
                guard !Task.isCancelled else { return }
                posedKey = expectedKey
                withAnimation(.easeInOut(duration: 0.28)) { reach = 1 }
            }
    }
}

struct LearningFingerGeometry {
    var index: Int
    var points: [CGPoint] // Finger: MCP/PIP/DIP/tip. Thumb: CMC/MCP/IP/tip.
    var physicalLengths: [CGFloat]
    var width: CGFloat
    var active: Bool
    var isThumb: Bool { index == 4 }
    var phalanxCount: Int { isThumb ? 2 : 3 }
    var jointCount: Int { 3 } // Thumb CMC sits in the palm; only MCP/IP are outside it.
}

struct LearningHandGeometry {
    var right: Bool
    var palm: Path
    var fingers: [LearningFingerGeometry]
    var unit: CGFloat

    static func make(frames: [String: CGRect], right: Bool, activeKey: String?, reach: CGFloat) -> LearningHandGeometry? {
        let homes = right ? ["ö", "l", "k", "j"] : ["a", "s", "d", "f"]
        guard let space = frames[" "], homes.allSatisfy({ frames[$0] != nil }) else { return nil }
        let homeFrames = homes.compactMap { frames[$0] }
        let unit = min(homeFrames[0].height * 1.25, max(homeFrames[0].height * 1.12, homeFrames[0].width * 0.66))
        guard unit > 0 else { return nil }
        let inward: CGFloat = right ? -1 : 1
        let active = activeKey.map(LearningFinger.forKey)
        let controlReach = activeKey == "backspace" && active?.right == right
        let lengths: [CGFloat] = [2.35, 2.85, 3.05, 2.85]
        let depths: [CGFloat] = [1.23, 1.55, 1.65, 1.5]
        var roots = homeFrames.enumerated().map { index, rect in
            CGPoint(x: rect.midX + inward * unit * [0.2, 0.07, -0.04, -0.12][index],
                    y: rect.midY + unit * depths[index])
        }
        let palmCenter = (roots[1].x + roots[2].x) / 2
        let wristY = space.maxY + unit * 0.14
        var thumbCMC = CGPoint(x: palmCenter + inward * unit * 0.28, y: wristY - unit * 0.23)
        let thumbLengths = [unit * 1.4, unit * 1.1, unit * 0.8]
        let preferredThumbX = thumbCMC.x + inward * thumbLengths.reduce(0, +) * 0.85
        let thumbHomeX = right
            ? min(space.maxX - 3, max(space.midX + unit * 0.25, preferredThumbX))
            : max(space.minX + 3, min(space.midX - unit * 0.25, preferredThumbX))
        var handShift = CGPoint.zero
        if let active, active.right == right, let target = activeKey.flatMap({ frames[$0] }) {
            let root = active.index == 4 ? thumbCMC : roots[active.index]
            let fullLength = active.index == 4 ? thumbLengths.reduce(0, +) : unit * lengths[active.index]
            let targetPoint = active.index == 4 ? CGPoint(x: space.minX + space.width * 0.72, y: space.midY) : CGPoint(x: target.midX, y: target.midY)
            let delta = CGPoint(x: targetPoint.x - root.x, y: targetPoint.y - root.y)
            let distance = hypot(delta.x, delta.y)
            // A modest rigid palm movement handles extreme reaches instead of stretching bones.
            let excess = max(0, distance - fullLength * 0.94)
            if distance > 0 { handShift = CGPoint(x: delta.x / distance * excess * reach, y: delta.y / distance * excess * reach) }
            if active.index < 4, target.midY > homeFrames[active.index].midY + unit * 0.45 {
                // Lower-row flexion brings the palm slightly back, keeping all three knuckles legible.
                let vertical = sqrt(max(0, pow(fullLength * 0.55, 2) - pow(delta.x, 2)))
                handShift.y = max(handShift.y, (target.midY + vertical - root.y) * reach)
            }
        }
        roots = roots.map { $0.adding(handShift) }
        thumbCMC = thumbCMC.adding(handShift)
        let wrist = CGPoint(x: palmCenter + handShift.x, y: wristY + handShift.y)
        let palmSpan = abs(roots[3].x - roots[0].x)
        var palm = Path()
        // The curved knuckle ridge, tapered wrist and thenar bulge are mirrored geometrically.
        palm.move(to: CGPoint(x: roots[0].x - inward * unit * 0.28, y: roots[0].y))
        palm.addCurve(to: roots[3],
            control1: CGPoint(x: roots[1].x, y: roots[1].y - unit * 0.28),
            control2: CGPoint(x: roots[2].x, y: roots[2].y - unit * 0.28))
        palm.addCurve(to: CGPoint(x: wrist.x + inward * palmSpan * 0.28, y: wrist.y),
            control1: CGPoint(x: roots[3].x + inward * unit * 0.35, y: roots[3].y + unit * 0.65),
            control2: CGPoint(x: wrist.x + inward * palmSpan * 0.34, y: wrist.y - unit * 0.08))
        palm.addLine(to: CGPoint(x: wrist.x - inward * palmSpan * 0.28, y: wrist.y))
        palm.addCurve(to: CGPoint(x: roots[0].x - inward * unit * 0.28, y: roots[0].y),
            control1: CGPoint(x: wrist.x - inward * palmSpan * 0.40, y: wrist.y - unit * 0.17),
            control2: CGPoint(x: roots[0].x - inward * unit * 0.38, y: roots[0].y + unit * 0.56))
        palm.closeSubpath()

        var fingers = homeFrames.enumerated().map { index, rect in
            let isActive = active?.right == right && active?.index == index
            // A Backspace reach lifts the whole hand; the other fingers move with its palm.
            let home = CGPoint(x: rect.midX, y: rect.midY).adding(controlReach && !isActive ? handShift : .zero)
            let target = isActive ? activeKey.flatMap { frames[$0] }.map { CGPoint(x: $0.midX, y: $0.midY) } ?? home : home
            let tip = home.interpolated(to: target, amount: reach)
            let physical = [0.48, 0.31, 0.21].map { unit * lengths[index] * $0 }
            return LearningFingerGeometry(index: index,
                points: projectedChain(root: roots[index], tip: tip, lengths: physical, thumb: false),
                physicalLengths: physical,
                width: min(unit * (index == 0 ? 0.73 : 0.9), rect.width * (index == 0 ? 0.45 : 0.58)), active: isActive)
        }
        let thumbHome = CGPoint(x: thumbHomeX, y: space.maxY - unit * 0.06).adding(controlReach ? handShift : .zero)
        let thumbActive = active?.right == right && active?.index == 4
        let thumbTip = thumbHome.interpolated(to: thumbActive ? CGPoint(x: space.minX + space.width * 0.72, y: space.midY) : thumbHome, amount: reach)
        fingers.append(LearningFingerGeometry(index: 4,
            points: projectedChain(root: thumbCMC, tip: thumbTip, lengths: thumbLengths, thumb: true),
            physicalLengths: thumbLengths, width: min(unit * 1.05, homeFrames[0].width * 0.67), active: thumbActive))
        return LearningHandGeometry(right: right, palm: palm, fingers: fingers, unit: unit)
    }

    private static func projectedChain(root: CGPoint, tip: CGPoint, lengths: [CGFloat], thumb: Bool) -> [CGPoint] {
        let delta = CGPoint(x: tip.x - root.x, y: tip.y - root.y)
        let distance = hypot(delta.x, delta.y)
        guard distance > 0 else { return Array(repeating: root, count: 4) }
        let fullLength = lengths.reduce(0, +)
        let required = min(distance, fullLength)
        // Flexion happens in depth: distal phalanges foreshorten more than the proximal one.
        // This preserves fixed bone lengths without giving PIP/DIP sideways bends.
        let powers: [CGFloat] = thumb ? [0.8, 1.05, 1.25] : [0.8, 1.2, 1.5]
        var low: CGFloat = 0, high: CGFloat = 1
        for _ in 0..<32 {
            let mid = (low + high) / 2
            let projected = zip(lengths, powers).reduce(CGFloat.zero) { $0 + $1.0 * pow(mid, $1.1) }
            if projected < required { low = mid } else { high = mid }
        }
        let extensionAmount = (low + high) / 2
        let direction = CGPoint(x: delta.x / distance, y: delta.y / distance)
        var points = [root]
        for (length, power) in zip(lengths, powers) {
            let previous = points.last!
            let projected = length * pow(extensionAmount, power)
            points.append(CGPoint(x: previous.x + direction.x * projected, y: previous.y + direction.y * projected))
        }
        return points
    }
}

struct LearningHandCanvas: View, Animatable {
    var frames: [String: CGRect]
    var activeKey: String?
    var reach: CGFloat

    var animatableData: CGFloat {
        get { reach }
        set { reach = newValue }
    }

    var body: some View {
        Canvas { context, _ in
            for right in [false, true] {
                guard let hand = LearningHandGeometry.make(frames: frames, right: right, activeKey: activeKey, reach: reach) else { continue }
                draw(hand, in: &context)
            }
        }
    }

    private func draw(_ hand: LearningHandGeometry, in context: inout GraphicsContext) {
        let skin = Color(red: 0.96, green: 0.80, blue: 0.68)
        let outline = Color(red: 0.92, green: 0.81, blue: 0.72)
        let accent = Color(red: 0.72, green: 0.93, blue: 0.53)
        context.fill(hand.palm, with: .color(skin.opacity(0.09)))
        context.stroke(hand.palm, with: .color(outline.opacity(0.4)), lineWidth: 1.15)

        // The thumb metacarpal stays in the palm; it is not a third external phalanx.
        if let thumb = hand.fingers.last {
            let cmc = thumb.points[0]
            let mcp = thumb.points[1]
            var thenar = Path()
            thenar.move(to: cmc)
            thenar.addQuadCurve(to: mcp, control: CGPoint(x: cmc.x, y: mcp.y))
            context.stroke(thenar, with: .color(outline.opacity(0.38)), lineWidth: 1)
            context.stroke(Path(ellipseIn: CGRect(x: cmc.x - 2.5, y: cmc.y - 2.5, width: 5, height: 5)), with: .color(outline.opacity(0.4)), lineWidth: 1)
        }
        for finger in hand.fingers {
            let firstSegment = finger.isThumb ? 1 : 0
            let fill = finger.active ? accent.opacity(0.17) : skin.opacity(0.10)
            let edge = finger.active ? accent.opacity(0.78) : outline.opacity(0.52)
            for segment in firstSegment..<3 {
                let start = finger.points[segment]
                let end = finger.points[segment + 1]
                let radius = finger.width * [0.5, 0.43, 0.34][segment]
                let shaft = taperedPhalanx(from: start, to: end, startRadius: radius, endRadius: radius * 0.83)
                context.fill(shaft, with: .color(fill))
                context.stroke(shaft, with: .color(edge), lineWidth: finger.active ? 1.55 : 1)
            }
            // MCP is the basal knuckle; PIP and DIP have their own visible transverse creases.
            for joint in firstSegment..<3 {
                let center = finger.points[joint]
                let next = finger.points[joint + 1]
                let radius = finger.width * [0.4, 0.33, 0.27][joint]
                let direction = unitVector(from: center, to: next)
                let rotation = CGAffineTransform(rotationAngle: atan2(direction.y, direction.x) + .pi / 2)
                    .concatenating(CGAffineTransform(translationX: center.x, y: center.y))
                let knuckle = Path(ellipseIn: CGRect(x: -radius, y: -radius * 0.62, width: radius * 2, height: radius * 1.24)).applying(rotation)
                context.stroke(knuckle, with: .color(edge.opacity(0.8)), lineWidth: 1)
                let normal = CGPoint(x: -direction.y, y: direction.x)
                var crease = Path()
                crease.move(to: CGPoint(x: center.x - normal.x * radius, y: center.y - normal.y * radius))
                crease.addQuadCurve(to: CGPoint(x: center.x + normal.x * radius, y: center.y + normal.y * radius),
                    control: CGPoint(x: center.x + direction.x * radius * 0.32, y: center.y + direction.y * radius * 0.32))
                context.stroke(crease, with: .color(edge), lineWidth: 1.1)
            }
            let tip = finger.points[3]
            let direction = unitVector(from: finger.points[2], to: tip)
            let nail = CGPoint(x: tip.x - direction.x * finger.width * 0.29, y: tip.y - direction.y * finger.width * 0.29)
            context.stroke(Path(ellipseIn: CGRect(x: nail.x - finger.width * 0.18, y: nail.y - finger.width * 0.23,
                width: finger.width * 0.36, height: finger.width * 0.46)), with: .color(edge.opacity(0.65)), lineWidth: 0.8)
        }
    }

    private func taperedPhalanx(from start: CGPoint, to end: CGPoint, startRadius: CGFloat, endRadius: CGFloat) -> Path {
        let direction = unitVector(from: start, to: end)
        let normal = CGPoint(x: -direction.y, y: direction.x)
        var path = Path()
        path.move(to: CGPoint(x: start.x + normal.x * startRadius, y: start.y + normal.y * startRadius))
        path.addLine(to: CGPoint(x: end.x + normal.x * endRadius, y: end.y + normal.y * endRadius))
        path.addQuadCurve(to: CGPoint(x: end.x - normal.x * endRadius, y: end.y - normal.y * endRadius),
            control: CGPoint(x: end.x + direction.x * endRadius, y: end.y + direction.y * endRadius))
        path.addLine(to: CGPoint(x: start.x - normal.x * startRadius, y: start.y - normal.y * startRadius))
        path.addQuadCurve(to: CGPoint(x: start.x + normal.x * startRadius, y: start.y + normal.y * startRadius),
            control: CGPoint(x: start.x - direction.x * startRadius, y: start.y - direction.y * startRadius))
        path.closeSubpath()
        return path
    }

    private func unitVector(from start: CGPoint, to end: CGPoint) -> CGPoint {
        let length = max(0.0001, hypot(end.x - start.x, end.y - start.y))
        return CGPoint(x: (end.x - start.x) / length, y: (end.y - start.y) / length)
    }
}

private extension CGPoint {
    func adding(_ other: CGPoint) -> CGPoint { CGPoint(x: x + other.x, y: y + other.y) }
    func interpolated(to other: CGPoint, amount: CGFloat) -> CGPoint {
        CGPoint(x: x + (other.x - x) * amount, y: y + (other.y - y) * amount)
    }
}
