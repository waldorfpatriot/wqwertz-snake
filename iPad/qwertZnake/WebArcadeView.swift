import SwiftUI
import WebKit

final class ArcadeKeyboardModel: ObservableObject {
    @Published private(set) var state = ArcadeKeyboardState()
    @Published private(set) var pressedKeys: Set<String> = []

    weak var webView: WKWebView?

    func press(_ key: String) {
        guard !pressedKeys.contains(key) else { return }
        pressedKeys.insert(key)
        sendKeyScript(functionName: "qwertznakeNativeKeyDown", key: key)
    }

    func release(_ key: String) {
        guard pressedKeys.remove(key) != nil else { return }
        sendKeyScript(functionName: "qwertznakeNativeKeyUp", key: key)
    }

    func update(from messageBody: Any) {
        guard let payload = messageBody as? [String: Any] else { return }

        var nextState = state
        if let controlKeys = payload["controlKeys"] as? [String: String], !controlKeys.isEmpty {
            nextState.controlKeys = controlKeys
        }
        if let activeKeys = payload["activeKeys"] as? [String] {
            nextState.activeKeys = Set(activeKeys)
        }
        if let rejectedKeys = payload["rejectedKeys"] as? [String] {
            nextState.rejectedKeys = Set(rejectedKeys)
        }
        nextState.isConnected = true
        state = nextState
    }

    private func sendKeyScript(functionName: String, key: String) {
        guard let argument = Self.javascriptStringLiteral(for: key) else { return }
        webView?.evaluateJavaScript("window.\(functionName) && window.\(functionName)(\(argument));")
    }

    private static func javascriptStringLiteral(for value: String) -> String? {
        guard
            let data = try? JSONSerialization.data(withJSONObject: [value]),
            let json = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return String(json.dropFirst().dropLast())
    }
}

struct ArcadeKeyboardState: Equatable {
    var controlKeys: [String: String] = [
        "up": "t",
        "down": "b",
        "left": "f",
        "right": "j"
    ]
    var activeKeys: Set<String> = []
    var rejectedKeys: Set<String> = []
    var isConnected = false

    func direction(for key: String) -> ArcadeDirection? {
        ArcadeDirection.allCases.first { controlKeys[$0.rawValue] == key }
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
}

struct WebArcadeView: UIViewRepresentable {
    private let scheme = "qwertznake"
    private let host = "local"
    @ObservedObject var keyboardModel: ArcadeKeyboardModel

    func makeCoordinator() -> Coordinator {
        Coordinator(keyboardModel: keyboardModel)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(LocalWebSchemeHandler(), forURLScheme: scheme)
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.userContentController.add(context.coordinator, name: "qwertznakeKeyboard")
        configuration.userContentController.addUserScript(Self.nativeKeyboardBridgeScript)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        keyboardModel.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        webView.load(URLRequest(url: URL(string: "\(scheme)://\(host)/index.html")!))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "qwertznakeKeyboard")
        coordinator.keyboardModel.webView = nil
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let keyboardModel: ArcadeKeyboardModel

        init(keyboardModel: ArcadeKeyboardModel) {
            self.keyboardModel = keyboardModel
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "qwertznakeKeyboard" else { return }
            DispatchQueue.main.async {
                self.keyboardModel.update(from: message.body)
            }
        }
    }
}

private extension WebArcadeView {
    static let nativeKeyboardBridgeScript = WKUserScript(
        source: """
        (function() {
            if (window.qwertznakeNativeKeyboardInstalled) { return; }
            window.qwertznakeNativeKeyboardInstalled = true;

            function normalizedKey(rawKey) {
                return rawKey === "Space" ? " " : String(rawKey || "");
            }

            function keyboardCode(key) {
                if (key === " ") { return "Space"; }
                if (/^[a-z]$/i.test(key)) { return "Key" + key.toUpperCase(); }
                return "";
            }

            function dispatchKeyboardEvent(type, rawKey) {
                var key = normalizedKey(rawKey);
                if (!key) { return; }

                document.dispatchEvent(new KeyboardEvent(type, {
                    key: key,
                    code: keyboardCode(key),
                    bubbles: true,
                    cancelable: true
                }));
            }

            window.qwertznakeNativeKeyDown = function(key) {
                dispatchKeyboardEvent("keydown", key);
            };

            window.qwertznakeNativeKeyUp = function(key) {
                dispatchKeyboardEvent("keyup", key);
            };

            function installStyle() {
                if (document.getElementById("qwertznake-native-keyboard-style")) { return; }
                var style = document.createElement("style");
                style.id = "qwertznake-native-keyboard-style";
                style.textContent = ".keyboard-section{display:none!important}.main-content{padding-bottom:0!important}";
                document.head.appendChild(style);
            }

            function readKeyboardState() {
                var root = document.getElementById("virtualKeyboard");
                if (!root) { return null; }

                var controlKeys = {};
                var activeKeys = [];
                var rejectedKeys = [];
                root.querySelectorAll(".keyboard-key[data-key]").forEach(function(element) {
                    var key = element.dataset.key || "";
                    var direction = element.getAttribute("data-direction");
                    if (direction) {
                        controlKeys[direction] = key;
                    }
                    if (element.classList.contains("active")) {
                        activeKeys.push(key);
                    }
                    if (element.classList.contains("unmapped-key")) {
                        rejectedKeys.push(key);
                    }
                });

                return {
                    controlKeys: controlKeys,
                    activeKeys: activeKeys,
                    rejectedKeys: rejectedKeys
                };
            }

            var lastPostedState = "";
            function postKeyboardState() {
                var state = readKeyboardState();
                if (!state) { return; }

                var serialized = JSON.stringify(state);
                if (serialized === lastPostedState) { return; }
                lastPostedState = serialized;

                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.qwertznakeKeyboard) {
                    window.webkit.messageHandlers.qwertznakeKeyboard.postMessage(state);
                }
            }

            function observeKeyboard() {
                installStyle();
                var root = document.getElementById("virtualKeyboard");
                if (!root) {
                    window.setTimeout(observeKeyboard, 80);
                    return;
                }

                new MutationObserver(postKeyboardState).observe(root, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    attributeFilter: ["class", "data-direction", "data-arrow"]
                });
                postKeyboardState();
            }

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", observeKeyboard);
            } else {
                observeKeyboard();
            }
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )
}
