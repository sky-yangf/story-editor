/**
 * "扩写当前节点" 的 AI 生成器
 * 输入：当前节点 + 上下文
 * 输出：改写后的节点 JSON
 */

import { chatCompletion, extractJson } from './llm'
import type { LLMConfig } from './llm'
import type { StoryNode, Story } from '../types'

/**
 * 扩写节点的 system prompt
 * 关键设计：
 * - 输出必须含 type 字段（保持原类型）
 * - 改 description 主体
 * - 改 title 让它更吸引人
 * - 如果是 choice 节点，可以增删改 options（保持 2-3 个）
 * - 如果是 condition 节点，可以调 conditions（保持 1-2 个）
 * - 如果是 narrative 节点，可以重写 description
 * - 如果是 ending 节点，改 endingTitle 让结局名更精炼
 * - 不改 type，不改 id
 */
const SYSTEM_PROMPT = `你是一个剧情游戏文案编辑。你的任务是：根据用户的指示和上下文，扩写/改写当前节点的内容，让剧情更生动。

# 输出格式
输出必须是 **严格的 JSON 对象**（不要 markdown 代码块），字段如下：

{
  "title": "新标题",
  "description": "新描述（玩家看到的文字）",
  // 类型专属字段（保持原 type，只输出需要的字段）：
  "prompt": "你选择：",  // 仅 choice 节点
  "options": [...],      // 仅 choice 节点
  "conditions": [...],   // 仅 condition 节点
  "endingTitle": "结局名", // 仅 ending 节点
  "initialState": {...}  // 仅 start 节点
}

# 严格规则
- 必须保留 type 字段
- 必须保留 id 字段
- 不要改 nodes/edges 结构
- choice 节点的 options 保持 2-3 个
- condition 节点的 conditions 保持 1-2 个
- 不要输出除 JSON 外的任何文字

# 风格
- description 用第二人称（"你..."）
- 长度：30-150 字
- 节点类型约束：
  - start: 故事开场
  - narrative: 推进剧情
  - choice: 玩家选择
  - condition: 条件分支
  - ending: 故事结局
`

export interface NodeGenRequest {
  node: StoryNode
  /** 上下文：故事的标题、简介、相邻节点（辅助理解） */
  context: {
    storyTitle: string
    storyDescription?: string
    /** 进出该节点的边连接的节点标题 */
    adjacentTitles?: string[]
  }
  /** 用户的额外指示（可选），如"更血腥一点"、"加悬念" */
  userHint?: string
}

export async function generateNode(
  cfg: LLMConfig,
  req: NodeGenRequest
): Promise<StoryNode> {
  const contextInfo = [
    `故事标题：${req.context.storyTitle}`,
    req.context.storyDescription ? `故事简介：${req.context.storyDescription}` : '',
    req.context.adjacentTitles?.length
      ? `相邻节点：${req.context.adjacentTitles.join('、')}`
      : ''
  ].filter(Boolean).join('\n')

  const currentNodeJson = JSON.stringify(req.node, null, 2)
  const userContent = `当前节点：\n${currentNodeJson}\n\n${contextInfo}\n\n${req.userHint ? '指示：' + req.userHint : '请扩写这个节点，让它更生动有趣。'}`

  const resp = await chatCompletion(cfg, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ],
    temperature: 0.8,
    jsonMode: true
  })

  const raw = extractJson<any>(resp.content)

  // 合并：保留 type 和 id，覆盖其他字段
  return {
    ...req.node,
    title: raw.title || req.node.title,
    description: raw.description ?? req.node.description,
    // 类型专属
    ...(req.node.type === 'choice' && raw.options ? {
      options: raw.options.map((o: any, i: number) => ({
        id: o.id || `opt_${req.node.id}_${i}_${Date.now()}`,
        text: o.text || `选项 ${i + 1}`,
        effects: o.effects || [],
        conditions: o.conditions
      })),
      prompt: raw.prompt ?? (req.node as any).prompt
    } : {}),
    ...(req.node.type === 'condition' && raw.conditions ? {
      conditions: raw.conditions
    } : {}),
    ...(req.node.type === 'ending' && raw.endingTitle ? {
      endingTitle: raw.endingTitle
    } : {}),
    ...(req.node.type === 'start' && raw.initialState ? {
      initialState: raw.initialState
    } : {})
  } as StoryNode
}
