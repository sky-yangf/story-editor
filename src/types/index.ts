// ===== 基础类型 =====

/** 游戏中的状态变量值 */
export type StateValue = number | string | boolean

/** 全局游戏状态 */
export interface GameState {
  variables: Record<string, StateValue>   // 金币: 10, 理智: 100
  inventory: string[]                      // ['古井钥匙', '旧照片']
  history: string[]                        // 走过的节点 ID 列表
}

/** 条件：判断当前状态是否满足 */
export type Condition =
  | { type: 'compare'; key: string; op: '>=' | '>' | '==' | '<' | '<=' | '!='; value: StateValue }
  | { type: 'has_item'; item: string }
  | { type: 'not_has_item'; item: string }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }

/** 效果：触发后改变状态 */
export type Effect =
  | { type: 'set'; key: string; value: StateValue }
  | { type: 'add'; key: string; value: number }
  | { type: 'add_item'; item: string }
  | { type: 'remove_item'; item: string }

// ===== 节点类型 =====

export type NodeType = 'start' | 'narrative' | 'choice' | 'condition' | 'ending'

interface BaseNode {
  id: string                    // 唯一 ID
  type: NodeType
  title: string                 // 节点标题
  description: string           // 节点描述（玩家看到的文字）
  background?: string           // 背景图 URL 或 base64
  music?: string                // BGM 路径
}

export interface StartNode extends BaseNode {
  type: 'start'
  initialState?: Partial<GameState>
}

export interface NarrativeNode extends BaseNode {
  type: 'narrative'
}

export interface OptionItem {
  id: string
  text: string
  conditions?: Condition[]      // 不满足则隐藏
  effects?: Effect[]            // 点击后执行
}

export interface ChoiceNode extends BaseNode {
  type: 'choice'
  options: OptionItem[]
  prompt?: string
}

export interface ConditionNode extends BaseNode {
  type: 'condition'
  conditions: Condition[]      // 全部满足走 true
}

export interface EndingNode extends BaseNode {
  type: 'ending'
  endingTitle: string
  hidden?: boolean
  condition?: Condition
}

// ===== 节点联合类型 =====

export type StoryNode =
  | StartNode
  | NarrativeNode
  | ChoiceNode
  | ConditionNode
  | EndingNode

// ===== 边类型 =====

export interface StoryEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string         // 'option-1' / 'true' / 'false'
  label?: string
}

// ===== 完整剧本 =====

export interface Story {
  id: string
  title: string
  author: string
  description: string
  cover?: string
  version: string

  settings: {
    theme: 'light' | 'dark' | 'custom'
    font?: string
    allowSave: boolean
    allowRestart: boolean
  }

  nodes: Record<string, StoryNode>
  edges: StoryEdge[]
  positions?: Record<string, { x: number; y: number }>

  createdAt: string
  updatedAt: string
}

// ===== 运行时类型 =====

export interface RunState {
  currentNodeId: string
  variables: Record<string, StateValue>
  inventory: string[]
  history: string[]
  isEnded: boolean
  startTime: number
}
