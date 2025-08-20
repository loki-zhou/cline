//! Node.js桥接模块
//! 
//! 这个模块负责启动和管理Node.js子进程，运行现有的gRPC服务

use std::process::{Child, Command, Stdio};
use std::path::PathBuf;
use std::io::{BufRead, BufReader};
use std::thread;
use log::{info, error, warn, debug};
use tauri::{WebviewWindow, Emitter};

pub struct NodeBridge {
    process: Option<Child>,
    script_path: PathBuf,
    port: u16,
}

impl NodeBridge {
    pub fn new(script_path: PathBuf, port: u16) -> Self {
        Self {
            process: None,
            script_path,
            port,
        }
    }
    
    /// 启动Node.js进程
    pub fn start(&mut self, window: Option<WebviewWindow>) -> Result<(), String> {
        if self.process.is_some() {
            return Err("Node.js进程已经在运行".to_string());
        }
        
        info!("启动Node.js桥接服务: {:?}", self.script_path);
        
        // 检查Node.js是否可用
        if !self.check_node_available() {
            return Err("Node.js不可用，请确保已安装Node.js".to_string());
        }
        
        // 检查脚本文件是否存在
        if !self.script_path.exists() {
            return Err(format!("脚本文件不存在: {:?}", self.script_path));
        }
        
        // 启动Node.js进程
        let mut cmd = Command::new("node");
        cmd.arg(&self.script_path)
           .env("GRPC_PORT", self.port.to_string())
           .env("NODE_ENV", "production")
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());
        
        let mut child = cmd.spawn()
            .map_err(|e| format!("启动Node.js进程失败: {}", e))?;
        
        // 获取输出流用于日志记录
        if let Some(stdout) = child.stdout.take() {
            let window_clone = window.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        info!("[Node.js] {}", line);
                        if let Some(ref window) = window_clone {
                            let _ = window.emit("node-log", &line);
                        }
                    }
                }
            });
        }
        
        if let Some(stderr) = child.stderr.take() {
            let window_clone = window;
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        warn!("[Node.js Error] {}", line);
                        if let Some(ref window) = window_clone {
                            let _ = window.emit("node-error", &line);
                        }
                    }
                }
            });
        }
        
        self.process = Some(child);
        info!("Node.js桥接服务已启动，端口: {}", self.port);
        
        Ok(())
    }
    
    /// 停止Node.js进程
    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut process) = self.process.take() {
            info!("停止Node.js桥接服务");
            
            // 尝试优雅关闭
            if let Err(e) = process.kill() {
                warn!("终止Node.js进程失败: {}", e);
            }
            
            // 等待进程结束
            match process.wait() {
                Ok(status) => {
                    info!("Node.js进程已结束，状态: {}", status);
                }
                Err(e) => {
                    warn!("等待Node.js进程结束时出错: {}", e);
                }
            }
        }
        
        Ok(())
    }
    
    /// 检查进程是否还在运行
    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut process) = self.process {
            match process.try_wait() {
                Ok(Some(_)) => {
                    // 进程已结束
                    self.process = None;
                    false
                }
                Ok(None) => {
                    // 进程仍在运行
                    true
                }
                Err(e) => {
                    error!("检查进程状态时出错: {}", e);
                    false
                }
            }
        } else {
            false
        }
    }
    
    /// 检查Node.js是否可用
    fn check_node_available(&self) -> bool {
        match Command::new("node").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout);
                    debug!("Node.js版本: {}", version.trim());
                    true
                } else {
                    false
                }
            }
            Err(_) => false,
        }
    }
    
    /// 获取gRPC服务端口
    pub fn get_port(&self) -> u16 {
        self.port
    }
}

impl Drop for NodeBridge {
    fn drop(&mut self) {
        if let Err(e) = self.stop() {
            error!("关闭Node.js桥接服务时出错: {}", e);
        }
    }
}