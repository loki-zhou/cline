//! 配置管理模块
//! 
//! 负责管理应用配置和准备Node.js服务所需的配置文件

use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use log::info;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GrpcConfig {
    pub port: u16,
    pub host: String,
    pub timeout_secs: u64,
}

impl Default for GrpcConfig {
    fn default() -> Self {
        Self {
            port: 26040,
            host: "127.0.0.1".to_string(),
            timeout_secs: 30,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub grpc: GrpcConfig,
    pub log_level: String,
    pub workspace_dir: Option<String>,
    pub auto_start_grpc: bool,
    pub webview_state: Option<serde_json::Value>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            grpc: GrpcConfig::default(),
            log_level: "info".to_string(),
            workspace_dir: None,
            auto_start_grpc: true,
            webview_state: None,
        }
    }
}

pub struct ConfigManager {
    config_path: PathBuf,
    config: AppConfig,
}

impl ConfigManager {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        let config_dir = app_dir.join("config");
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
        
        let config_path = config_dir.join("app.json");
        let config = Self::load_or_create_config(&config_path)?;
        
        Ok(Self {
            config_path,
            config,
        })
    }
    
    fn load_or_create_config(config_path: &PathBuf) -> Result<AppConfig, String> {
        if config_path.exists() {
            // 加载现有配置
            let config_str = fs::read_to_string(config_path)
                .map_err(|e| format!("读取配置文件失败: {}", e))?;
            
            let config: AppConfig = serde_json::from_str(&config_str)
                .map_err(|e| format!("解析配置文件失败: {}", e))?;
            
            info!("已加载配置文件: {:?}", config_path);
            Ok(config)
        } else {
            // 创建默认配置
            let config = AppConfig::default();
            let config_str = serde_json::to_string_pretty(&config)
                .map_err(|e| format!("序列化配置失败: {}", e))?;
            
            fs::write(config_path, config_str)
                .map_err(|e| format!("写入配置文件失败: {}", e))?;
            
            info!("已创建默认配置文件: {:?}", config_path);
            Ok(config)
        }
    }
    
    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }
    
    pub fn update_config<F>(&mut self, updater: F) -> Result<(), String>
    where
        F: FnOnce(&mut AppConfig),
    {
        updater(&mut self.config);
        self.save_config()
    }
    
    fn save_config(&self) -> Result<(), String> {
        let config_str = serde_json::to_string_pretty(&self.config)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        
        fs::write(&self.config_path, config_str)
            .map_err(|e| format!("保存配置文件失败: {}", e))?;
        
        info!("配置已保存");
        Ok(())
    }
    
    /// 准备Node.js服务所需的环境变量
    pub fn prepare_node_env(&self) -> Vec<(String, String)> {
        vec![
            ("GRPC_PORT".to_string(), self.config.grpc.port.to_string()),
            ("GRPC_HOST".to_string(), self.config.grpc.host.clone()),
            ("LOG_LEVEL".to_string(), self.config.log_level.clone()),
            ("NODE_ENV".to_string(), "production".to_string()),
        ]
    }
    
    /// 获取Node.js脚本路径
    pub fn get_node_script_path(&self, _app_dir: &PathBuf) -> PathBuf {
        // 在开发模式下，使用项目根目录中的编译后的cline-core.js
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        // 如果当前目录是 src-tauri，则回到上级目录
        let project_root = if current_dir.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
            current_dir.parent().unwrap_or(&current_dir).to_path_buf()
        } else {
            current_dir
        };
        project_root.join("dist-standalone").join("cline-core.js")
    }
}