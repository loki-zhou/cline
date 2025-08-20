import { invoke } from "@tauri-apps/api/core"
import React, { useEffect, useState } from "react"

const TauriTestApp: React.FC = () => {
	const [appInfo, setAppInfo] = useState<any>(null)
	const [grpcStatus, setGrpcStatus] = useState<any>(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		loadAppInfo()
		loadGrpcStatus()
	}, [])

	const loadAppInfo = async () => {
		try {
			const info = await invoke("get_app_info")
			setAppInfo(info)
		} catch (error) {
			console.error("获取应用信息失败:", error)
		}
	}

	const loadGrpcStatus = async () => {
		try {
			const status = await invoke("get_grpc_service_status")
			setGrpcStatus(status)
		} catch (error) {
			console.error("获取 gRPC 状态失败:", error)
		}
	}

	const startGrpcService = async () => {
		setLoading(true)
		try {
			await invoke("start_grpc_service")
			await loadGrpcStatus()
		} catch (error) {
			console.error("启动 gRPC 服务失败:", error)
		} finally {
			setLoading(false)
		}
	}

	const testWebviewMessage = async () => {
		console.log("测试 WebView 消息按钮被点击")
		try {
			const message = {
				type: "executeCommand",
				command: 'echo "Hello from Tauri!"',
				id: Date.now().toString(),
			}
			console.log("发送消息:", message)
			const result = await invoke("handle_webview_message", { message })
			console.log("消息发送成功:", result)
			alert("WebView 消息发送成功！请查看控制台输出。")
		} catch (error) {
			console.error("发送 WebView 消息失败:", error)
			alert(`发送 WebView 消息失败: ${error}`)
		}
	}

	const testGrpcRequest = async () => {
		console.log("测试 gRPC 请求按钮被点击")
		try {
			const requestId = Date.now().toString()
			const message = {
				type: "grpc_request",
				grpc_request: {
					service: "cline.StateService",
					method: "getLatestState",
					message: {},
					request_id: requestId,
					is_streaming: false,
				},
			}
			console.log("发送 gRPC 请求:", message)
			const result = await invoke("handle_webview_message", { message })
			console.log("gRPC 请求发送成功:", result)
			alert("gRPC 请求发送成功！请查看控制台输出。")
		} catch (error) {
			console.error("发送 gRPC 请求失败:", error)
			alert(`发送 gRPC 请求失败: ${error}`)
		}
	}

	return (
		<div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
			<h1>Cline Desktop - Tauri 测试</h1>

			<div style={{ marginBottom: "20px" }}>
				<h2>应用信息</h2>
				{appInfo ? (
					<pre style={{ background: "#f5f5f5", padding: "10px", borderRadius: "4px" }}>
						{JSON.stringify(appInfo, null, 2)}
					</pre>
				) : (
					<p>加载中...</p>
				)}
			</div>

			<div style={{ marginBottom: "20px" }}>
				<h2>gRPC 服务状态</h2>
				{grpcStatus ? (
					<div>
						<pre style={{ background: "#f5f5f5", padding: "10px", borderRadius: "4px" }}>
							{JSON.stringify(grpcStatus, null, 2)}
						</pre>
						<button
							disabled={loading || grpcStatus.grpc_healthy}
							onClick={startGrpcService}
							style={{
								padding: "8px 16px",
								marginTop: "10px",
								backgroundColor: grpcStatus.grpc_healthy ? "#28a745" : loading ? "#6c757d" : "#007bff",
								color: "white",
								border: "none",
								borderRadius: "4px",
								cursor: loading || grpcStatus.grpc_healthy ? "not-allowed" : "pointer",
								opacity: loading || grpcStatus.grpc_healthy ? 0.6 : 1,
							}}>
							{loading ? "启动中..." : grpcStatus.grpc_healthy ? "gRPC 已运行" : "启动 gRPC 服务"}
						</button>
					</div>
				) : (
					<p>加载中...</p>
				)}
			</div>

			<div style={{ marginBottom: "20px" }}>
				<h2>WebView 消息测试</h2>
				<div style={{ display: "flex", gap: "10px" }}>
					<button
						onClick={testWebviewMessage}
						onMouseDown={(e) => {
							console.log("按钮被按下")
							e.currentTarget.style.backgroundColor = "#138496"
						}}
						onMouseUp={(e) => {
							console.log("按钮被释放")
							e.currentTarget.style.backgroundColor = "#17a2b8"
						}}
						style={{
							padding: "8px 16px",
							backgroundColor: "#17a2b8",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "14px",
							fontWeight: "bold",
							transition: "background-color 0.2s",
							userSelect: "none",
							minWidth: "150px",
						}}>
						测试 WebView 消息
					</button>

					<button
						onClick={testGrpcRequest}
						onMouseDown={(e) => {
							e.currentTarget.style.backgroundColor = "#0056b3"
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.backgroundColor = "#007bff"
						}}
						style={{
							padding: "8px 16px",
							backgroundColor: "#007bff",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "14px",
							fontWeight: "bold",
							transition: "background-color 0.2s",
							userSelect: "none",
							minWidth: "150px",
						}}>
						测试 gRPC 请求
					</button>
				</div>
				<p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
					点击按钮测试前后端通信，结果会显示在弹窗和控制台中
				</p>
			</div>

			<div>
				<button
					onClick={() => {
						loadAppInfo()
						loadGrpcStatus()
					}}
					style={{
						padding: "8px 16px",
						backgroundColor: "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}>
					刷新状态
				</button>
			</div>
		</div>
	)
}

export default TauriTestApp
