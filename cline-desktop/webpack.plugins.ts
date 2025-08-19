import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin")

export const plugins = [
	// 暂时禁用类型检查，专注于让应用运行起来
	// new ForkTsCheckerWebpackPlugin({
	//   logger: 'webpack-infrastructure',
	// }),
]
