import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import TauriTestApp from "./TauriTestApp"
import "./index.css"

// 在 Tauri 环境中，我们需要设置全局标识
if (typeof window !== "undefined") {
	// 检查是否在 Tauri 环境中
	window.__TAURI__ = (window as any).__TAURI__ || {}
	// 设置独立模式标志
	window.__is_standalone__ = true

	// 设置消息处理器，用于处理来自后端的消息
	window.addEventListener("message", (event) => {
		console.log("收到消息:", event.data)
	})
}

// 使用完整应用程序而不是测试应用程序
// 我们已经添加了超时机制，确保didHydrateState最终会被设置为true
const useTestApp = false

createRoot(document.getElementById("root")!).render(<StrictMode>{useTestApp ? <TauriTestApp /> : <App />}</StrictMode>)
