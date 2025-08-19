import type { ForgeConfig } from "@electron-forge/shared-types"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { MakerZIP } from "@electron-forge/maker-zip"
import { MakerDeb } from "@electron-forge/maker-deb"
import { MakerRpm } from "@electron-forge/maker-rpm"
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives"
import { WebpackPlugin } from "@electron-forge/plugin-webpack"
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { FuseV1Options, FuseVersion } from "@electron/fuses"
import path from "path"
import CopyWebpackPlugin from "copy-webpack-plugin"
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin"

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
	},
	rebuildConfig: {},
	makers: [new MakerSquirrel({}), new MakerZIP({}, ["darwin"]), new MakerRpm({}), new MakerDeb({})],
	plugins: [
		new AutoUnpackNativesPlugin({}),
		new WebpackPlugin({
			mainConfig: {
				entry: "./src/index.ts",
				module: {
					rules: [
						{
							test: /\.tsx?$/,
							exclude: /(node_modules|\.webpack)/,
							use: {
								loader: "ts-loader",
								options: {
									transpileOnly: true, // 只转译，不检查类型
									configFile: path.resolve(__dirname, "tsconfig.json"),
								},
							},
						},
					],
				},
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "..", "src"),
						"@api": path.resolve(__dirname, "..", "src", "api"),
						"@core": path.resolve(__dirname, "..", "src", "core"),
						"@generated": path.resolve(__dirname, "..", "src", "generated"),
						"@hosts": path.resolve(__dirname, "..", "src", "hosts"),
						"@integrations": path.resolve(__dirname, "..", "src", "integrations"),
						"@packages": path.resolve(__dirname, "..", "src", "packages"),
						"@services": path.resolve(__dirname, "..", "src", "services"),
						"@shared": path.resolve(__dirname, "..", "src", "shared"),
						"@utils": path.resolve(__dirname, "..", "src", "utils"),
						vscode: path.resolve(__dirname, "..", "standalone", "runtime-files", "vscode", "vscode-stubs.js"),
						"grpc-health-check": false, // Disable grpc-health-check for Electron
					},
					extensions: [".js", ".ts", ".json"],
					fallback: {
						fs: false,
						path: require.resolve("path-browserify"),
						crypto: false,
						stream: false,
						util: false,
						buffer: false,
						process: false,
					},
				},
				externals: {
					electron: "commonjs2 electron",
					"@grpc/grpc-js": "commonjs2 @grpc/grpc-js",
				},
				target: "electron-main",
				plugins: [
					new CopyWebpackPlugin({
						patterns: [
							{
								from: path.resolve(__dirname, "package.json"),
								to: "package.json",
							},
							{
								from: path.resolve(__dirname, "..", "dist-standalone", "proto"),
								to: "proto",
							},
						],
					}),
					// 暂时禁用类型检查
					// new ForkTsCheckerWebpackPlugin(),
				],
			},
			renderer: {
				config: {
					module: {
						rules: [
							{
								test: /\.css$/,
								use: [{ loader: "style-loader" }, { loader: "css-loader" }],
							},
							{
								test: /\.tsx?$/,
								exclude: /(node_modules|\.webpack)/,
								use: {
									loader: "ts-loader",
									options: {
										transpileOnly: true, // 只转译，不检查类型
										configFile: path.resolve(__dirname, "../webview-ui/tsconfig.app.json"),
									},
								},
							},
						],
					},
					resolve: {
						extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
						alias: {
							"@": path.resolve(__dirname, "../webview-ui/src"),
							"@components": path.resolve(__dirname, "../webview-ui/src/components"),
							"@context": path.resolve(__dirname, "../webview-ui/src/context"),
							"@shared": path.resolve(__dirname, "../src/shared"),
							"@utils": path.resolve(__dirname, "../webview-ui/src/utils"),
						},
						fallback: {
							path: require.resolve("path-browserify"),
						},
					},
					plugins: [
						// 暂时禁用类型检查
						// new ForkTsCheckerWebpackPlugin()
					],
				},
				entryPoints: [
					{
						html: "../webview-ui/index.html",
						js: "../webview-ui/src/main.tsx",
						name: "main_window",
						preload: {
							js: "./src/preload.ts",
						},
					},
				],
			},
		}),
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
}

export default config
