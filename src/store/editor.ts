import { create } from 'zustand'
import {
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges
} from 'reactflow'
import type { Story, StoryNode, StoryEdge } from '../types'
import { StartNode } from '../nodes/StartNode'
import { NarrativeNode } from '../nodes/NarrativeNode'
import { ChoiceNode } from '../nodes/ChoiceNode'
import { ConditionNode } from '../nodes/ConditionNode'
import { EndingNode } from '../nodes/EndingNode'

// 节点类型 → React 组件映射
export const nodeTypes = {
  start: StartNode,
  narrative: NarrativeNode,
  choice: ChoiceNode,
  condition: ConditionNode,
  ending: EndingNode
}

export type StoryNodeType = StoryNode['type']

interface EditorState {
  story: Story
  setStory: (story: Story) => void
  loadStory: (story: Story) => void
  newStory: () => void

  // React Flow 原生
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onNodesDragStop: () => void  // 拖完写回 positions

  // 新增节点
  addNode: (type: StoryNodeType, position: { x: number; y: number }) => void

  // 更新节点数据
  updateNodeData: (id: string, data: any) => void

  // 选中 + 删除（单选，兼容旧代码）
  selectedNodeId: string | null
  selectedEdgeId: string | null
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  removeSelected: () => void

  // 多选（拖框 / Shift+点）
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  setSelectedItems: (nodeIds: string[], edgeIds: string[]) => void
  selectionCount: number
  // 批量删除：按 id 列表删（自动跳过不存在的；节点删时连带清掉关联边）
  removeMany: (nodeIds: string[], edgeIds: string[]) => void

  // 故事元数据
  updateStoryMeta: (patch: Partial<Pick<Story, 'title' | 'author' | 'description' | 'cover' | 'version'>>) => void
  updateStorySettings: (patch: Partial<Story['settings']>) => void

  // Undo / Redo
  past: Story[]
  future: Story[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

// 默认示例故事
function createDefaultStory(): Story {
  const now = new Date().toISOString()
  return {
    id: 'demo_story_1',
    title: '示例故事：迷雾山庄',
    author: '匿名',
    description: '一个克苏鲁风格的短篇推理',
    version: '1.0',
    settings: { theme: 'dark', allowSave: true, allowRestart: true },
    nodes: {
      start_1: {
        id: 'start_1',
        type: 'start',
        title: '迷雾山庄',
        description: '你在一间陌生的房间里醒来...',
        initialState: { variables: { 理智: 100, 金币: 10 }, inventory: [] }
      },
      choice_1: {
        id: 'choice_1',
        type: 'choice',
        title: '离开房间',
        description: '你打量四周，发现三个出口。',
        prompt: '你选择：',
        options: [
          { id: 'opt_1', text: '推开木门' },
          { id: 'opt_2', text: '翻窗而逃' },
          { id: 'opt_3', text: '大声呼救' }
        ]
      },
      narrative_1: {
        id: 'narrative_1',
        type: 'narrative',
        title: '走廊',
        description: '走廊阴暗，墙壁上有斑驳的血迹...'
      },
      ending_1: {
        id: 'ending_1',
        type: 'ending',
        title: '逃离山庄',
        description: '你冲出迷雾，回到了现实。',
        endingTitle: '普通结局'
      }
    },
    edges: [
      { id: 'e1', source: 'start_1', target: 'choice_1' },
      { id: 'e2', source: 'choice_1', target: 'narrative_1', sourceHandle: 'option-0' },
      { id: 'e3', source: 'narrative_1', target: 'ending_1' }
    ],
    positions: {
      start_1: { x: 100, y: 100 },
      choice_1: { x: 100, y: 280 },
      narrative_1: { x: 400, y: 280 },
      ending_1: { x: 400, y: 480 }
    },
    createdAt: now,
    updatedAt: now
  }
}

// 把 Story 转换成 React Flow 的 nodes/edges
function storyToFlow(story: Story): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.values(story.nodes).map(n => ({
    id: n.id,
    type: n.type,
    position: story.positions?.[n.id] ?? { x: 0, y: 0 },
    data: n as any
  }))
  const edges: Edge[] = story.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: 'deletable',
    animated: false
  }))
  return { nodes, edges }
}

