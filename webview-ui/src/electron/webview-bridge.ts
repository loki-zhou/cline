/**
 * Webview Bridge for Cline Desktop
 *
 * This file provides a bridge between the webview-ui React application and the Electron environment.
 * It should be imported by the webview-ui application to detect and adapt to the Electron environment.
 */

// Define the environment detection interface
interface EnvironmentInfo {
	isElectron: boolean
	isStandalone: boolean
	version: string
	platform: string
}

// Define the bridge interface
interface WebviewBridge {
	// Environment information
	environment: EnvironmentInfo

	// Communication methods
	sendMessage: (command: string, payload: any) => void
	onMessage: (callback: (command: string, payload: any) => void) => () => void

	// gRPC client methods
	grpc: {
		unaryCall: <T>(service: string, method: string, request: any) => Promise<T>
		streamingCall: <T>(
			service: string,
			method: string,
			request: any,
			callbacks: {
				onMessage: (message: T) => void
				onError?: (error: Error) => void
				onComplete?: () => void
			},
		) => { cancel: () => void }
	}
}

// Default environment info
const defaultEnvironment: EnvironmentInfo = {
	isElectron: false,
	isStandalone: false,
	version: "unknown",
	platform: navigator.platform,
}

/**
 * Initialize the webview bridge
 * @returns A promise that resolves to the webview bridge
 */
export async function initializeWebviewBridge(): Promise<WebviewBridge> {
	// Check if we're running in Electron
	const isElectron = !!window.IS_ELECTRON
	const isStandalone = !!window.IS_STANDALONE

	if (!isElectron) {
		console.log("Not running in Electron, using standard VSCode webview bridge")
		return createVSCodeBridge()
	}

	console.log("Running in Electron, using Electron webview bridge")
	return createElectronBridge()
}

/**
 * Create a bridge for the VSCode webview environment
 * @returns The VSCode webview bridge
 */
function createVSCodeBridge(): WebviewBridge {
	// Get the VSCode API
	const vscode = acquireVsCodeApiSafely()

	// Create the environment info
	const environment: EnvironmentInfo = {
		...defaultEnvironment,
		isElectron: false,
		isStandalone: false,
	}

	// Set up message listener
	const listeners = new Set<(command: string, payload: any) => void>()
	window.addEventListener("message", (event) => {
		const message = event.data
		if (message && message.command) {
			listeners.forEach((listener) => {
				try {
					listener(message.command, message.payload)
				} catch (error) {
					console.error("Error in message listener:", error)
				}
			})
		}
	})

	// Create the bridge
	return {
		environment,

		sendMessage: (command: string, payload: any) => {
			vscode.postMessage({ command, payload })
		},

		onMessage: (callback: (command: string, payload: any) => void) => {
			listeners.add(callback)
			return () => {
				listeners.delete(callback)
			}
		},

		grpc: {
			unaryCall: async <T>(service: string, method: string, request: any): Promise<T> => {
				// In VSCode, we send a message to the extension and wait for a response
				return new Promise((resolve, reject) => {
					const requestId = generateRequestId()

					const messageHandler = (event: MessageEvent) => {
						const message = event.data
						if (
							message &&
							message.command === "grpc-response" &&
							message.payload &&
							message.payload.requestId === requestId
						) {
							window.removeEventListener("message", messageHandler)

							if (message.payload.error) {
								reject(new Error(message.payload.error))
							} else {
								resolve(message.payload.response as T)
							}
						}
					}

					window.addEventListener("message", messageHandler)

					vscode.postMessage({
						command: "grpc-request",
						payload: {
							service,
							method,
							request,
							requestId,
						},
					})

					// Set a timeout to prevent hanging forever
					setTimeout(() => {
						window.removeEventListener("message", messageHandler)
						reject(new Error(`gRPC request timed out: ${service}.${method}`))
					}, 30000)
				})
			},

			streamingCall: <T>(
				service: string,
				method: string,
				request: any,
				callbacks: {
					onMessage: (message: T) => void
					onError?: (error: Error) => void
					onComplete?: () => void
				},
			) => {
				const requestId = generateRequestId()

				const messageHandler = (event: MessageEvent) => {
					const message = event.data
					if (
						message &&
						message.command === "grpc-stream" &&
						message.payload &&
						message.payload.requestId === requestId
					) {
						if (message.payload.error) {
							if (callbacks.onError) {
								callbacks.onError(new Error(message.payload.error))
							}
							window.removeEventListener("message", messageHandler)
						} else if (message.payload.complete) {
							if (callbacks.onComplete) {
								callbacks.onComplete()
							}
							window.removeEventListener("message", messageHandler)
						} else {
							callbacks.onMessage(message.payload.response as T)
						}
					}
				}

				window.addEventListener("message", messageHandler)

				vscode.postMessage({
					command: "grpc-stream-request",
					payload: {
						service,
						method,
						request,
						requestId,
					},
				})

				return {
					cancel: () => {
						vscode.postMessage({
							command: "grpc-stream-cancel",
							payload: { requestId },
						})
						window.removeEventListener("message", messageHandler)
					},
				}
			},
		},
	}
}

