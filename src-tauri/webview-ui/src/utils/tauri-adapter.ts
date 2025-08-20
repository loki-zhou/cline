import { WebviewMessage } from "@shared/WebviewMessage"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

/**
 * Tauri 适配器，用于将 VS Code API 调用转换为 Tauri API 调用
 */
export class TauriAdapter {
	private messageListeners: ((message: any) => void)[] = []

	constructor() {
		this.setupEventListeners()
	}

	private async setupEventListeners() {
		// 监听来自 Rust 后端的消息
		await listen("webview-message", (event) => {
			const message = event.payload
			console.log("收到来自 Tauri 后端的消息:", message)

			// 如果是 gRPC 响应，则创建一个 MessageEvent 并分发给窗口
			if (message.type === "grpc_response") {
				const messageEvent = new MessageEvent("message", {
					data: message,
				})
				window.dispatchEvent(messageEvent)
			}

			this.messageListeners.forEach((listener) => {
				listener(message)
			})
		})
	}

	/**
	 * 发送消息到 Tauri 后端
	 */
	async postMessage(message: WebviewMessage): Promise<void> {
		try {
			await invoke("handle_webview_message", { message })
		} catch (error) {
			console.error("Failed to send message to Tauri backend:", error)
		}
	}

	/**
	 * 添加消息监听器
	 */
	addMessageListener(listener: (message: any) => void) {
		this.messageListeners.push(listener)
	}

	/**
	 * 移除消息监听器
	 */
	removeMessageListener(listener: (message: any) => void) {
		const index = this.messageListeners.indexOf(listener)
		if (index > -1) {
			this.messageListeners.splice(index, 1)
		}
	}

	/**
	 * 获取持久化状态
	 */
	async getState(): Promise<unknown | undefined> {
		try {
			return await invoke("get_webview_state")
		} catch (error) {
			console.error("Failed to get state:", error)
			return undefined
		}
	}

	/**
	 * 设置持久化状态
	 */
	async setState<T extends unknown | undefined>(newState: T): Promise<T> {
		try {
			await invoke("set_webview_state", { state: newState })
			return newState
		} catch (error) {
			console.error("Failed to set state:", error)
			return newState
		}
	}
}

// 创建全局实例
export const tauriAdapter = new TauriAdapter()
