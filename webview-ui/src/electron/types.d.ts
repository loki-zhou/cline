/**
 * Type definitions for Electron integration in webview-ui
 */

declare global {
	interface Window {
		IS_ELECTRON?: boolean
		IS_STANDALONE?: boolean
		electron_bridge?: {
			isStandalone: boolean
			send: (channel: string, data: any) => void
			on: (channel: string, func: (...args: any[]) => void) => () => void
			grpc: {
				unaryCall: (service: string, method: string, request: any) => Promise<any>
				streamingCall: (
					service: string,
					method: string,
					request: any,
					onMessage: (message: any) => void,
				) => { cancel: () => void }
			}
			fs: {
				getHomePath: () => Promise<string>
				getUserDataPath: () => Promise<string>
			}
			app: {
				getVersion: () => Promise<string>
			}
		}
	}
}

export {}
