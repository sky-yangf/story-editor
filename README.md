# 🎮 Story Editor

> 可视化剧情游戏设计器 —— 像画思维导图一样做文字冒险

[![GitHub](https://img.shields.io/badge/GitHub-sky--yangf%2Fstory--editor-blue?logo=github)](https://github.com/sky-yangf/story-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js)](https://nodejs.org)

<p align="center">
  <img src="src/assets/hero.png" alt="Story Editor 截图" width="280" />
</p>

一个基于 **React + ReactFlow** 的剧情节点图编辑器，支持试玩、撤销/重做、单文件 HTML 导出、AI 辅助生成。

---

## ✨ 核心功能

- 🎨 **5 种节点**（开始 / 叙述 / 选项 / 条件 / 结局）+ **2 种边类型**（默认 / 条件）
- 🎬 **Play Mode**（内置试玩引擎，无需后端）
- ↶ **撤销/重做**（最多 50 步）
- 📦 **单文件 HTML 导出**（13KB，**双击即玩**，零依赖）
- 🤖 **AI 辅助**（OpenAI 兼容 / DashScope / 本地 Ollama）
  - 一句话生成完整故事
  - 单节点扩写（带上下文）
- 📚 **故事元数据**（标题 / 作者 / 简介 / 封面 / 版本号 / 主题）
- 🎯 **多选 + 批量操作**（拖框选 / Shift+点 / Backspace 删）

---

## 🚀 快速开始

```bash
# 装依赖
npm install

# 启动开发模式
npm run dev
# → http://127.0.0.1:5173

# 生产构建
npm run build
# → dist/

# 本地预览生产产物
npx serve dist
```

**要求**：Node.js ≥ 20 / 现代浏览器

---

## 📦 部署

本项目是**纯前端 SPA**——`dist/` 整个目录扔到任何静态托管即可。

### 一键部署（推荐）

| 平台 | 怎么做 |
|---|---|
| **Vercel** | 仓库 → [vercel.com/new](https://vercel.com/new) → 选 `sky-yangf/story-editor` → Deploy |
| **Netlify** | 仓库 → [app.netlify.com/start](https://app.netlify.com/start) → 选仓库 → Deploy |
| **Cloudflare Pages** | Pages → Connect to Git → 选仓库 → Build: `npm run build` · Output: `dist` |

**三选一，零配置。** push 到 main 自动重新部署。

### GitHub Actions 自动部署

仓库自带 **2 个 workflow**：

- **`.github/workflows/ci.yml`** —— PR 检查（type check + build），确保合入的代码可编译
- **`.github/workflows/deploy-vercel.yml`** —— push main → 自动部署到 Vercel Production

**启用 Vercel 部署需要一步**：
1. 去 [vercel.com/account/tokens](https://vercel.com/account/tokens) 创建 token
2. 仓库 Settings → Secrets and variables → Actions → New repository secret
3. Name: `VERCEL_TOKEN` · Value: 粘贴你的 token
4. 之后 push 任何 commit 都自动部署

### Docker 部署

```bash
docker build -t story-editor .
docker run -d -p 8080:80 story-editor
# → http://localhost:8080
```

### Nginx 静态托管

```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/story-editor/dist;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

---

## 🤖 AI 功能

1. 顶栏点 **"✨ AI 生成"** → 第一次会让你配置 API
2. 选 provider（OpenAI 官方 / DashScope 兼容 / 本地 Ollama）
3. 填 API key + model 名（可点"🔌 测试连接"验证）
4. **API key 保存在浏览器 localStorage**，不上传任何服务器

支持任何 **OpenAI Chat Completions 兼容**的服务。

---

## 📁 项目结构

```
src/
├── App.tsx                  # 主应用
├── store/
│   ├── editor.ts            # 编辑器 zustand store（含 undo/redo）
│   └── play.ts              # 试玩运行时 store
├── runtime/                 # 试玩引擎（纯函数）
│   ├── engine.ts
│   ├── state.ts
│   ├── effect.ts
│   └── condition.ts
├── services/                # AI 集成
│   ├── llm.ts               # OpenAI 兼容客户端
│   ├── aiSettings.ts        # API key 持久化
│   ├── storyGen.ts          # 点子 → Story
│   └── nodeGen.ts           # 节点扩写
├── nodes/                   # 5 种节点的可视化组件
├── edges/                   # DeletableEdge（带删除按钮的边）
├── panels/                  # 左侧属性面板 + 右侧试玩面板 + 各种 modal
├── utils/
│   └── exportHtml.ts        # 单文件 HTML 导出（13KB）
└── types/                   # Story / StoryNode / RunState 类型
```

---

## 🎯 节点类型

| 类型 | 用途 | 边（出） |
|---|---|---|
| `start` | 故事入口（必须有且只有 1 个） | 1 条无 handle |
| `narrative` | 推进剧情 | 1 条无 handle |
| `choice` | 玩家选择（每个 option 一条出边） | `option-0`, `option-1`, ... |
| `condition` | 条件分支（满足/不满足） | `true`, `false` |
| `ending` | 故事结局（可以有多个） | 0 条 |

---

## 🐳 用 Docker 部署

```bash
docker build -t story-editor .
docker run -d -p 8080:80 story-editor
# → http://localhost:8080
```

---

## 🛠️ 常见任务

| 任务 | 怎么做 |
|---|---|
| 加新节点类型 | `src/nodes/` 加组件 + `src/types/index.ts` 加 type + 改 `nodeTypes` 注册 |
| 改 prompt | `src/services/storyGen.ts` 里的 `SYSTEM_PROMPT` 字符串 |
| 改导出样式 | `src/utils/exportHtml.ts` 里的 `PLAYER_CSS` 字符串 |
| 撤销/重做 | Ctrl+Z / Ctrl+Y（编辑模式） |
| 框选 | 画布空白处按住左键拖 |
| 多选 | Shift+点 / 拖框选 |
| 删选中 | Backspace / Delete / 顶栏按钮 |

---

## 🔒 关于 API key

**用户的 API key 永远只在用户自己的浏览器 localStorage 里**——**不会上传到任何服务器**（包括 Vercel/Netlify 部署的实例）。

- ✅ 仓库源代码**没有**任何硬编码的 API key（已用 `sk-` / `sk-or-` / `sk-proj-` 正则扫描过）
- ✅ Vercel/Netlify 服务器**不接触**用户的 key（纯静态托管，没有后端）
- ✅ 用户换浏览器/换电脑 → 重新填一次 key（设计如此）

**如要进一步隔离**（团队/SaaS 场景），可以加 BFF 后端代理 LLM API，但**本项目目前不需要**。

---

## 📜 License

MIT
