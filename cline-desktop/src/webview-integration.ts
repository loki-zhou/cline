/**
 * Webview Integration for Cline Desktop
 *
 * This file provides integration between the webview-ui React application and the Electron desktop environment.
 * It should be copied to the webview-ui/src directory to enable Electron integration.
 */

import { getWebviewBridge } from "./webview-bridge"

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

// Store for the bridge instance
let _bridge: WebviewBridge | null = null

/**
 * Initialize the integration with the Electron desktop environment
 * @returns A promise that resolves when the integration is complete
 */
export async function initializeElectronIntegration(): Promise<void> {
	try {
		// Get the bridge instance
		_bridge = await getWebviewBridge()

		// Log the environment information
		console.log("Electron integration initialized:", _bridge.environment)

		// Send a ready message to the Electron process
		_bridge.sendMessage("webview-ready", {
			timestamp: Date.now(),
			userAgent: navigator.userAgent,
		})

		// Set up a message listener for debugging
		_bridge.onMessage((command, payload) => {
			console.log(`Received message from Electron: ${command}`, payload)
		})

		// Add a class to the body to enable Electron-specific styling
		if (_bridge.environment.isElectron) {
			document.body.classList.add("electron-app")

			// Also add a class for standalone mode
			if (_bridge.environment.isStandalone) {
				document.body.classList.add("standalone-app")
			}
		}
	} catch (error) {
		console.error("Failed to initialize Electron integration:", error)
	}
}

/**
 * Check if the application is running in Electron
 * @returns True if running in Electron, false otherwise
 */
export function isElectron(): boolean {
	return _bridge?.environment.isElectron || false
}

/**
 * Check if the application is running in standalone mode
 * @returns True if running in standalone mode, false otherwise
 */
export function isStandalone(): boolean {
	return _bridge?.environment.isStandalone || false
}

/**
 * Get the bridge instance
 * @returns The bridge instance, or null if not initialized
 */
export function getBridge(): WebviewBridge | null {
	return _bridge
}

/**
 * Send a message to the Electron process
 * @param command The command to send
 * @param payload The payload to send
 */
export function sendMessage(command: string, payload: any): void {
	_bridge?.sendMessage(command, payload)
}

/**
 * Register a message handler
 * @param callback The callback to invoke when a message is received
 * @returns A function to unregister the handler
 */
export function onMessage(callback: (command: string, payload: any) => void): () => void {
	return _bridge?.onMessage(callback) || (() => {})
}

/**
 * Make a unary gRPC call
 * @param service The service name
 * @param method The method name
 * @param request The request payload
 * @returns A promise that resolves to the response
 */
export async function grpcUnaryCall<T>(service: string, method: string, request: any): Promise<T> {
	if (!_bridge) {
		throw new Error("Electron integration not initialized")
	}

	return _bridge.grpc.unaryCall<T>(service, method, request)
}

/**
 * Make a streaming gRPC call
 * @param service The service name
 * @param method The method name
 * @param request The request payload
 * @param callbacks The callbacks to invoke for stream events
 * @returns An object with a cancel method
 */
export function grpcStreamingCall<T>(
	service: string,
	method: string,
	request: any,
	callbacks: {
		onMessage: (message: T) => void
		onError?: (error: Error) => void
		onComplete?: () => void
	},
): { cancel: () => void } {
	if (!_bridge) {
		throw new Error("Electron integration not initialized")
	}

	return _bridge.grpc.streamingCall<T>(service, method, request, callbacks)
}

// Initialize the integration automatically
initializeElectronIntegration().catch((error) => {
	console.error("Failed to initialize Electron integration:", error)
})

// Export the bridge types for TypeScript users
export type { EnvironmentInfo, WebviewBridge }
