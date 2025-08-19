/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * It initializes the renderer process for the Cline Desktop application and integrates
 * with the webview-ui React application.
 */

import "./index.css"
import { initializeElectronAdapter, sendMessageToWebview } from "./electron-adapter"

/// <reference path="./types/global.d.ts" />

console.log("🚀 Initializing Cline Desktop renderer process")

// Set global flags to indicate we're running in Electron standalone mode
window.IS_ELECTRON = true
window.IS_STANDALONE = true

// Create a mock vscode API for the webview-ui to use
window.acquireVsCodeApi = () => {
	// This mock implementation provides the minimal functionality needed by the webview-ui
	return {
		postMessage: (message: any) => {
			console.log("Webview posted message:", message)
			handleWebviewMessage(message)
		},
		getState: () => {
			// Try to get state from localStorage
			try {
				const state = localStorage.getItem("cline_webview_state")
				return state ? JSON.parse(state) : {}
			} catch (err) {
				console.error("Failed to get state from localStorage:", err)
				return {}
			}
		},
		setState: (state: any) => {
			// Store state in localStorage
			try {
				localStorage.setItem("cline_webview_state", JSON.stringify(state))
			} catch (err) {
				console.error("Failed to set state in localStorage:", err)
			}
		},
	}
}

// Create a gRPC client for the webview-ui to use
window.clineGrpcClient = {
	// Unary call implementation
	unaryCall: async (service: string, method: string, request: any) => {
		try {
			return await window.electron_bridge.grpc.unaryCall(service, method, request)
		} catch (error) {
			console.error(`gRPC unary call failed (${service}.${method}):`, error)
			throw error
		}
	},

	// Streaming call implementation
	streamingCall: (service: string, method: string, request: any, callbacks: any) => {
		const { onMessage, onError, onComplete } = callbacks

		try {
			const { cancel } = window.electron_bridge.grpc.streamingCall(service, method, request, (message: any) => {
				if (onMessage) {
					onMessage(message)
				}
			})

			return {
				cancel: () => {
					cancel()
					if (onComplete) {
						onComplete()
					}
				},
			}
		} catch (error) {
			console.error(`gRPC streaming call failed (${service}.${method}):`, error)
			if (onError) {
				onError(error)
			}
			return { cancel: () => {} }
		}
	},
}

// Handle messages from the webview-ui
function handleWebviewMessage(message: any) {
	const { command, payload } = message

	switch (command) {
		case "ready":
			console.log("Webview UI is ready")
			// Notify that the app is loaded
			if (window.appLoaded) {
				window.appLoaded()
			}
			break

		case "grpc-request":
			// This is handled by the clineGrpcClient above
			break

		case "get-app-info":
			// Send app info back to the webview
			window.electron_bridge.app.getVersion().then((version) => {
				// Simulate a message from the extension
				const responseEvent = new CustomEvent("message", {
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
			console.log("Unknown command from webview:", command)
	}
}

// Log app version
window.electron_bridge.app
	.getVersion()
	.then((version) => {
		console.log(`Cline Desktop version: ${version}`)
	})
	.catch((err) => {
		console.error("Failed to get app version:", err)
	})

// Initialize any renderer-specific code here
document.addEventListener("DOMContentLoaded", () => {
	console.log("DOM fully loaded, Cline UI ready to initialize")

	// Add a class to the body to enable Electron-specific styling if needed
	document.body.classList.add("electron-app")

	// Initialize the Electron adapter
	initializeElectronAdapter()

	// Send initial ready message to the webview-ui
	setTimeout(() => {
		sendMessageToWebview("electron-ready", {
			version: "loading...",
			isElectron: true,
			isStandalone: true,
		})

		// Get and send the actual version
		window.electron_bridge.app.getVersion().then((version) => {
			sendMessageToWebview("electron-ready", {
				version,
				isElectron: true,
				isStandalone: true,
			})
		})
	}, 1000)

	// Set up message event listener for communication with the webview-ui
	window.addEventListener("message", (event) => {
		// Handle messages from the webview-ui (if needed)
		if (event.source === window && event.data) {
			console.log("Received message from webview-ui:", event.data)
		}
	})
})

// Create a global error handler
window.addEventListener("error", (event) => {
	console.error("Uncaught error:", event.error)
})

// Create a global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
	console.error("Unhandled promise rejection:", event.reason)
})
