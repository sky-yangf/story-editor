/**
 * "故事点子 → 完整 Story" 的 AI 生成器
 * 输入：用户的 1-2 句提示
 * 输出：符合 Story schema 的 JSON
 */

import { chatCompletion, extractJson } from './llm'
import type { LLMConfig } from './llm'
import type { Story, StoryNode, StoryEdge } from '../types'

const SYSTEM_PROMPT = `你是一个交互式剧情游戏设计师。你的任务是根据用户的一句话或几句话描述，生成一个完整的、可玩的"剧情节点图"。

# 输出格式
输出必须是 **严格的 JSON 对象**（不要 markdown 代码块包裹），字段如下：

{
  "title": "故事标题",
  "author": "AI 生成" 或真实作者,
  "description": "故事简介（1-2 句）",
  "cover": null 或 图片URL,
  "version": "1.0",
  "nodes": {
    "start_xxx": { "id": "start_xxx", "type": "start", "title": "...", "description": "...", "initialState": { "variables": {"理智": 100}, "inventory": [] } },
    "narrative_xxx": { "id": "...", "type": "narrative", "title": "...", "description": "..." },
    "choice_xxx": { "id": "...", "type": "choice", "title": "...", "description": "...", "prompt": "你选择：", "options": [{"id":"o1","text":"...","effects":[]}] },
    "condition_xxx": { "id": "...", "type": "condition", "title": "...", "description": "...", "conditions": [{"type":"compare","key":"理智","op":">","value":50}] },
    "ending_xxx": { "id": "...", "type": "ending", "title": "...", "description": "...", "endingTitle": "GOOD END", "hidden": false }
  },
  "edges": [
    { "id": "e1", "source": "start_xxx", "target": "choice_xxx" },
    { "id": "e2", "source": "choice_xxx", "target": "narrative_xxx", "sourceHandle": "option-0" },
    { "id": "e3", "source": "condition_xxx", "target": "...", "sourceHandle": "true" }
  ]
}

# 节点类型与规则
- 必须有且只有 1 个 type="start" 的节点（入口）
- 至少有 2 个 type="ending" 的节点（多结局）
- 至少 3 个 type="choice" 节点（玩家决策）
- narrative 节点用于推进剧情（不需玩家操作）
- condition 节点用于分支判断：满足 → true 分支，不满足 → false 分支

# 严禁（违反会被自动校验拒绝）
- 1 个 narrative 节点最多被 1 条边指向（in-degree ≤ 1）—— narrative 是路径专属，不允许多分支汇聚
  - 多分支应该各自写一段独立的 narrative，**或者**汇聚到 choice 节点（让玩家继续选）
  - 这条规则的目的是：玩家在不同分支看到的叙述必须严格匹配他/她的路径
- narrative 节点的 description 不要写"你刚才/刚刚/已经选择了 X"这类预设——只描述该节点独有的剧情
- 不要在 narrative 里"剧透"另一条分支的内容
- 一条路径上不要放 2 个连续的 choice 节点（中间必须用 narrative 隔开，让玩家有"喘气"）

# 边 (edges) 规则
- start 节点：只能有 1 条出边（不需 sourceHandle）
- choice 节点：每个 option 一条出边，sourceHandle 必须是 "option-0"、"option-1"、... 对应选项索引
- condition 节点：2 条出边，sourceHandle 分别是 "true" 和 "false"
- narrative 节点：1 条出边（不需 sourceHandle）
- ending 节点：0 条出边（终止）

# 严禁
- 不要输出 markdown 代码块标记（\`\`\`json 等）
- 不要输出除 JSON 之外的任何文字（包括"好的，下面是..."、"Here's the story:" 等）
- 不要省略任何 id 字段（每个节点、每条边都必须有 id）
- source/target 必须引用真实存在的节点 id

# 数量控制（用户可在 UI 中调整）
- 总节点数：6-15 个（太多会撑爆 UI）
- 总边数：节点数 × 1.0 到 1.6 之间
- 选项节点每个有 2-3 个 option
- **最短路径约束**：从 start 到任一 ending 的最短跳数 ≥ minPathLength
  - 这意味着每个 ending 之前至少要有 minPathLength 个"剧情步骤"（narrative/choice）
  - 玩家不会"一秒钟就结局"
`

export interface StoryGenOptions {
  /** 最少总节点数（含 start/ending），默认 8 */
  minNodes?: number
  /** 最多总节点数，默认 15 */
  maxNodes?: number
  /** 最短路径长度（start → ending 至少多少跳），默认 5 */
  minPathLength?: number
}

export interface StoryGenRequest {
  prompt: string
  /** 可选：希望的故事风格 */
  style?: string
  /** 可选：结构约束 */
  options?: StoryGenOptions
}

