/* ============================================================
   webpack 多页构建（P3-1 三屏拆分配套）
   - 约定：源码页（根目录 HTML + 原生 ESM）保持零构建可运行，
     部署根目录即可用；本构建产出优化版 dist/（可选部署物）。
   - 经典全局脚本（ball-core/bloub/emotionball 链）保持 HTML 里的
     <script> 标签原序加载，webpack 只打包各页 ESM 控制器；
     dist 内不复制 src/controllers/**（避免与 bundle 双重执行）。
   - publicPath './'：GitHub/Gitee Pages 子路径兼容。
   ============================================================ */
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

const PAGES = [
  { name: 'index', entry: './src/controllers/index.js' },
  { name: 'screen1', entry: './src/controllers/screen1.js' },
  { name: 'window2', entry: './src/controllers/window2.js' },
  { name: 'screen2', entry: './src/controllers/screen2.js' },
  { name: 'screen3', entry: './src/controllers/screen3.js' },
  { name: 'screen4', entry: './src/controllers/screen4.js' },
  { name: 'employee', entry: './src/controllers/employee.js' }
];

/* dist 页面里，源码模块控制器标签已被 bundle 取代——摘掉避免双重初始化 */
class RemoveSourceEntryScriptsPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('RemoveSourceEntryScripts', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap('RemoveSourceEntryScripts', (data) => {
        const drop = tag => !(tag.tagName === 'script' && /src[\\/]controllers[\\/]/.test(String(tag.attributes?.src || '')));
        data.headTags = data.headTags.filter(drop);
        data.bodyTags = data.bodyTags.filter(drop);
        return data;
      });
    });
  }
}

export default {
  context: ROOT,
  mode: 'production',
  devtool: false,
  entry: Object.fromEntries(PAGES.map(p => [p.name, p.entry])),
  output: {
    path: join(ROOT, 'dist'),
    publicPath: './',
    filename: 'assets/[name].[contenthash:8].js',
    clean: true
  },
  plugins: [
    ...PAGES.map(p => new HtmlWebpackPlugin({
      template: `./${p.name}.html`,
      filename: `${p.name}.html`,
      chunks: [p.name],
      inject: true,
      scriptLoading: 'module',
      cache: false
    })),
    new RemoveSourceEntryScriptsPlugin(),
    new CopyPlugin({
      patterns: [
        { from: 'src', to: 'src', globOptions: { ignore: ['**/controllers/**'] } }
      ]
    })
  ],
  performance: { hints: false },
  stats: 'errors-warnings'
};
