import type { GameState, RunState, StartNode, Story } from '../types'

/** 初始化运行状态 */
export function initRunState(story: Story, startNode: StartNode): RunState {
  const initial = startNode.initialState ?? {}
  return {
    currentNodeId: startNode.id,
    variables: { ...(initial.variables ?? {}) },
    inventory: [...(initial.inventory ?? [])],
    history: [startNode.id],
    isEnded: false,
    startTime: Date.now()
  }
}

/** 记录历史 */
export function pushHistory(state: RunState, nodeId: string): RunState {
  // 防御：state 可能是 GameState（applyEffects 返回）或 RunState
  // 统一确保 history 字段存在
  const prev = state.history ?? []
  return { ...state, history: [...prev, nodeId] }
}

/** 转 GameState（用于条件求值）*/
export function toGameState(state: RunState): GameState {
  return {
    variables: state.variables,
    inventory: state.inventory,
    history: state.history
  }
}