export async function generateStory(
  cfg: LLMConfig,
  req: StoryGenRequest
): Promise<Story> {
  const opts: Required<StoryGenOptions> = {
    minNodes: req.options?.minNodes ?? 8,
    maxNodes: req.options?.maxNodes ?? 15,
    minPathLength: req.options?.minPathLength ?? 5
  }

  // 把约束拼到 system prompt 里（替换默认的"数量控制"段）
  const sizeHint = `# 数量控制（用户已指定）
- 总节点数（含 start 和 ending）：${opts.minNodes} - ${opts.maxNodes} 个
- 最短路径长度（start → ending 的跳数）：≥ ${opts.minPathLength}
- 最短路径 = "中间必须至少有 ${opts.minPathLength} 个 narrative 或 choice 节点"——这意味着你的设计必须保证玩家走完一条分支至少要经历 ${opts.minPathLength} 个剧情步骤才到 ending
- 提示：分支越多，每条分支的"长度"自然越短——你需要在"分支数量"和"分支深度"之间取舍`

  const customizedSystemPrompt = SYSTEM_PROMPT.replace(
    /# 数量控制[\s\S]*?(?=\n# |\n`)/,
    sizeHint + '\n'
  )

  const userContent = req.style
    ? `${req.prompt}\n\n风格：${req.style}`
    : req.prompt

  const resp = await chatCompletion(cfg, {
    messages: [
      { role: 'system', content: customizedSystemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.8,
    jsonMode: true
  })

  const raw = extractJson<any>(resp.content)

  // 校验 + 转换为合法 Story
  return validateAndNormalizeStory(raw, opts)
}

/**
 * 把 LLM 返回的对象校验 + 规范化成 Story
 * 错误抛 Error
 */
export function validateAndNormalizeStory(
  raw: any,
  opts?: StoryGenOptions
): Story {
  const minNodes = opts?.minNodes ?? 0
  const maxNodes = opts?.maxNodes ?? Infinity
  const minPathLength = opts?.minPathLength ?? 0

  if (!raw || typeof raw !== 'object') throw new Error('LLM 返回不是对象')

  // 校验 title
  if (!raw.title || typeof raw.title !== 'string') {
    throw new Error('故事缺少 title 字段')
  }

  // 校验 nodes
  const nodesRaw = raw.nodes
  if (!nodesRaw || typeof nodesRaw !== 'object') {
    throw new Error('故事缺少 nodes 字段')
  }

  // 数组形式（LLM 容易返回数组）转对象
  let nodesMap: Record<string, StoryNode>
  if (Array.isArray(nodesRaw)) {
    nodesMap = {}
    for (const n of nodesRaw) {
      if (!n.id) throw new Error('某节点缺少 id')
      nodesMap[n.id] = n as StoryNode
    }
  } else {
    nodesMap = nodesRaw
  }

  // 找 start 节点
  const startNodes = Object.values(nodesMap).filter((n: any) => n.type === 'start')
  if (startNodes.length === 0) throw new Error('故事没有 start 节点')
  if (startNodes.length > 1) throw new Error(`故事有多个 start 节点 (${startNodes.length})`)

  // 找 ending 节点
  const endingNodes = Object.values(nodesMap).filter((n: any) => n.type === 'ending')
  if (endingNodes.length < 2) {
    throw new Error(`故事只有 ${endingNodes.length} 个 ending（至少需要 2 个多结局）`)
  }

  // 校验边
  const edgesRaw = raw.edges
  if (!Array.isArray(edgesRaw)) throw new Error('edges 字段必须是数组')
  const nodeIdSet = new Set(Object.keys(nodesMap))
  const normalizedEdges: StoryEdge[] = []
  for (let i = 0; i < edgesRaw.length; i++) {
    const e = edgesRaw[i]
    if (!e.source || !e.target) {
      throw new Error(`第 ${i} 条边缺少 source/target`)
    }
    if (!nodeIdSet.has(e.source)) {
      throw new Error(`第 ${i} 条边 source "${e.source}" 不存在`)
    }
    if (!nodeIdSet.has(e.target)) {
      throw new Error(`第 ${i} 条边 target "${e.target}" 不存在`)
    }
    // 校验 sourceHandle
    if (e.sourceHandle !== undefined && e.sourceHandle !== null) {
      const sh = e.sourceHandle
      if (typeof sh !== 'string') {
        throw new Error(`第 ${i} 条边 sourceHandle 不是字符串`)
      }
      // 校验是 option-N / true / false
      if (!/^option-\d+$/.test(sh) && sh !== 'true' && sh !== 'false') {
        throw new Error(`第 ${i} 条边 sourceHandle "${sh}" 非法（必须是 option-N / true / false）`)
      }
    }
    normalizedEdges.push({
      id: e.id || `e${i + 1}_${Date.now()}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: e.label
    })
  }

  // 校验：节点总数在 [minNodes, maxNodes] 范围内
  const totalNodes = Object.keys(nodesMap).length
  if (totalNodes < minNodes) {
    throw new Error(`节点总数 ${totalNodes} < 最少要求 ${minNodes}——请生成更多剧情步骤`)
  }
  if (totalNodes > maxNodes) {
    throw new Error(`节点总数 ${totalNodes} > 最多要求 ${maxNodes}——请精简剧情`)
  }

  // 校验：最短路径长度（start → 任意 ending 的 BFS 最短跳数）≥ minPathLength
  // 注意：使用 normalizedEdges（ID 已规范化）跑 BFS
  if (minPathLength > 0) {
    const startNode = Object.values(nodesMap).find((n: any) => n.type === 'start')
    if (startNode) {
      // 邻接表
      const adj: Record<string, string[]> = {}
      for (const id of Object.keys(nodesMap)) adj[id] = []
      for (const e of normalizedEdges) {
        if (adj[e.source]) adj[e.source].push(e.target)
      }
      // BFS
      const dist: Record<string, number> = { [(startNode as any).id]: 0 }
      const queue: string[] = [(startNode as any).id]
      while (queue.length) {
        const u = queue.shift()!
        const d = dist[u] ?? 0
        for (const v of adj[u] || []) {
          if (dist[v] === undefined) {
            dist[v] = d + 1
            queue.push(v)
          }
        }
      }
      // 找所有 ending 的最短距离
      const endingDistances: number[] = []
      for (const [id, n] of Object.entries(nodesMap)) {
        if ((n as any).type === 'ending' && dist[id] !== undefined) {
          endingDistances.push(dist[id])
        }
      }
      if (endingDistances.length === 0) {
        throw new Error('没有任何 ending 从 start 可达——请检查边的连接')
      }
      const shortestPath = Math.min(...endingDistances)
      if (shortestPath < minPathLength) {
        throw new Error(
          `最短路径只有 ${shortestPath} 跳（要求 ≥ ${minPathLength}）——` +
          `玩家走完最短分支只用了 ${shortestPath} 步就结局了，太短。` +
          `请在 ending 之前多加 ${minPathLength - shortestPath} 个 narrative/choice 节点。`
        )
      }
    }
  }

  // 给节点补默认字段
  const normalizedNodes: Record<string, StoryNode> = {}
  for (const [id, n] of Object.entries(nodesMap)) {
    const node: any = { id, ...n }
    if (!node.title) node.title = id
    if (node.type === 'choice') {
      if (!Array.isArray(node.options) || node.options.length === 0) {
        throw new Error(`choice 节点 ${id} 没有 options`)
      }
      // 给 options 补 id
      node.options = node.options.map((opt: any, i: number) => ({
        id: opt.id || `opt_${id}_${i}`,
        text: opt.text || `选项 ${i + 1}`,
        effects: opt.effects || [],
        conditions: opt.conditions
      }))
    }
    if (node.type === 'condition') {
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        throw new Error(`condition 节点 ${id} 没有 conditions`)
      }
    }
    if (node.type === 'start') {
      node.initialState = node.initialState || { variables: {}, inventory: [] }
    }
    if (node.type === 'ending') {
      if (!node.endingTitle) node.endingTitle = node.title
    }
    normalizedNodes[id] = node as StoryNode
  }

  // 校验：narrative 节点 in-degree ≤ 1（强制每段叙述只服务一条路径）
  // 允许 0（孤儿，但会被孤立检查）和 1（唯一进入边）
  const inDegree: Record<string, number> = {}
  for (const id of Object.keys(normalizedNodes)) inDegree[id] = 0
  for (const e of normalizedEdges) inDegree[e.target] = (inDegree[e.target] || 0) + 1
  for (const id of Object.keys(normalizedNodes)) {
    const n: any = normalizedNodes[id]
    if (n.type === 'narrative' && inDegree[id] > 1) {
      throw new Error(
        `narrative 节点 "${n.title || id}" 被 ${inDegree[id]} 条边指向（in-degree > 1）` +
        `——这是逻辑错误：不同分支的玩家会看到相同描述但实际路径不同。` +
        `请为每个分支写独立的 narrative，或在分支后汇聚到 choice 节点。`
      )
    }
  }

  // 校验：choice 节点不能直接连 choice 节点（中间需 narrative 隔开）
  for (const e of normalizedEdges) {
    const s: any = normalizedNodes[e.source]
    const t: any = normalizedNodes[e.target]
    if (s.type === 'choice' && t.type === 'choice') {
      throw new Error(
        `两个 choice 节点直接相连（${s.title || e.source} → ${t.title || e.target}）` +
        `——中间必须用 narrative 节点隔开，让玩家有"叙事喘气"。`
      )
    }
  }

  // 自动布局：节点位置（简单的 2 列网格）
  const positions: Record<string, { x: number; y: number }> = {}
  const colCount = 3
  const colWidth = 300
  const rowHeight = 180
  Object.keys(normalizedNodes).forEach((id, i) => {
    const col = i % colCount
    const row = Math.floor(i / colCount)
    positions[id] = { x: 100 + col * colWidth, y: 100 + row * rowHeight }
  })

  const now = new Date().toISOString()
  return {
    id: `story_${Date.now()}`,
    title: raw.title,
    author: raw.author || 'AI 生成',
    description: raw.description || '',
    cover: raw.cover || undefined,
    version: raw.version || '1.0',
    settings: raw.settings || { theme: 'dark', allowSave: true, allowRestart: true },
    nodes: normalizedNodes,
    edges: normalizedEdges,
    positions,
    createdAt: now,
    updatedAt: now
  }
}
