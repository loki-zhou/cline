import { WebviewProviderType } from "@shared/webview/types"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import "@vscode/codicons/dist/codicon.css"

// Add debug logging
if (window.console && window.console.log) {
	window.console.log("🚀 Cline Desktop - main.tsx loading", {
		userAgent: navigator.userAgent,
		location: window.location.href,
		tauri: !!window.__TAURI__,
		clineClientId: window.clineClientId,
		webviewProviderType: window.WEBVIEW_PROVIDER_TYPE,
	})
}

// 设置桌面应用的 standalone 标志
window.__is_standalone__ = true
if (window.console && window.console.log) {
	window.console.log("✅ Set __is_standalone__ to:", window.__is_standalone__)
}

// 设置一个就绪标志和消息队列
let isClineCoreReady = false
const messageQueue: string[] = []

// 监听来自后端的就绪事件
listen("cline-core-ready", () => {
	if (window.console && window.console.log) {
		window.console.log("✅ Received cline-core-ready event! Processing queued messages...")
	}
	isClineCoreReady = true
	// 处理队列中的所有消息
	while (messageQueue.length > 0) {
		const message = messageQueue.shift()
		if (message) {
			if (window.console && window.console.log) {
				window.console.log("📤 Processing queued message:", message.slice(0, 200))
			}
			window.standalonePostMessage?.(message)
		}
	}
})

// 启动即查询后端就绪状态，避免事件丢失导致等待
if (window.__TAURI__) {
	invoke("get_services_ready_status")
		.then((status: any) => {
			try {
				if (status?.cline_core && !isClineCoreReady) {
					if (window.console && window.console.log) {
						window.console.log("⚡ cline-core already ready at startup, flushing queued messages")
					}
					isClineCoreReady = true
					while (messageQueue.length > 0) {
						const message = messageQueue.shift()
						if (message) {
							if (window.console && window.console.log) {
								window.console.log("📤 Processing queued message (startup ready):", message.slice(0, 200))
							}
							window.standalonePostMessage?.(message)
						}
					}
				}
			} catch {}
		})
		.catch(() => {})
}

// 监听后端 gRPC 响应事件并转发为 window MessageEvent，保持兼容
listen("grpc-response", (e) => {
	try {
		const payload = e.payload as any
		// 仅在非流式(unary)时打印，避免“看起来两次”的日志噪音
		if (window.console && window.console.log && payload?.grpc_response?.is_streaming === false) {
			window.console.log("📩 [grpc-response] unary payload:", payload)
		}
		// 始终转发为 window.message，保持 ProtoBus 兼容
		window.dispatchEvent(new MessageEvent("message", { data: payload }))
	} catch (err) {
		if (window.console && window.console.error) {
			window.console.error("❌ Error handling grpc-response:", err)
		}
	}
})

// 批量日志：将后端 100ms 批量的日志打印到控制台
listen("cline-stdout-batch", (e) => {
	const lines = (e.payload as string[]) || []
	if (lines.length && window.console && window.console.log) {
		for (const line of lines) {
			window.console.log("[cline-core]", line)
		}
	}
})

listen("cline-stderr-batch", (e) => {
	const lines = (e.payload as string[]) || []
	if (lines.length && window.console && window.console.error) {
		for (const line of lines) {
			window.console.error("[cline-core]", line)
		}
	}
})

// 添加超时机制 - 如果 10 秒后 cline-core 仍未就绪，强制设置为就绪状态
setTimeout(() => {
	if (!isClineCoreReady) {
		if (window.console && window.console.warn) {
			window.console.warn("⚠️ Timeout waiting for cline-core-ready event, forcing ready state")
			window.console.warn(`📊 messageQueue length: ${messageQueue.length}`)
		}
		isClineCoreReady = true
		// 处理队列中的所有消息
		while (messageQueue.length > 0) {
			const message = messageQueue.shift()
			if (message) {
				if (window.console && window.console.log) {
					window.console.log("📤 Processing queued message (timeout fallback):", message.slice(0, 200))
				}
				window.standalonePostMessage?.(message)
			}
		}
	}
}, 10000) // 10 秒超时

