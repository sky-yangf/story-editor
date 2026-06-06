import type {
  Story,
  RunState,
  StoryNode,
  StoryEdge,
  ConditionNode,
  EndingNode,
  Effect
} from '../types'
import { initRunState, pushHistory, toGameState } from './state'
import { applyEffects } from './effect'
import { evaluateCondition } from './condition'

/** 找到指定 source + handle 的下一条边 */
export function findNextEdge(
  story: Story,
  sourceId: string,
  handle?: string
): StoryEdge | null {
  return (
    story.edges.find(
      e => e.source === sourceId && (handle ? e.sourceHandle === handle : !e.sourceHandle)
    ) ?? null
  )
}

/** 玩家点击选项：根据 option 找到下一节点 */
export function selectOption(
  story: Story,
  state: RunState,
  optionIndex: number
): { newState: RunState; error?: string } {
  const node = story.nodes[state.currentNodeId]
  if (!node) return { newState: state, error: '当前节点不存在' }
  if (node.type !== 'choice') return { newState: state, error: '当前节点不是选项节点' }
  const option = node.options[optionIndex]
  if (!option) return { newState: state, error: '选项不存在' }

  // 1. 执行选项的效果（applyEffects 返回 GameState，spread 到 RunState）
  const gs = applyEffects(option.effects ?? [], toGameState(state))
  let newState: RunState = { ...state, ...gs }

  // 2. 找到下一节点
  const edge = findNextEdge(story, state.currentNodeId, `option-${optionIndex}`)
  if (!edge) return { newState, error: '选项没有连接目标节点' }

  // 3. 跳转
  newState = pushHistory(newState, edge.target)
  newState = { ...newState, currentNodeId: edge.target }
  newState = checkEnding(newState, story)
  return { newState }
}

/** 自动推进：start / narrative 节点都接（start 进游戏就跑一次） */
export function advance(
  story: Story,
  state: RunState
): { newState: RunState; error?: string } {
  const node = story.nodes[state.currentNodeId]
  if (node.type !== 'start' && node.type !== 'narrative') {
    return { newState: state, error: `当前节点类型 ${node.type} 不可 advance` }
  }
  const edge = findNextEdge(story, state.currentNodeId)
  if (!edge) return { newState: state, error: `${node.type === 'start' ? '开始' : '叙述'}节点没有下一节点` }
  const newState = pushHistory(state, edge.target)
  newState.currentNodeId = edge.target
  return { newState: checkEnding(newState, story) }
}

// 旧 API 保留：叙述节点专用
/** @deprecated 改用 advance() */
export function advanceNarrative(
  story: Story,
  state: RunState
): { newState: RunState; error?: string } {
  return advance(story, state)
}

/** 条件节点：根据条件结果选 true/false 分支 */
export function resolveCondition(
  story: Story,
  state: RunState
): { newState: RunState; error?: string } {
  const node = story.nodes[state.currentNodeId]
  if (node.type !== 'condition') return { newState: state, error: '不是条件节点' }

  const passed = node.conditions.every(c =>
    evaluateCondition(c, toGameState(state))
  )

  const handle = passed ? 'true' : 'false'
  const edge = findNextEdge(story, state.currentNodeId, handle)
  if (!edge) return { newState: state, error: `条件节点没有 ${handle} 分支` }

  const newState = pushHistory(state, edge.target)
  newState.currentNodeId = edge.target
  return { newState: checkEnding(newState, story) }
}

/** 检查是否进入结局 */
export function checkEnding(state: RunState, story: Story): RunState {
  const node = story.nodes[state.currentNodeId]
  if (node && node.type === 'ending') {
    return { ...state, isEnded: true }
  }
  return state
}

/** 从头开始 */
export function restart(story: Story): RunState | null {
  const startNode = Object.values(story.nodes).find(n => n.type === 'start')
  if (!startNode || startNode.type !== 'start') return null
  return initRunState(story, startNode)
}

/** 列出所有结局（用于玩家回顾）*/
export function listEndings(story: Story): EndingNode[] {
  return Object.values(story.nodes).filter(
    (n): n is EndingNode => n.type === 'ending'
  )
}

/** 当前节点 */
export function getCurrentNode(story: Story, state: RunState): StoryNode | null {
  return story.nodes[state.currentNodeId] ?? null
}
