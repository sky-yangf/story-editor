import { useEffect } from 'react'
import { usePlayStore } from '../store/play'
import { useEditorStore } from '../store/editor'
import type { ChoiceNode, EndingNode } from '../types'

export function PlayPanel() {
  const story = usePlayStore(s => s.story)
  const runState = usePlayStore(s => s.runState)
  const error = usePlayStore(s => s.error)
  const start = usePlayStore(s => s.start)
  const exit = usePlayStore(s => s.exit)
  const choose = usePlayStore(s => s.choose)
  const restart = usePlayStore(s => s.restart)
  const editorStory = useEditorStore(s => s.story)

  // 进入即开玩
  useEffect(() => {
    if (editorStory && (!story || story.id !== editorStory.id)) {
      start(editorStory)
    }
  }, [editorStory, story, start])

  if (!story || !runState) {
    return (
      <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>
        <p>故事未加载。</p>
        {error && <p style={{ color: '#dc2626' }}>⚠ {error}</p>}
        <button onClick={() => editorStory && start(editorStory)} style={btnPrimary}>
          ▶ 开始试玩
        </button>
      </div>
    )
  }

  const node = story.nodes[runState.currentNodeId]
  if (!node) {
    return (
      <div style={{ padding: 24, color: '#dc2626', fontSize: 13 }}>
        <p>⚠ 当前节点 #{runState.currentNodeId} 不存在</p>
        <button onClick={restart} style={btnPrimary}>↻ 重新开始</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>正在试玩</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>🎮 {story.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={restart} style={btnGhost} title="重新开始">↻</button>
          <button onClick={exit} style={btnGhost} title="退出试玩">✕</button>
        </div>
      </div>

      {/* 状态栏 */}
      <StateBar variables={runState.variables} inventory={runState.inventory} />

      {/* 当前节点 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
          {labelForType(node.type)} · {node.id}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          {node.title}
        </div>
        {node.description && (
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {node.description}
          </div>
        )}
      </div>

      {/* 类型分支 */}
      {node.type === 'start' && <StartBody />}
      {node.type === 'narrative' && <NarrativeBody />}
      {node.type === 'choice' && (
        <ChoiceBody node={node} onChoose={choose} />
      )}
      {node.type === 'condition' && <ConditionBody />}
      {node.type === 'ending' && <EndingBody node={node} onRestart={restart} />}

      {/* 错误条 */}
      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', background: '#fee2e2', padding: 8, borderRadius: 4 }}>
          ⚠ {error}
        </div>
      )}

      {/* 历史轨迹 */}
      <details>
        <summary style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
          历史轨迹（{runState.history.length} 步）
        </summary>
        <ol style={{ fontSize: 11, color: '#4b5563', paddingLeft: 20, marginTop: 4 }}>
          {runState.history.map((id, i) => {
            const n = story.nodes[id]
            return (
              <li key={i}>
                <span style={{ color: '#9ca3af' }}>{id}</span> · {n?.title ?? '(不存在)'}
              </li>
            )
          })}
        </ol>
      </details>
    </div>
  )
}

// ===== 子组件 =====

function StateBar({
  variables,
  inventory
}: {
  variables: Record<string, number | string | boolean>
  inventory: string[]
}) {
  return (
    <div style={{ ...cardStyle, background: '#f9fafb' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        📊 状态
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(variables).map(([k, v]) => (
          <span key={k} style={chipVar}>
            {k} = <b>{String(v)}</b>
          </span>
        ))}
        {Object.keys(variables).length === 0 && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>（无变量）</span>
        )}
      </div>
      {inventory.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '8px 0 4px' }}>
            🎒 物品（{inventory.length}）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {inventory.map(item => (
              <span key={item} style={chipItem}>· {item}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StartBody() {
  // start 节点在 start() 时已自动 advance，玩家不会真的停在 start 节点
  // 保留这个组件以防孤岛情况（start 没有下一节点）
  return (
    <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
      已在开始位置。孤岛：start 节点没有连出。
    </div>
  )
}

function NarrativeBody() {
  const advance = usePlayStore(s => s.advance)
  return (
    <div>
      <button onClick={advance} style={btnPrimary}>继续 →</button>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
        描述已展示，点击继续跳到下一节点
      </div>
    </div>
  )
}

function ConditionBody() {
  const advance = usePlayStore(s => s.advance)
  return (
    <div>
      <button onClick={advance} style={btnPrimary}>判定 →</button>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
        条件节点：自动判断 true/false 分支
      </div>
    </div>
  )
}

function ChoiceBody({
  node,
  onChoose
}: {
  node: ChoiceNode
  onChoose: (idx: number) => void
}) {
  // 简化版：编辑器里没填 conditions 就都显示；复杂的可见性逻辑暂不在 W2 范围
  const visibleOptions = node.options.map((opt, i) => ({ opt, i }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {node.prompt && (
        <div style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{node.prompt}</div>
      )}
      {visibleOptions.length === 0 && (
        <div style={{ fontSize: 11, color: '#dc2626' }}>⚠ 没有任何选项可点</div>
      )}
      {visibleOptions.map(({ opt, i }) => (
        <button
          key={opt.id}
          onClick={() => onChoose(i)}
          style={{
            ...btnChoice,
            opacity: 1
          }}
        >
          <span style={{ color: '#9ca3af', marginRight: 6 }}>{i + 1}.</span>
          {opt.text || '(空选项)'}
        </button>
      ))}
    </div>
  )
}

function EndingBody({ node, onRestart }: { node: EndingNode; onRestart: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
        {node.endingTitle}
      </div>
      {node.hidden && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
          （隐藏结局 · 已解锁）
        </div>
      )}
      <button onClick={onRestart} style={{ ...btnPrimary, marginTop: 12 }}>
        ↻ 再玩一次
      </button>
    </div>
  )
}

function labelForType(t: string): string {
  return {
    start: '🎬 开始',
    narrative: '📖 叙述',
    choice: '❓ 选项',
    condition: '🔀 条件',
    ending: '🏁 结局'
  }[t] ?? t
}

// ===== 样式 =====
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: 12
}

const btnPrimary: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 14px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 5,
  cursor: 'pointer',
  fontWeight: 600
}

const btnGhost: React.CSSProperties = {
  fontSize: 13,
  padding: '4px 8px',
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer'
}

const btnChoice: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 12px',
  background: '#f9fafb',
  color: '#1f2937',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  cursor: 'pointer',
  textAlign: 'left'
}

const chipVar: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  background: '#dbeafe',
  color: '#1e3a8a',
  borderRadius: 3
}

const chipItem: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  background: '#fef3c7',
  color: '#78350f',
  borderRadius: 3
}
