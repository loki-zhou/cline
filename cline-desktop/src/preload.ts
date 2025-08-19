/// <reference path="./types/global.d.ts" />
import { contextBridge, ipcRenderer } from "electron"
import { v4 as uuidv4 } from "uuid"

// Store for tracking active gRPC requests
const activeRequests = new Map<string, AbortController>()

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld("electron_bridge", {
	// Flag to identify the Electron environment
	isStandalone: true,

	// Function to send a message to the main process
	send: (channel: string, data: any) => {
		ipcRenderer.send(channel, data)
	},

	// Function to receive messages from the main process
	on: (channel: string, func: (...args: any[]) => void) => {
		const subscription = (event: any, ...args: any[]) => func(...args)
		ipcRenderer.on(channel, subscription)

		// Return a cleanup function
		return () => {
			ipcRenderer.removeListener(channel, subscription)
		}
	},

	// gRPC client for communicating with Cline Core
	grpc: {
		// Make a unary gRPC call
		unaryCall: (service: string, method: string, request: any): Promise<any> => {
			return new Promise((resolve, reject) => {
				const requestId = uuidv4()

				// Set up one-time response handler
				const responseHandler = (event: any, response: any) => {
					if (response.requestId === requestId) {
						// Clean up listener
						ipcRenderer.removeListener("grpc-response", responseHandler)

						if (response.error) {
							reject(new Error(response.error))
						} else {
							resolve(response.message)
						}
					}
				}

				// Register response handler
				ipcRenderer.on("grpc-response", responseHandler)

				// Send request to main process
				ipcRenderer.send("grpc-request", {
					service,
					method,
					request,
					requestId,
					is_streaming: false,
				})
			})
		},

		// Make a streaming gRPC call
		streamingCall: (
			service: string,
			method: string,
			request: any,
			onMessage: (message: any) => void,
		): { cancel: () => void } => {
			const requestId = uuidv4()
			const abortController = new AbortController()

			// Store the abort controller for this request
			activeRequests.set(requestId, abortController)

			// Set up response handler for streaming
			const responseHandler = (event: any, response: any) => {
				if (response.requestId === requestId) {
					if (response.error) {
						console.error(`Streaming error: ${response.error}`)
						cleanup()
					} else if (response.is_streaming === false) {
						// End of stream
						cleanup()
					} else {
						// Stream message
						onMessage(response.message)
					}
				}
			}

			// Register response handler
			ipcRenderer.on("grpc-response", responseHandler)

			// Function to clean up resources
			const cleanup = () => {
				ipcRenderer.removeListener("grpc-response", responseHandler)
				activeRequests.delete(requestId)
			}

			// Send request to main process
			ipcRenderer.send("grpc-request", {
				service,
				method,
				request,
				requestId,
				is_streaming: true,
			})

			// Return cancel function
			return {
				cancel: () => {
					ipcRenderer.send("grpc-request-cancel", { requestId })
					cleanup()
				},
			}
		},
	},

	// File system operations
	fs: {
		// Get user's home directory
		getHomePath: (): Promise<string> => {
			return new Promise((resolve) => {
				ipcRenderer.once("fs-home-path-response", (_, path) => {
					resolve(path)
				})
				ipcRenderer.send("fs-get-home-path")
			})
		},

		// Get app's user data directory
		getUserDataPath: (): Promise<string> => {
			return new Promise((resolve) => {
				ipcRenderer.once("fs-user-data-path-response", (_, path) => {
					resolve(path)
				})
				ipcRenderer.send("fs-get-user-data-path")
			})
		},
	},

	// App information
	app: {
		// Get app version
		getVersion: (): Promise<string> => {
			return new Promise((resolve) => {
				ipcRenderer.once("app-version-response", (_, version) => {
					resolve(version)
				})
				ipcRenderer.send("app-get-version")
			})
		},
	},
})