/**
 * Create a bridge for the Electron environment
 * @returns The Electron webview bridge
 */
function createElectronBridge(): WebviewBridge {
	// Check if the electron_bridge is available
	if (!window.electron_bridge) {
		console.error("electron_bridge not available")
		return createVSCodeBridge() // Fallback to VSCode bridge
	}

	// Create the environment info
	const environment: EnvironmentInfo = {
		...defaultEnvironment,
		isElectron: true,
		isStandalone: true,
	}

	// Get the app version
	window.electron_bridge.app
		.getVersion()
		.then((version) => {
			environment.version = version
		})
		.catch((err) => {
			console.error("Failed to get app version:", err)
		})

	// Set up message listener
	const listeners = new Set<(command: string, payload: any) => void>()
	const cleanup = window.electron_bridge.on("main-to-renderer", (data: any) => {
		if (data && data.command) {
			listeners.forEach((listener) => {
				try {
					listener(data.command, data.payload)
				} catch (error) {
					console.error("Error in message listener:", error)
				}
			})
		}
	})

	// Also listen for custom vscode-message events
	window.addEventListener("vscode-message", (event: any) => {
		const message = event.detail
		if (message && message.command) {
			listeners.forEach((listener) => {
				try {
					listener(message.command, message.payload)
				} catch (error) {
					console.error("Error in message listener:", error)
				}
			})
		}
	})

	// Create the bridge
	return {
		environment,

		sendMessage: (command: string, payload: any) => {
			if (window.electron_bridge) {
				window.electron_bridge.send("renderer-to-main", { command, payload })
			} else {
				console.warn("Electron bridge not available")
			}
		},

		onMessage: (callback: (command: string, payload: any) => void) => {
			listeners.add(callback)
			return () => {
				listeners.delete(callback)
			}
		},

		grpc: {
			unaryCall: async <T>(service: string, method: string, request: any): Promise<T> => {
				if (!window.electron_bridge) {
					throw new Error("Electron bridge not available")
				}
				try {
					return await window.electron_bridge.grpc.unaryCall(service, method, request)
				} catch (error) {
					console.error(`gRPC unary call failed (${service}.${method}):`, error)
					throw error
				}
			},

			streamingCall: <T>(
				service: string,
				method: string,
				request: any,
				callbacks: {
					onMessage: (message: T) => void
					onError?: (error: Error) => void
					onComplete?: () => void
				},
			) => {
				if (!window.electron_bridge) {
					if (callbacks.onError) {
						callbacks.onError(new Error("Electron bridge not available"))
					}
					return { cancel: () => {} }
				}

				try {
					const { cancel } = window.electron_bridge.grpc.streamingCall(service, method, request, (message: any) => {
						callbacks.onMessage(message as T)
					})

					return {
						cancel: () => {
							cancel()
							if (callbacks.onComplete) {
								callbacks.onComplete()
							}
						},
					}
				} catch (error) {
					console.error(`gRPC streaming call failed (${service}.${method}):`, error)
					if (callbacks.onError) {
						callbacks.onError(error as Error)
					}
					return { cancel: () => {} }
				}
			},
		},
	}
}

/**
 * Safely acquire the VSCode API
 * @returns The VSCode API or a mock implementation
 */
function acquireVsCodeApiSafely() {
	try {
		return window.acquireVsCodeApi()
	} catch (error) {
		console.warn("Failed to acquire VSCode API, using mock implementation")

		// Return a mock implementation
		return {
			postMessage: (message: any) => {
				console.log("Mock postMessage:", message)
			},
			getState: () => ({}),
			setState: () => {},
		}
	}
}

/**
 * Generate a unique request ID
 * @returns A unique request ID
 */
function generateRequestId(): string {
	return `req_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`
}

/// <reference path="./types/global.d.ts" />

// Export a function to get the singleton instance
let _webviewBridge: WebviewBridge | null = null
export async function getWebviewBridge(): Promise<WebviewBridge> {
	if (!_webviewBridge) {
		_webviewBridge = await initializeWebviewBridge()
	}
	return _webviewBridge
}
