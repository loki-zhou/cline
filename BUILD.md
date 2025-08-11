# Cline 构建指南

本文档记录了 Cline 项目的构建过程，特别是在 Windows 环境下遇到的问题和解决方案。

## 环境要求

- Node.js (推荐使用 .nvmrc 中指定的版本)
- npm
- Git
- Windows 环境下需要 Git Bash 或类似的 Unix-like shell

## 构建过程

### 1. 安装依赖

```bash
npm install
```

### 2. Protocol Buffers 代码生成

项目使用 Protocol Buffers 进行代码生成。我们遇到了 `grpc-tools` 中的 `protoc` 在 Windows 下出现段错误的问题。

#### 问题描述

原始的构建脚本 `proto/build-proto.js` 使用 `grpc-tools` 包中的 `protoc` 二进制文件，但在 Windows 环境下会出现段错误：

```
Segmentation fault (core dumped)
```

#### 解决方案

我们创建了一个替代的构建脚本 `proto/build-proto-buf.js`，使用 `@bufbuild/buf` 工具替代有问题的 `protoc`：

**主要修改：**

1. **创建了 `proto/build-proto-buf.js`**：
   ```javascript
   // 使用 buf generate 替代 protoc
   await execAsync(`npm exec buf generate --template ${templatePath}`)
   ```

2. **修复了生成的索引文件**：
   - 自动修复 `src/shared/proto/index.cline.ts` 中的导出问题
   - 确保所有服务类型正确导出

3. **保持兼容性**：
   - 保留原始的 `build-proto.js` 文件
   - 新脚本可以作为备用方案

#### 使用方法

如果遇到 protoc 段错误问题，可以使用备用构建脚本：

```bash
# 使用备用的 buf 工具进行 proto 代码生成
node proto/build-proto-buf.js
```

### 3. 完整构建流程

```bash
# 1. 生成 Protocol Buffers 代码
npm run protos

# 2. 类型检查
npm run check-types

# 3. 构建 webview
npm run build:webview

# 4. 代码检查
npm run lint

# 5. 构建主程序
npm run package
```

### 4. 打包 VSCode 扩展

```bash
# 安装 vsce (如果还没有安装)
npm install -g @vscode/vsce

# 打包成 VSIX 文件
vsce package
```

## 常见问题和解决方案

### 1. Protoc 段错误

**问题**：`grpc-tools` 中的 `protoc` 在 Windows 下崩溃

**解决方案**：使用 `@bufbuild/buf` 工具替代
- 项目已经包含了 `@bufbuild/buf` 依赖
- 使用 `proto/build-proto-buf.js` 脚本
- 或者修改 `proto/build-proto.js` 中的 `useGrpcTools` 为 `false`

### 2. Webview 构建超时

**问题**：Vite 构建 webview 时可能需要较长时间

**解决方案**：
- 耐心等待，通常需要处理 6000+ 个模块
- 确保有足够的内存和磁盘空间
- 可以增加 Node.js 内存限制：`NODE_OPTIONS="--max-old-space-size=8192"`

### 3. 环境变量问题

**问题**：Gemini CLI 无法读取 `GOOGLE_CLOUD_PROJECT` 环境变量

**解决方案**：
- 确保从设置了环境变量的终端启动 VSCode
- 或者在项目根目录创建 `.env` 文件
- 我们已经修复了代码，现在会正确读取环境变量

## 开发环境设置

### 推荐的开发流程

1. **克隆项目**：
   ```bash
   git clone <repository-url>
   cd cline
   ```

2. **切换到开发分支**（如需要）：
   ```bash
   git checkout v3.18.0-branch
   ```

3. **安装依赖**：
   ```bash
   npm install
   ```

4. **首次构建**：
   ```bash
   npm run package
   ```

5. **开发时的增量构建**：
   ```bash
   # 只重新生成 proto 文件
   npm run protos
   
   # 只构建 webview
   npm run build:webview
   
   # 只进行类型检查
   npm run check-types
   ```

## 构建输出

成功构建后，你会得到：

- `dist/extension.js` - 编译后的 VSCode 扩展主文件
- `dist-standalone/` - 独立版本的构建输出
- `claude-dev-x.x.x.vsix` - VSCode 扩展安装包

## 故障排除

### 构建失败时的检查清单

1. **检查 Node.js 版本**：
   ```bash
   node --version
   npm --version
   ```

2. **清理并重新安装依赖**：
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **清理构建缓存**：
   ```bash
   rm -rf dist dist-standalone
   ```

4. **检查磁盘空间**：确保有足够的磁盘空间进行构建

5. **检查权限**：确保对项目目录有写权限

### 日志和调试

- 构建过程中的详细日志会显示在终端
- 如果遇到问题，可以查看具体的错误信息
- 对于 Gemini CLI 相关问题，可以在 VSCode 开发者控制台中查看 `[GeminiCLI] DEBUG` 消息

## 贡献指南

如果你需要修改构建过程：

1. 测试你的修改在不同环境下都能工作
2. 更新相关的文档
3. 确保向后兼容性
4. 提交 PR 时包含详细的说明

## 相关文件

- `package.json` - 构建脚本定义
- `proto/build-proto.js` - 原始 proto 构建脚本
- `proto/build-proto-buf.js` - 备用 proto 构建脚本（使用 buf）
- `esbuild.js` - 主程序构建配置
- `webview-ui/vite.config.ts` - Webview 构建配置
- `buf.yaml`, `buf.gen.*.yaml` - Buf 工具配置文件