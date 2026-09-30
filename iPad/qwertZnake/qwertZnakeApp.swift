import SwiftUI

@main
struct QwertZnakeApp: App {
    @StateObject private var game = QwertZnakeGameModel()

    var body: some Scene {
        WindowGroup {
            QwertZnakeRootView(game: game)
        }
    }
}
