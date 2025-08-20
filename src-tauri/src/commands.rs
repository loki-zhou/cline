//! Tauri命令处理模块
//! 
//! 这个模块包含所有从前端调用的Tauri命令

use std::path::PathBuf;
use tauri::{State, Emitter, WebviewWindow, AppHandle, Manager};
use log::{info, error, warn};
use serde_json::Value;
use serde::{Serialize, Deserialize};

use crate::{AppState, health_check, config_manager::AppConfig};
use crate::host_bridge::HostBridgeStatus;

/// 获取应用信息
#[tauri::command]
pub async fn get_app_info() -> Result<Value, String> {
    info!("获取应用信息");
    
    let info = serde_json::json!({
        "name": "Cline Desktop",
        "version": env!("CARGO_PKG_VERSION"),
        "grpc_port": 26040,
        "status": "running"
    });
    
    Ok(info)
}

/// 启动gRPC服务
#[tauri::command]
pub async fn start_grpc_service(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("手动启动gRPC服务");
    
    let config = {
        let cm = state.config_manager.lock().await;
        cm.get_config().clone()
    };
    
    // 启动Node.js桥接服务
    {
        let mut bridge = state.node_bridge.lock().await;
        if bridge.is_running() {
            return Err("gRPC服务已经在运行".to_string());
        }
        
        bridge.start(Some(window.clone()))?;
    }
    
    // 等待gRPC服务就绪
    if !health_check::wait_for_grpc_ready(config.grpc.port, config.grpc.timeout_secs).await {
        error!("gRPC服务未能在超时时间内就绪");
        return Err("gRPC服务启动超时".to_string());
    }
    
    // 通知前端gRPC服务已就绪
    let _ = window.emit("grpc-ready", config.grpc.port);
    
    Ok("gRPC服务已启动".to_string())
}

/// 停止gRPC服务
#[tauri::command]
pub async fn stop_grpc_service(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("停止gRPC服务");
    
    {
        let mut bridge = state.node_bridge.lock().await;
        bridge.stop()?;
    }
    
    // 通知前端gRPC服务已停止
    let _ = window.emit("grpc-stopped", ());
    
    Ok("gRPC服务已停止".to_string())
}

/// 检查gRPC服务状态
#[tauri::command]
pub async fn check_grpc_status(state: State<'_, AppState>) -> Result<Value, String> {
    let config = {
        let cm = state.config_manager.lock().await;
        cm.get_config().clone()
    };
    
    let is_process_running = {
        let mut bridge = state.node_bridge.lock().await;
        bridge.is_running()
    };
    
    let is_grpc_healthy = if is_process_running {
        health_check::check_grpc_health(config.grpc.port).await
    } else {
        false
    };
    
    let status = serde_json::json!({
        "process_running": is_process_running,
        "grpc_healthy": is_grpc_healthy,
        "port": config.grpc.port,
        "host": config.grpc.host
    });
    
    Ok(status)
}

/// 获取配置
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let cm = state.config_manager.lock().await;
    Ok(cm.get_config().clone())
}

/// 更新配置
#[tauri::command]
pub async fn update_config(
    new_config: AppConfig,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("更新应用配置");
    
    {
        let mut cm = state.config_manager.lock().await;
        cm.update_config(|config| {
            *config = new_config;
        })?;
    }
    
    Ok("配置已更新".to_string())
}

/// 执行终端命令（通过Host Bridge）
#[tauri::command]
pub async fn execute_terminal_command(
    command: String,
    cwd: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("执行终端命令: {}", command);
    
    // 检查gRPC服务是否运行
    let config = {
        let cm = state.config_manager.lock().await;
        cm.get_config().clone()
    };
    
    if !health_check::check_grpc_health(config.grpc.port).await {
        return Err("gRPC服务未运行或不健康".to_string());
    }
    
    // 使用Host Bridge执行命令
    state.host_bridge_provider.execute_command(&command, cwd.as_deref()).await
}

/// 获取工作目录列表
#[tauri::command]
pub async fn list_workspace_files(
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let target_path = path.unwrap_or_else(|| ".".to_string());
    state.host_bridge_provider.list_directory(&target_path).await
}

/// 读取文件内容
#[tauri::command]
pub async fn read_file_content(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.host_bridge_provider.read_file(&file_path).await
}

/// 写入文件内容
#[tauri::command]
pub async fn write_file_content(
    file_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.host_bridge_provider.write_file(&file_path, &content).await?;
    Ok("文件写入成功".to_string())
}

/// 获取Host Bridge状态
#[tauri::command]
pub async fn get_host_bridge_status(
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let host_bridge = state.host_bridge.lock().await;
    let status = host_bridge.get_status();
    
    let status_json = match status {
        HostBridgeStatus::Initializing => serde_json::json!({
            "status": "initializing",
            "message": "Host Bridge正在初始化"
        }),
        HostBridgeStatus::Ready => serde_json::json!({
            "status": "ready",
            "message": "Host Bridge已就绪"
        }),
        HostBridgeStatus::Error(msg) => serde_json::json!({
            "status": "error",
            "message": msg
        }),
    };
    
    Ok(status_json)
}

/// 设置工作目录
#[tauri::command]
pub async fn set_workspace_directory(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut host_bridge = state.host_bridge.lock().await;
    host_bridge.set_workspace_dir(PathBuf::from(path.clone()))?;
    
    // 更新配置
    {
        let mut cm = state.config_manager.lock().await;
        cm.update_config(|config| {
            config.workspace_dir = Some(path.clone());
        })?;
    }
    
    Ok(format!("工作目录已设置为: {}", path))
}

/// 检查文件是否存在
#[tauri::command]
pub async fn file_exists(
    path: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.host_bridge_provider.file_exists(&path).await
}

/// 检查目录是否存在
#[tauri::command]
pub async fn directory_exists(
    path: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.host_bridge_provider.directory_exists(&path).await
}

/// 显示文件差异
#[tauri::command]
pub async fn show_diff(
    original: String,
    modified: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.host_bridge_provider.show_diff(&original, &modified, &title).await
}

/// 获取gRPC服务状态
#[tauri::command]
pub async fn get_grpc_service_status(
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let config = {
        let cm = state.config_manager.lock().await;
        cm.get_config().clone()
    };
    
    let is_process_running = {
        let mut bridge = state.node_bridge.lock().await;
        bridge.is_running()
    };
    
    let is_grpc_healthy = if is_process_running {
        health_check::check_grpc_health(config.grpc.port).await
    } else {
        false
    };
    
    let status_json = serde_json::json!({
        "status": if is_grpc_healthy { "connected" } else { "disconnected" },
        "message": if is_grpc_healthy { 
            "gRPC服务已连接" 
        } else if is_process_running { 
            "gRPC进程运行中但服务未就绪" 
        } else { 
            "gRPC服务未运行" 
        },
        "process_running": is_process_running,
        "grpc_healthy": is_grpc_healthy,
        "port": config.grpc.port
    });
    
    Ok(status_json)
}

