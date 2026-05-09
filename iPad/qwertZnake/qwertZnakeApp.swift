import SwiftUI

@main
struct QwertZnakeApp: App {
    var body: some Scene {
        WindowGroup {
            WebArcadeView()
                .ignoresSafeArea()
                .statusBarHidden(true)
        }
    }
}
