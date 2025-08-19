/**
 * Electron Adapter for Cline Desktop
 *
 * This adapter provides compatibility between the webview-ui React application
 * and the Electron desktop environment. It intercepts and translates messages
 * between the two systems, ensuring they can communicate effectively.
 */

// Define the message handler type
type MessageHandler = (message: any) => void

// Store for message handlers
const messageHandlers: MessageHandler[] = []

/**
 * Initialize the Electron adapter
 * This should be called as early as possible in the renderer process
 */
export function initializeElectronAdapter() {
	if (!window.IS_ELECTRON) {
		console.warn("Electron adapter initialized in non-Electron environment")
		return
	}

	console.log("Initializing Electron adapter")

	// Intercept postMessage calls from the webview-ui
	interceptVSCodeApi()

	// Set up message listener for messages from the main process
	setupElectronMessageListener()

	// Notify that the adapter is ready
	console.log("Electron adapter initialized")
}

/**
 * Intercept the acquireVsCodeApi function to provide a compatible implementation
 */
function interceptVSCodeApi() {
	// The actual implementation is in renderer.ts
	// This function is just to ensure it's properly set up
	if (!window.acquireVsCodeApi) {
		console.error("acquireVsCodeApi not defined in window")

		// Provide a fallback implementation
		window.acquireVsCodeApi = () => ({
			postMessage: (message: any) => {
				console.warn("Fallback postMessage called:", message)
				handleWebviewMessage(message)
			},
			getState: () => ({}),
			setState: () => {},
		})
	}
}

/**
 * Set up listener for messages from the Electron main process
 */
function setupElectronMessageListener() {
	if (!window.electron_bridge) {
		console.error("electron_bridge not available")
		return
	}

	// Listen for messages from the main process
	window.electron_bridge.on("main-to-renderer", (data: any) => {
		console.log("Received message from main process:", data)

		// Convert to a format expected by the webview-ui
		const webviewMessage = {
			command: data.command,
			payload: data.payload,
		}

		// Dispatch as a custom event that the webview-ui can listen for
		window.dispatchEvent(
			new CustomEvent("vscode-message", {
				detail: webviewMessage,
			}),
		)

		// Also notify any registered handlers
		notifyMessageHandlers(webviewMessage)
	})
}

/**
 * Handle messages from the webview-ui
 */
function handleWebviewMessage(message: any) {
	if (!window.electron_bridge) {
		console.error("electron_bridge not available")
		return
	}

	console.log("Handling webview message:", message)

	const { command, payload } = message

	// Special handling for certain commands
	switch (command) {
		case "ready":
			console.log("Webview UI is ready")
			// Notify that the app is loaded
			if (window.appLoaded) {
				window.appLoaded()
			}
			break

		case "get-app-info":
			// Handle directly in the renderer
			window.electron_bridge.app.getVersion().then((version) => {
				const responseEvent = new CustomEvent("vscode-message", {
					detail: {
						command: "app-info",
						payload: {
							version,
							isElectron: true,
							isStandalone: true,
							platform: navigator.platform,
							userAgent: navigator.userAgent,
						},
					},
				})
				window.dispatchEvent(responseEvent)
			})
			break

		default:
			// Forward other messages to the main process
			window.electron_bridge.send("renderer-to-main", message)
			break
	}

	// Also notify any registered handlers
	notifyMessageHandlers(message)
}

/**
 * Register a handler for messages
 * @param handler The handler function to register
 * @returns A function to unregister the handler
 */
export function registerMessageHandler(handler: MessageHandler): () => void {
	messageHandlers.push(handler)
	return () => {
		const index = messageHandlers.indexOf(handler)
		if (index !== -1) {
			messageHandlers.splice(index, 1)
		}
	}
}

/**
 * Notify all registered message handlers
 * @param message The message to notify handlers about
 */
function notifyMessageHandlers(message: any) {
	messageHandlers.forEach((handler) => {
		try {
			handler(message)
		} catch (error) {
			console.error("Error in message handler:", error)
		}
	})
}

/**
 * Send a message to the webview-ui
 * @param command The command to send
 * @param payload The payload to send
 */
export function sendMessageToWebview(command: string, payload: any) {
	const event = new CustomEvent("vscode-message", {
		detail: { command, payload },
	})
	window.dispatchEvent(event)
}

/**
 * Send a message to the main process
 * @param command The command to send
 * @param payload The payload to send
 */
export function sendMessageToMain(command: string, payload: any) {
	if (!window.electron_bridge) {
		console.error("electron_bridge not available")
		return
	}

	window.electron_bridge.send("renderer-to-main", { command, payload })
}