// 把 React Flow 状态反向合成回 Story
function flowToStory(
  story: Story,
  nodes: Node[],
  edges: Edge[]
): Story {
  const positions: Record<string, { x: number; y: number }> = {}
  const newNodesMap: Record<string, StoryNode> = {}
  for (const n of nodes) {
    positions[n.id] = n.position
    newNodesMap[n.id] = n.data as any
  }
  const newEdges: StoryEdge[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: e.label != null ? String(e.label) : undefined
  }))
  return {
    ...story,
    nodes: newNodesMap,
    edges: newEdges,
    positions,
    updatedAt: new Date().toISOString()
  }
}

const STORAGE_KEY = 'story-editor:current'
const MAX_HISTORY = 50

// 数组浅比较（id 数组通常元素都唯一，无需深比较）
function arraysEq<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function loadInitialStory(): Story {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Story
      if (parsed && parsed.nodes && parsed.edges) return parsed
    }
  } catch (e) {
    console.warn('加载本地存档失败：', e)
  }
  return createDefaultStory()
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initialStory = loadInitialStory()
  const { nodes, edges } = storyToFlow(initialStory)

  // 把每次 set 后的 story 落 localStorage（节流）
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleSave = (story: Story) => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(story))
      } catch (e) {
        console.warn('保存到 localStorage 失败：', e)
      }
    }, 300)
  }

  // 用 ref 标记"是否正在初始化"，避免初始 load 触发回写
  // (W2 阶段: 每次 set 都保存; 后续优化再加 initializing 跳过)
  return {
    story: initialStory,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectionCount: 0,
    setStory: story => {
      set({ story })
      scheduleSave(story)
    },
    loadStory: story => {
      // 加载新故事：清空 history（不同故事的历史不该混）
      const { nodes, edges } = storyToFlow(story)
      const edgesWithType = edges.map(e => ({ ...e, type: 'deletable' }))
      set({
        story, nodes, edges: edgesWithType,
        selectedNodeId: null, selectedEdgeId: null,
        selectedNodeIds: [], selectedEdgeIds: [], selectionCount: 0,
        past: [], future: []
      })
      scheduleSave(story)
    },
    newStory: () => {
      const fresh = createDefaultStory()
      const { nodes, edges } = storyToFlow(fresh)
      const edgesWithType = edges.map(e => ({ ...e, type: 'deletable' }))
      set({
        story: fresh, nodes, edges: edgesWithType,
        selectedNodeId: null, selectedEdgeId: null,
        selectedNodeIds: [], selectedEdgeIds: [], selectionCount: 0,
        past: [], future: []
      })
      scheduleSave(fresh)
    },

    nodes,
    edges,
    setNodes: nodes => {
      set({ nodes })
      const story = flowToStory(get().story, nodes, get().edges)
      set({ story })
      scheduleSave(story)
    },
    setEdges: edges => {
      set({ edges })
      const story = flowToStory(get().story, get().nodes, edges)
      set({ story })
      scheduleSave(story)
    },

    onNodesChange: changes => {
      const oldNodes = get().nodes
      // 分离"内容变更"（拖动/加删）和"选中状态变更"（select）
      const hasContentChange = changes.some(c => c.type !== 'select' && c.type !== 'dimensions')
      const hasSelectChange = changes.some(c => c.type === 'select')
      const newNodes = applyNodeChanges(changes, oldNodes)
      set({ nodes: newNodes })
      // position 变化交给 onNodesDragStop 显式回写（避免每次微移都保存）
      // 但如果是"内容变更"（非 select/dimensions）也写 story —— 实际上 add/remove 也走单独的 action
      // 这里只处理 select 类的"高亮"，通过 selected 字段反映到多选统计
      if (hasSelectChange) {
        // 同步多选统计到 store（注意：不能触发新 setNodes 引起循环）
        const selectedNodeIds = newNodes.filter(n => n.selected).map(n => n.id)
        const firstSelectedNodeId = selectedNodeIds[0] ?? null
        // 只在 selected 字段真变化时调 setSelectedItems（短路保护内置）
        get().setSelectedItems(selectedNodeIds, get().selectedEdgeIds)
        // 单选字段也同步（PropertyPanel 仍用）
        if (firstSelectedNodeId && get().selectedNodeId !== firstSelectedNodeId) {
          set({ selectedNodeId: firstSelectedNodeId, selectedEdgeId: null })
        } else if (!firstSelectedNodeId && get().selectedNodeId !== null) {
          set({ selectedNodeId: null })
        }
        // 注意：故意不调 flowToStory/scheduleSave —— selected 字段不影响 Story
      }
    },
    onEdgesChange: changes => {
      // reactflow 的 remove edge 走 onEdgesChange
      const oldEdges = get().edges
      const newEdges = applyEdgeChanges(changes, oldEdges)
      const removed = oldEdges.length - newEdges.length > 0
      if (removed) {
        // 删边：先 snapshot
        const past = [...get().past, get().story].slice(-MAX_HISTORY)
        set({ edges: newEdges, past, future: [], canUndo: past.length > 0, canRedo: false })
        const story = flowToStory(get().story, get().nodes, newEdges)
        set({ story })
        scheduleSave(story)
      } else {
        set({ edges: newEdges })
        // 检查是否有 select 类 change
        const hasSelectChange = changes.some(c => c.type === 'select')
        if (hasSelectChange) {
          const selectedEdgeIds = newEdges.filter(e => e.selected).map(e => e.id)
          const firstSelectedEdgeId = selectedEdgeIds[0] ?? null
          get().setSelectedItems(get().selectedNodeIds, selectedEdgeIds)
          if (firstSelectedEdgeId && get().selectedEdgeId !== firstSelectedEdgeId) {
            set({ selectedEdgeId: firstSelectedEdgeId, selectedNodeId: null })
          } else if (!firstSelectedEdgeId && get().selectedEdgeId !== null) {
            set({ selectedEdgeId: null })
          }
        }
      }
    },
    onConnect: connection => {
      // 连线：先 snapshot
      const past = [...get().past, get().story].slice(-MAX_HISTORY)
      const newEdges = addEdge(
        { ...connection, type: 'deletable', animated: false },
        get().edges
      )
      set({ edges: newEdges, past, future: [], canUndo: past.length > 0, canRedo: false })
      const story = flowToStory(get().story, get().nodes, newEdges)
      set({ story })
      scheduleSave(story)
    },
    onNodesDragStop: () => {
      // 拖完节点：先 snapshot（如果位置真有变）
      const oldStory = get().story
      const newStory = flowToStory(oldStory, get().nodes, get().edges)
      // 位置未变就不入栈
      if (JSON.stringify(oldStory.positions) === JSON.stringify(newStory.positions)) {
        set({ story: newStory })
        scheduleSave(newStory)
        return
      }
      const past = [...get().past, oldStory].slice(-MAX_HISTORY)
      set({ story: newStory, past, future: [], canUndo: past.length > 0, canRedo: false })
      scheduleSave(newStory)
    },

    addNode: (type, position) => {
      // 加节点：先 snapshot
      const past = [...get().past, get().story].slice(-MAX_HISTORY)
      const id = `${type}_${Date.now()}`
      const newNode: StoryNode = (() => {
        switch (type) {
          case 'start':
            return { id, type, title: '新开始', description: '故事入口' }
          case 'narrative':
            return { id, type, title: '新叙述', description: '' }
          case 'choice':
            return {
              id,
              type,
              title: '新选项',
              description: '',
              options: [
                { id: 'opt_1', text: '选项 1' },
                { id: 'opt_2', text: '选项 2' }
              ]
            }
          case 'condition':
            return {
              id,
              type,
              title: '新条件',
              description: '',
              conditions: [{ type: 'compare', key: '理智', op: '>', value: 50 }]
            }
          case 'ending':
            return { id, type, title: '新结局', description: '', endingTitle: '结局' }
        }
      })()
      const newFlowNode: Node = { id, type, position, data: newNode as any }
      const newNodes = [...get().nodes, newFlowNode]
      set({ nodes: newNodes, past, future: [], canUndo: past.length > 0, canRedo: false })
      const story = flowToStory(get().story, newNodes, get().edges)
      set({ story })
      scheduleSave(story)
    },

    updateNodeData: (id, data) => {
      // 改属性：先 snapshot（每次输入字符都 snapshot 一次也行，但有点密——改成只在真的有变化时 snapshot）
      const oldNode = get().nodes.find(n => n.id === id)
      if (!oldNode) return
      const newData = { ...oldNode.data, ...data }
      // 检查是否真有变化
      if (JSON.stringify(newData) === JSON.stringify(oldNode.data)) return
      const past = [...get().past, get().story].slice(-MAX_HISTORY)
      const newNodes = get().nodes.map(n =>
        n.id === id ? { ...n, data: newData } : n
      )
      set({ nodes: newNodes, past, future: [], canUndo: past.length > 0, canRedo: false })
      const story = flowToStory(get().story, newNodes, get().edges)
      set({ story })
      scheduleSave(story)
    },

    selectedNodeId: null,
    selectedEdgeId: null,
    setSelectedNodeId: id => set({ selectedNodeId: id, selectedEdgeId: null }),
    setSelectedEdgeId: id => set({ selectedEdgeId: id, selectedNodeId: null }),

    setSelectedItems: (nodeIds, edgeIds) => {
      // 同步单选字段（保持兼容）：取第一个作为"主选中"
      const firstNodeId = nodeIds[0] ?? null
      const firstEdgeId = edgeIds[0] ?? null
      const cur = get()
      // 短路：如果完全一致就不调 set（避免 reactflow 互相触发的死循环 #185）
      const sameNodes = arraysEq(cur.selectedNodeIds, nodeIds)
      const sameEdges = arraysEq(cur.selectedEdgeIds, edgeIds)
      if (sameNodes && sameEdges && cur.selectionCount === nodeIds.length + edgeIds.length
          && cur.selectedNodeId === firstNodeId && cur.selectedEdgeId === firstEdgeId) {
        return
      }
      set({
        selectedNodeIds: nodeIds,
        selectedEdgeIds: edgeIds,
        selectionCount: nodeIds.length + edgeIds.length,
        // 如果单选字段不一致，更新（多选时保持 selectedNodeId = 第一个，方便属性面板显示）
        selectedNodeId: firstNodeId,
        selectedEdgeId: firstNodeId ? null : firstEdgeId
      })
    },

    removeNode: id => {
      // 删节点：先 snapshot
      const past = [...get().past, get().story].slice(-MAX_HISTORY)
      const newNodes = get().nodes.filter(n => n.id !== id)
      const newEdges = get().edges.filter(e => e.source !== id && e.target !== id)
      set({ nodes: newNodes, edges: newEdges, selectedNodeId: null, past, future: [], canUndo: past.length > 0, canRedo: false })
      const story = flowToStory(get().story, newNodes, newEdges)
      set({ story })
      scheduleSave(story)
    },

    removeEdge: id => {
      // 删边：先 snapshot
      const past = [...get().past, get().story].slice(-MAX_HISTORY)
      const newEdges = get().edges.filter(e => e.id !== id)
      set({ edges: newEdges, selectedEdgeId: null, past, future: [], canUndo: past.length > 0, canRedo: false })
      const story = flowToStory(get().story, get().nodes, newEdges)
      set({ story })
      scheduleSave(story)
    },

  removeSelected: () => {
    const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds, selectionCount } = get()
    // 多选模式
    if (selectionCount > 1) {
      get().removeMany(selectedNodeIds, selectedEdgeIds)
      return
    }
    // 单选模式
    if (selectedNodeId) {
      get().removeNode(selectedNodeId)
    } else if (selectedEdgeId) {
      get().removeEdge(selectedEdgeId)
    }
  },

  removeMany: (nodeIds, edgeIds) => {
    if (nodeIds.length === 0 && edgeIds.length === 0) return
    const past = [...get().past, get().story].slice(-MAX_HISTORY)
    const nodeIdSet = new Set(nodeIds)
    const newNodes = get().nodes.filter(n => !nodeIdSet.has(n.id))
    // 删节点时连带清掉这些节点作为 source/target 的边；同时也删用户选中的边
    const edgeIdSet = new Set(edgeIds)
    const newEdges = get().edges.filter(e =>
      !edgeIdSet.has(e.id) && !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)
    )
    set({
      nodes: newNodes,
      edges: newEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectionCount: 0,
      past,
      future: [],
      canUndo: past.length > 0,
      canRedo: false
    })
    const story = flowToStory(get().story, newNodes, newEdges)
    set({ story })
    scheduleSave(story)
  },

  // ===== 故事元数据编辑（与 undo/redo 集成）=====
  updateStoryMeta: (patch: Partial<Pick<Story, 'title' | 'author' | 'description' | 'cover' | 'version'>>) => {
    const oldStory = get().story
    const newStory = { ...oldStory, ...patch, updatedAt: new Date().toISOString() }
    if (JSON.stringify({ ...oldStory, ...patch }) === JSON.stringify({
      title: oldStory.title, author: oldStory.author, description: oldStory.description,
      cover: oldStory.cover, version: oldStory.version
    })) return
    const past = [...get().past, oldStory].slice(-MAX_HISTORY)
    set({ story: newStory, past, future: [], canUndo: past.length > 0, canRedo: false })
    scheduleSave(newStory)
  },

  updateStorySettings: (patch: Partial<Story['settings']>) => {
    const oldStory = get().story
    const newStory = {
      ...oldStory,
      settings: { ...oldStory.settings, ...patch },
      updatedAt: new Date().toISOString()
    }
    if (JSON.stringify(oldStory.settings) === JSON.stringify(newStory.settings)) return
    const past = [...get().past, oldStory].slice(-MAX_HISTORY)
    set({ story: newStory, past, future: [], canUndo: past.length > 0, canRedo: false })
    scheduleSave(newStory)
  },

    undo: () => {
      const { past, future, story: current } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      const newPast = past.slice(0, -1)
      const newFuture = [...future, current]
      // 从 story 重新生成 nodes/edges
      const { nodes, edges } = storyToFlow(prev)
      const edgesWithType = edges.map(e => ({ ...e, type: 'deletable' }))
      set({
        story: prev,
        nodes: edgesWithType.length || nodes.length ? nodes : get().nodes,  // 兜底
        edges: edgesWithType,
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: newFuture.length > 0
      })
      scheduleSave(prev)
    },

    redo: () => {
      const { past, future, story: current } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      const newFuture = future.slice(0, -1)
      const newPast = [...past, current]
      const { nodes, edges } = storyToFlow(next)
      const edgesWithType = edges.map(e => ({ ...e, type: 'deletable' }))
      set({
        story: next,
        nodes,
        edges: edgesWithType,
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: newFuture.length > 0
      })
      scheduleSave(next)
    }
  }
})

// 工具函数：导出 + 导入
export function exportStoryJson(story: Story): string {
  return JSON.stringify(story, null, 2)
}

export function importStoryJson(text: string): Story {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('不是有效 JSON')
  if (!parsed.nodes || !parsed.edges) throw new Error('缺少 nodes/edges 字段')
  // 兜底字段
  return {
    id: parsed.id ?? `story_${Date.now()}`,
    title: parsed.title ?? '未命名故事',
    author: parsed.author ?? '匿名',
    description: parsed.description ?? '',
    version: parsed.version ?? '1.0',
    settings: parsed.settings ?? { theme: 'dark', allowSave: true, allowRestart: true },
    nodes: parsed.nodes,
    edges: parsed.edges,
    positions: parsed.positions ?? {},
    cover: parsed.cover,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
  }
}
