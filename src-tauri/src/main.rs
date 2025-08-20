// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod node_bridge;
mod health_check;
mod config_manager;
mod commands;
mod host_bridge;
mod webview_commands;

use std::sync::Arc;
use std::path::PathBuf;
use tauri::{Manager, Emitter};
use tokio::sync::Mutex;
use log::{info, error};

use node_bridge::NodeBridge;
use config_manager::ConfigManager;
use host_bridge::{HostBridge, HostBridgeProvider};

struct AppState {
    node_bridge: Arc<Mutex<NodeBridge>>,
    config_manager: Arc<Mutex<ConfigManager>>,
    host_bridge: Arc<Mutex<HostBridge>>,
    host_bridge_provider: HostBridgeProvider,
}

fn main() {
    // 初始化日志
    env_logger::init();
    
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let app_dir = app.handle().path().app_data_dir()
                .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
        
            // 初始化配置管理器
            let config_manager = match ConfigManager::new(app_dir.clone()) {
                Ok(cm) => Arc::new(Mutex::new(cm)),
                Err(e) => {
                    error!("初始化配置管理器失败: {}", e);
                    return Err(e.into());
                }
            };
            
            // 获取配置 - 使用spawn_blocking避免阻塞
            let config = {
                let cm = config_manager.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        let cm = cm.lock().await;
                        cm.get_config().clone()
                    })
                }).join().unwrap()
            };
            
            // 初始化Node.js桥接
            let script_path = {
                let cm = config_manager.clone();
                let app_dir_clone = app_dir.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        let cm = cm.lock().await;
                        cm.get_node_script_path(&app_dir_clone)
                    })
                }).join().unwrap()
            };
            
            let node_bridge = Arc::new(Mutex::new(
                NodeBridge::new(script_path, config.grpc.port)
            ));
            
            // 初始化工作目录
            let workspace_dir = match &config.workspace_dir {
                Some(dir) => PathBuf::from(dir),
                None => {
                    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                    home_dir.join("cline-workspace")
                }
            };
            
            // 初始化Host Bridge
            let host_bridge = Arc::new(Mutex::new(
                HostBridge::new(node_bridge.clone(), workspace_dir)
            ));
            let host_bridge_provider = HostBridgeProvider::new(host_bridge.clone());
            
            // 设置应用状态
            app.manage(AppState {
                node_bridge: node_bridge.clone(),
                config_manager: config_manager.clone(),
                host_bridge: host_bridge.clone(),
                host_bridge_provider,
            });
            
            // 获取主窗口
            let window = app.get_webview_window("main");
            
            // 设置窗口为独立模式
            if let Some(window_ref) = window.clone() {
                // 在窗口初始化时设置 __is_standalone__ 变量
                window_ref.eval("window.__is_standalone__ = true;").unwrap_or_else(|e| {
                    error!("设置独立模式变量失败: {}", e);
                });
            }
            
            // 设置Host Bridge的窗口
            if let Some(window_ref) = window.clone() {
                tauri::async_runtime::spawn(async move {
                    let mut hb = host_bridge.lock().await;
                    hb.set_window(window_ref);
                    if let Err(e) = hb.initialize().await {
                        error!("初始化Host Bridge失败: {}", e);
                    }
                });
            }
            
            // 如果配置了自动启动，则启动Node.js桥接服务
            if config.auto_start_grpc {
                let node_bridge_clone = node_bridge.clone();
                let window_clone = window.clone();
                let grpc_port = config.grpc.port;
                let timeout = config.grpc.timeout_secs;
                
                tauri::async_runtime::spawn(async move {
                    // 启动Node.js桥接服务
                    {
                        let mut bridge = node_bridge_clone.lock().await;
                        if let Err(e) = bridge.start(window_clone.clone()) {
                            error!("启动Node.js桥接服务失败: {}", e);
                            if let Some(window) = window_clone.clone() {
                                let _ = window.emit("grpc-error", &e);
                            }
                            return;
                        }
                    }
                    
                    // 等待gRPC服务就绪（非阻塞）
                    if health_check::wait_for_grpc_ready(grpc_port, timeout).await {
                        // 通知前端gRPC服务已就绪
                        if let Some(window) = window_clone.clone() {
                            let _ = window.emit("grpc-ready", grpc_port);
                        }
                        info!("gRPC服务已就绪");
                    } else {
                        error!("gRPC服务未能在超时时间内就绪，但继续启动应用");
                        if let Some(window) = window_clone {
                            let _ = window.emit("grpc-warning", "gRPC服务启动超时，但应用继续运行");
                        }
                    }
                    
                    info!("Cline桌面应用已完全启动");
                });
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::start_grpc_service,
            commands::stop_grpc_service,
            commands::check_grpc_status,
            commands::get_config,
            commands::update_config,
            commands::execute_terminal_command,
            commands::list_workspace_files,
            commands::read_file_content,
            commands::write_file_content,
            commands::get_host_bridge_status,
            commands::set_workspace_directory,
            commands::file_exists,
            commands::directory_exists,
            commands::show_diff,
            commands::get_grpc_service_status,
            webview_commands::handle_webview_message,
            webview_commands::get_webview_state,
            webview_commands::set_webview_state,
        ])
        .run(tauri::generate_context!())
        .expect("运行Tauri应用失败");
}