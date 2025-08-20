//! 健康检查模块
//! 
//! 用于检查gRPC服务的健康状态

use std::time::Duration;
use tokio::time;
use log::{info, warn, debug};

/// 检查gRPC服务健康状态
pub async fn check_grpc_health(port: u16) -> bool {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:{}/health", port);
    
    match client
        .get(&url)
        .timeout(Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => {
            let is_healthy = response.status().is_success();
            debug!("gRPC健康检查结果: {}", is_healthy);
            is_healthy
        }
        Err(e) => {
            debug!("gRPC健康检查失败: {}", e);
            false
        }
    }
}

/// 等待gRPC服务就绪
pub async fn wait_for_grpc_ready(port: u16, timeout_secs: u64) -> bool {
    info!("等待gRPC服务就绪，端口: {}, 超时: {}秒", port, timeout_secs);
    
    let mut interval = time::interval(Duration::from_millis(500));
    let start = std::time::Instant::now();
    
    while start.elapsed().as_secs() < timeout_secs {
        interval.tick().await;
        
        if check_grpc_health(port).await {
            info!("gRPC服务已就绪");
            return true;
        }
        
        debug!("gRPC服务尚未就绪，继续等待...");
    }
    
    warn!("等待gRPC服务就绪超时");
    false
}

/// 持续监控gRPC服务健康状态
pub async fn monitor_grpc_health(port: u16, callback: impl Fn(bool) + Send + 'static) {
    let mut interval = time::interval(Duration::from_secs(5));
    let mut last_status = false;
    
    loop {
        interval.tick().await;
        
        let current_status = check_grpc_health(port).await;
        
        if current_status != last_status {
            info!("gRPC服务状态变化: {} -> {}", last_status, current_status);
            callback(current_status);
            last_status = current_status;
        }
    }
}