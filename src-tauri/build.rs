fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Build Tauri
    tauri_build::build();
    
    // Configure tonic-build for proto compilation
    let proto_files = [
        "../proto/cline/common.proto",
        "../proto/cline/commands.proto", 
        "../proto/cline/task.proto",
        "../proto/cline/file.proto",
        "../proto/cline/ui.proto",
        "../proto/cline/state.proto",
        "../proto/cline/models.proto",
        "../proto/cline/browser.proto",
        "../proto/cline/checkpoints.proto",
        "../proto/cline/mcp.proto",
        "../proto/cline/slash.proto",
        "../proto/cline/web.proto",
        "../proto/cline/account.proto",
        "../proto/host/diff.proto",
        "../proto/host/env.proto", 
        "../proto/host/testing.proto",
        "../proto/host/watch.proto",
        "../proto/host/window.proto",
        "../proto/host/workspace.proto",
    ];
    
    tonic_build::configure()
        .build_server(true)
        .build_client(false)
        .out_dir("src/generated")
        .compile_protos(&proto_files, &["../proto"])?;
    
    println!("cargo:rerun-if-changed=../proto");
    
    Ok(())
}
