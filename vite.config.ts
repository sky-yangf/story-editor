import { defineConfig } from 'vite'

// https://vite.dev/config/
// 用 @vitejs/plugin-react-swc 替代官方 plugin，避免 fast refresh 兼容问题
// 但没装 plugin-react-swc，所以这里直接禁掉 react plugin，HMR 走 vite 自带
export default defineConfig({
  // GitHub Pages 部署在子路径（https://sky-yangf.github.io/story-editor/）
  // 本地开发（npm run dev）时 base 用 '/'，打包时改为 '/story-editor/'
  base: process.env.GITHUB_PAGES ? '/story-editor/' : '/',
  // 关键：去掉 react 插件，自己处理 .tsx 编译
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[jt]sx?$/
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' }
    }
  },
  server: {
    hmr: { overlay: false }
  }
})
