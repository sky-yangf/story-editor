import { create } from 'zustand'
import type { Story, RunState } from '../types'
import {
  restart as runtimeRestart,
  selectOption as runtimeSelectOption,
  advance as runtimeAdvance,
  resolveCondition as runtimeResolveCondition
} from '../runtime/engine'

interface PlayRuntimeState {
  story: Story | null
  runState: RunState | null
  error: string | null

  // ===== 动作 =====
  start: (story: Story) => void
  exit: () => void
  choose: (optionIndex: number) => void
  advance: () => void
  restart: () => void
}

export const usePlayStore = create<PlayRuntimeState>((set, get) => ({
  story: null,
  runState: null,
  error: null,

  start: story => {
    let rs = runtimeRestart(story)
    if (!rs) {
      set({ story, runState: null, error: '找不到开始节点（start 节点）' })
      return
    }
    // 进入试玩后自动跳过 start 节点，直接展示下一节点
    // 如果 start 没有下一节点（孤岛），则停在 start 让玩家看到
    const r = runtimeAdvance(story, rs)
    if (!r.error) {
      rs = r.newState
    }
    set({ story, runState: rs, error: r.error ?? null })
  },

  exit: () => set({ story: null, runState: null, error: null }),

  choose: optionIndex => {
    const { story, runState } = get()
    if (!story || !runState) return
    const r = runtimeSelectOption(story, runState, optionIndex)
    set({ runState: r.newState, error: r.error ?? null })
  },

  advance: () => {
    const { story, runState } = get()
    if (!story || !runState) return
    const node = story.nodes[runState.currentNodeId]
    if (!node) {
      set({ error: '当前节点不存在' })
      return
    }
    // 自动判断走哪个引擎函数
    let r
    if (node.type === 'start' || node.type === 'narrative') {
      r = runtimeAdvance(story, runState)
    } else if (node.type === 'condition') {
      r = runtimeResolveCondition(story, runState)
    } else {
      set({ error: `当前节点类型 ${node.type} 不可 advance（choice 节点请点选项）` })
      return
    }
    set({ runState: r.newState, error: r.error ?? null })
  },

  restart: () => {
    const { story } = get()
    if (!story) return
    let rs = runtimeRestart(story)
    if (!rs) {
      set({ runState: null, error: '找不到开始节点' })
      return
    }
    // 重启时也自动跳过 start
    const r = runtimeAdvance(story, rs)
    if (!r.error) rs = r.newState
    set({ runState: rs, error: r.error ?? null })
  }
}))
