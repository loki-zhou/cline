/// <reference types="@tauri-apps/api" />

import { WebviewProviderType } from "@shared/webview/types"

// 扩展 Window 接口以支持 Tauri 和 standalone 环境
declare global {
	interface Window {
		// Tauri API 相关
		__TAURI__: any

		// Standalone 环境相关
		__is_standalone__?: boolean
		standalonePostMessage?: (message: string) => void

		// Cline 应用相关
		clineClientId?: string
		WEBVIEW_PROVIDER_TYPE?: WebviewProviderType
	}
}
