//! WebView 消息处理命令
//! 
//! 这个模块包含处理来自 WebView 的消息的 Tauri 命令

use tauri::{State, AppHandle, Manager, Emitter};
use log::{info, error};
use serde_json::Value;

use crate::AppState;
use crate::commands::{execute_terminal_command, read_file_content, write_file_content, list_workspace_files};

/// 处理来自 WebView 的消息
#[tauri::command]
pub async fn handle_webview_message(
    app: AppHandle,
    message: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("收到 WebView 消息: {:?}", message);
    
    // 检查消息类型并路由到相应的处理器
    if let Some(message_type) = message.get("type").and_then(|t| t.as_str()) {
        match message_type {
            "grpc_request" => {
                // 处理 gRPC 请求
                if let Some(grpc_request) = message.get("grpc_request") {
                    let request_id = grpc_request.get("request_id").and_then(|id| id.as_str()).unwrap_or("");
                    let service = grpc_request.get("service").and_then(|s| s.as_str()).unwrap_or("");
                    let method = grpc_request.get("method").and_then(|m| m.as_str()).unwrap_or("");
                    let is_streaming = grpc_request.get("is_streaming").and_then(|s| s.as_bool()).unwrap_or(false);
                    
                    info!("收到 gRPC 请求: service={}, method={}, request_id={}, is_streaming={}", 
                          service, method, request_id, is_streaming);
                    
                    // 根据服务和方法处理请求
                    match (service, method) {
                        // 状态服务
                        ("cline.StateService", "getLatestState") => {
                            // 返回一个基本的状态对象
                            let state = serde_json::json!({
                                "version": "1.0.0",
                                "mode": "standalone",
                                "settings": {
                                    "theme": "dark",
                                    "autoApprove": false
                                }
                            });
                            
                            let response = serde_json::json!({
                                "type": "grpc_response",
                                "grpc_response": {
                                    "request_id": request_id,
                                    "message": state,
                                    "is_streaming": false
                                }
                            });
                            let _ = app.emit("webview-message", response);
                        },
                        
                        // UI 服务
                        ("cline.UiService", "initializeWebview") => {
                            // 返回空响应，表示初始化成功
                            let response = serde_json::json!({
                                "type": "grpc_response",
                                "grpc_response": {
                                    "request_id": request_id,
                                    "message": {},
                                    "is_streaming": false
                                }
                            });
                            let _ = app.emit("webview-message", response);
                        },
                        
                        // 账户服务
                        ("cline.AccountService", "subscribeToAuthStatusUpdate") => {
                            // 如果是流式请求，发送一个初始的认证状态
                            if is_streaming {
                                let auth_state = serde_json::json!({
                                    "isAuthenticated": false,
                                    "user": null
                                });
                                
                                let response = serde_json::json!({
                                    "type": "grpc_response",
                                    "grpc_response": {
                                        "request_id": request_id,
                                        "message": auth_state,
                                        "is_streaming": true
                                    }
                                });
                                let _ = app.emit("webview-message", response);
                            }
                        },
                        
                        // 默认处理其他所有请求
                        _ => {
                            // 发送空响应，表示请求已收到但尚未实现
                            let response = serde_json::json!({
                                "type": "grpc_response",
                                "grpc_response": {
                                    "request_id": request_id,
                                    "message": {},
                                    "is_streaming": false
                                }
                            });
                            let _ = app.emit("webview-message", response);
                        }
                    }
                }
            },
            "grpc_request_cancel" => {
                // 处理 gRPC 请求取消
                if let Some(cancel_request) = message.get("grpc_request_cancel") {
                    let request_id = cancel_request.get("request_id").and_then(|id| id.as_str()).unwrap_or("");
                    info!("收到 gRPC 请求取消: request_id={}", request_id);
                    // 目前不需要做任何处理，因为我们还没有实现真正的 gRPC 流处理
                }
            },
            "executeCommand" => {
                if let (Some(command), cwd) = (
                    message.get("command").and_then(|c| c.as_str()),
                    message.get("cwd").and_then(|c| c.as_str())
                ) {
                    match execute_terminal_command(
                        command.to_string(), 
                        cwd.map(|s| s.to_string()), 
                        state.clone()
                    ).await {
                        Ok(result) => {
                            let response = serde_json::json!({
                                "type": "commandResult",
                                "id": message.get("id"),
                                "result": result
                            });
                            let _ = app.emit("webview-message", response);
                        }
                        Err(e) => {
                            let response = serde_json::json!({
                                "type": "commandError",
                                "id": message.get("id"),
                                "error": e
                            });
                            let _ = app.emit("webview-message", response);
                        }
                    }
                }
            }
            "readFile" => {
                if let Some(file_path) = message.get("path").and_then(|p| p.as_str()) {
                    match read_file_content(file_path.to_string(), state.clone()).await {
                        Ok(content) => {
                            let response = serde_json::json!({
                                "type": "fileContent",
                                "id": message.get("id"),
                                "content": content
                            });
                            let _ = app.emit("webview-message", response);
                        }
                        Err(e) => {
                            let response = serde_json::json!({
                                "type": "fileError",
                                "id": message.get("id"),
                                "error": e
                            });
                            let _ = app.emit("webview-message", response);
                        }
                    }
                }
            }
            "writeFile" => {
                if let (Some(file_path), Some(content)) = (
                    message.get("path").and_then(|p| p.as_str()),
                    message.get("content").and_then(|c| c.as_str())
                ) {
                    match write_file_content(
                        file_path.to_string(), 
                        content.to_string(), 
                        state.clone()
                    ).await {
                        Ok(result) => {
                            let response = serde_json::json!({
                                "type": "writeResult",
                                "id": message.get("id"),
                                "result": result
                            });
                            let _ = app.emit("webview-message", response);
                        }
                        Err(e) => {
                            let response = serde_json::json!({
                                "type": "writeError",
                                "id": message.get("id"),
                                "error": e
                            });
                            let _ = app.emit("webview-message", response);
                        }
                    }
                }
            }
            "listFiles" => {
                let path = message.get("path").and_then(|p| p.as_str()).map(|s| s.to_string());
                match list_workspace_files(path, state.clone()).await {
                    Ok(files) => {
                        let response = serde_json::json!({
                            "type": "fileList",
                            "id": message.get("id"),
                            "files": files
                        });
                        let _ = app.emit("webview-message", response);
                    }
                    Err(e) => {
                        let response = serde_json::json!({
                            "type": "listError",
                            "id": message.get("id"),
                            "error": e
                        });
                        let _ = app.emit("webview-message", response);
                    }
                }
            }
            _ => {
                error!("未知的消息类型: {}", message_type);
                let response = serde_json::json!({
                    "type": "error",
                    "id": message.get("id"),
                    "error": format!("未知的消息类型: {}", message_type)
                });
                let _ = app.emit("webview-message", response);
            }
        }
    }
    
    Ok(())
}

/// 获取 WebView 状态
#[tauri::command]
pub async fn get_webview_state(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    let cm = state.config_manager.lock().await;
    let config = cm.get_config();
    
    // 从配置中获取 WebView 状态
    Ok(config.webview_state.clone())
}

/// 设置 WebView 状态
#[tauri::command]
pub async fn set_webview_state(
    webview_state: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut cm = state.config_manager.lock().await;
    cm.update_config(|config| {
        config.webview_state = Some(webview_state);
    })?;
    
    Ok(())
}