// 设置 standalone postMessage 函数
window.standalonePostMessage = async (message: string) => {
	if (!isClineCoreReady) {
		if (window.console && window.console.log) {
			window.console.log("🕒 cline-core not ready, queuing message:", message.slice(0, 200))
		}
		messageQueue.push(message)
		return
	}

	if (window.console && window.console.log) {
		window.console.log("📤 Sending gRPC message:", message.slice(0, 200))
	}
	try {
		const parsedMessage = JSON.parse(message)
		if (parsedMessage.type === "grpc_request") {
			if (window.console && window.console.log) {
				window.console.log(
					"🔄 Processing gRPC request:",
					parsedMessage.grpc_request?.service,
					parsedMessage.grpc_request?.method,
				)
			}

			// 在桌面应用中，通过 Tauri 命令发送消息到后端
			if (window.__TAURI__) {
				try {
					const response = await invoke("handle_webview_message", { message: parsedMessage })
					if (window.console && window.console.log) {
						window.console.log("✅ Received response from Tauri:", response)
					}
				} catch (error) {
					if (window.console && window.console.error) {
						window.console.error("❌ Error invoking Tauri command:", error)
					}
				}
			} else {
				if (window.console && window.console.warn) {
					window.console.warn("⚠️  Tauri API not available, message not sent")
				}
			}
		}
	} catch (error) {
		if (window.console && window.console.error) {
			window.console.error("❌ Error parsing standalone message:", error)
		}
	}
}
if (window.console && window.console.log) {
	window.console.log("✅ Set standalonePostMessage function")
}

// Initialize client ID for desktop application environment
if (!window.clineClientId) {
	// Generate a simple client ID for desktop app
	// In VS Code extension, this is injected by WebviewProvider
	// For desktop app, we use a static ID since there's only one client
	window.clineClientId = "desktop-app-client"
	if (window.console && window.console.log) {
		window.console.log("✅ Set clineClientId to:", window.clineClientId)
	}
}

// Also set the webview provider type if not already set
if (!window.WEBVIEW_PROVIDER_TYPE) {
	window.WEBVIEW_PROVIDER_TYPE = WebviewProviderType.SIDEBAR
	if (window.console && window.console.log) {
		window.console.log("✅ Set WEBVIEW_PROVIDER_TYPE to:", window.WEBVIEW_PROVIDER_TYPE)
	}
}

// Add error handling
window.addEventListener("error", (event) => {
	if (window.console && window.console.error) {
		window.console.error("🔥 Global error:", event.error)
		window.console.error("🔥 Error details:", {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
		})
	}
})

window.addEventListener("unhandledrejection", (event) => {
	if (window.console && window.console.error) {
		window.console.error("🔥 Unhandled promise rejection:", event.reason)
	}
})

try {
	const rootElement = document.getElementById("root")
	if (!rootElement) {
		throw new Error("Root element not found!")
	}

	if (window.console && window.console.log) {
		window.console.log("🎯 Creating React root...")
	}
	const root = createRoot(rootElement)

	if (window.console && window.console.log) {
		window.console.log("🎨 Rendering App component...")
	}
	root.render(
		<StrictMode>
			<App />
		</StrictMode>,
	)
	if (window.console && window.console.log) {
		window.console.log("✅ App rendered successfully")
	}
} catch (error) {
	if (window.console && window.console.error) {
		window.console.error("🔥 Error during app initialization:", error)
	}
	// Show a fallback UI
	document.body.innerHTML = `
		<div style="padding: 20px; font-family: Arial, sans-serif;">
			<h1 style="color: red;">❌ Cline Desktop 加载失败</h1>
			<p><strong>错误:</strong> ${(error as Error).message}</p>
			<p>请打开开发者工具查看详细错误信息。</p>
		</div>
	`
}
