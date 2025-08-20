#!/usr/bin/env node

// 简化的 Cline Core 服务入口点
// 这是一个临时的占位符，用于测试 Tauri 集成

const http = require("http")

console.log("Cline Core 服务启动中...")

// 创建一个简单的 HTTP 服务器作为占位符
const server = http.createServer((req, res) => {
	res.writeHead(200, { "Content-Type": "application/json" })
	res.end(
		JSON.stringify({
			status: "ok",
			message: "Cline Core 服务运行中",
			timestamp: new Date().toISOString(),
		}),
	)
})

const port = process.env.GRPC_PORT || 26040

server.listen(port, "127.0.0.1", () => {
	console.log(`Cline Core 服务已启动，监听端口 ${port}`)
})

// 优雅关闭
process.on("SIGINT", () => {
	console.log("正在关闭 Cline Core 服务...")
	server.close(() => {
		console.log("Cline Core 服务已关闭")
		process.exit(0)
	})
})

process.on("SIGTERM", () => {
	console.log("正在关闭 Cline Core 服务...")
	server.close(() => {
		console.log("Cline Core 服务已关闭")
		process.exit(0)
	})
})
