import { useState } from 'react'
import { useEditorStore } from '../store/editor'
import {
  OptionEditor,
  EffectListEditor,
  ConditionListEditor
} from './Editors'
import { loadAISettings } from '../services/aiSettings'
import { generateNode } from '../services/nodeGen'
import type {
  StartNode,
  NarrativeNode,
  ChoiceNode,
  ConditionNode,
  EndingNode,
  StoryNode,
  GameState
} from '../types'

export function PropertyPanel() {
  const selectedId = useEditorStore(s => s.selectedNodeId)
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const story = useEditorStore(s => s.story)
  const updateNodeData = useEditorStore(s => s.updateNodeData)
  const removeNode = useEditorStore(s => s.removeNode)
  const node = nodes.find(n => n.id === selectedId)

  // AI 扩写状态
  const [aiStatus, setAiStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [aiError, setAiError] = useState('')
  const [aiHint, setAiHint] = useState('')

  const handleAI = async (hint?: string) => {
    if (!node) return
    setAiStatus('running')
    setAiError('')
    try {
      // 找相邻节点标题（让 AI 知道上下文）
      const adjacentTitles: string[] = []
      for (const e of edges) {
        if (e.source === node.id) {
          const t = nodes.find(n => n.id === e.target)
          if (t) adjacentTitles.push(`${(t.data as any).title || t.id} (→)`)
        }
        if (e.target === node.id) {
          const s = nodes.find(n => n.id === e.source)
          if (s) adjacentTitles.push(`${(s.data as any).title || s.id} (←)`)
        }
      }
      const ai = loadAISettings()
      const updated = await generateNode(ai, {
        node: node.data as StoryNode,
        context: {
          storyTitle: story.title,
          storyDescription: story.description,
          adjacentTitles
        },
        userHint: hint
      })
      // 写回 store
      updateNodeData(node.id, updated)
      setAiStatus('idle')
    } catch (e: any) {
      setAiStatus('error')
      setAiError(e?.message || String(e))
    }
  }

  if (!node) {
    return (
      <div
        style={{
          fontSize: 12,
          color: '#6b7280',
          textAlign: 'center',
          padding: '20px 0',
          fontStyle: 'italic'
        }}
      >
        👆 点击节点查看属性
      </div>
    )
  }

  const data = node.data as any as StoryNode

  // 通用：标题 + 描述
  const updateField = (patch: any) => {
    updateNodeData(node.id, patch)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 头部：节点类型 + 删除按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 6,
          background: '#f3f4f6',
          borderRadius: 4
        }}
      >
        <span style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
          {node.type} · {node.id}
        </span>
        <button
          onClick={() => {
            if (confirm(`删除节点 "${data.title || node.id}"？`)) {
              removeNode(node.id)
            }
          }}
          style={{
            fontSize: 10,
            padding: '2px 6px',
            background: '#fee2e2',
            color: '#991b1b',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer'
          }}
        >
          删除
        </button>
      </div>

      {/* 通用：标题 */}
      <Field label="标题">
        <input
          value={data.title || ''}
          onChange={e => updateField({ title: e.target.value })}
          style={inputStyle}
        />
      </Field>

      {/* 通用：描述 */}
      <Field label="描述">
        <textarea
          value={data.description || ''}
          onChange={e => updateField({ description: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      {/* AI 扩写按钮（只有选中节点才显示） */}
      <div style={{ marginTop: 8, padding: 8, background: '#faf5ff', borderRadius: 4, border: '1px solid #e9d5ff' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={aiHint}
            onChange={e => setAiHint(e.target.value)}
            placeholder="可选指示：更血腥 / 加悬念 / 改成 50 字"
            disabled={aiStatus === 'running'}
            style={{
              flex: 1, fontSize: 11, padding: '4px 6px',
              border: '1px solid #d1d5db', borderRadius: 3,
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={() => handleAI(aiHint || undefined)}
            disabled={aiStatus === 'running'}
            style={{
              fontSize: 11, padding: '4px 8px',
              background: aiStatus === 'running' ? '#f3e8ff' : 'linear-gradient(135deg, #c084fc, #6366f1)',
              color: aiStatus === 'running' ? '#7c3aed' : '#fff',
              border: 'none', borderRadius: 3, cursor: aiStatus === 'running' ? 'wait' : 'pointer',
              fontWeight: 600, whiteSpace: 'nowrap'
            }}
            title="用 AI 扩写这个节点的标题/描述/选项等"
          >
            {aiStatus === 'running' ? '⏳' : '✨'} AI 扩写
          </button>
        </div>
        {aiError && (
          <div style={{ fontSize: 10, color: '#dc2626', marginTop: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            ⚠ {aiError.substring(0, 200)}
          </div>
        )}
      </div>

      {/* 类型专属 */}
      {node.type === 'start' && <StartEditor data={data as StartNode} update={updateField} />}
      {node.type === 'narrative' && <NarrativeEditor data={data as NarrativeNode} update={updateField} />}
      {node.type === 'choice' && <ChoiceEditor data={data as ChoiceNode} update={updateField} />}
      {node.type === 'condition' && <ConditionEditor data={data as ConditionNode} update={updateField} />}
      {node.type === 'ending' && <EndingEditor data={data as EndingNode} update={updateField} />}
    </div>
  )
}

// ===== 类型专属编辑器 =====

function StartEditor({
  data,
  update
}: {
  data: StartNode
  update: (patch: Partial<StartNode>) => void
}) {
  const initState: Partial<GameState> = data.initialState ?? {}
  const vars = initState.variables ?? {}
  const inv = initState.inventory ?? []

  const updateVars = (newVars: Record<string, number | string | boolean>) => {
    update({ initialState: { ...initState, variables: newVars } })
  }
  const updateInv = (newInv: string[]) => {
    update({ initialState: { ...initState, inventory: newInv } })
  }

  return (
    <>
      <details>
        <summary style={summaryStyle}>初始状态（{Object.keys(vars).length} 变量, {inv.length} 物品）</summary>
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
            变量（key = value）
          </div>
          {Object.entries(vars).map(([k, v], idx) => (
            <div key={idx} style={{ display: 'flex', gap: 3, marginBottom: 3, fontSize: 11 }}>
              <input
                value={k}
                onChange={e => {
                  const newKey = e.target.value
                  const newVars: any = {}
                  Object.entries(vars).forEach(([key, val], i) => {
                    if (i === idx) newVars[newKey] = val
                    else newVars[key] = val
                  })
                  updateVars(newVars)
                }}
                placeholder="key"
                style={{ ...inputStyle, flex: 1, padding: '2px 4px' }}
              />
              <span>=</span>
              <input
                value={String(v)}
                onChange={e => {
                  const newV = e.target.value
                  const num = Number(newV)
                  const newVars: any = { ...vars }
                  newVars[k] = !isNaN(num) && newV !== '' ? num : newV
                  updateVars(newVars)
                }}
                style={{ width: 60, fontSize: 11, padding: '2px 4px' }}
              />
              <button
                onClick={() => {
                  const newVars: any = { ...vars }
                  delete newVars[k]
                  updateVars(newVars)
                }}
                style={delBtnStyle}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => updateVars({ ...vars, [`var_${Object.keys(vars).length + 1}`]: 0 })}
            style={addBtnStyle}
          >
            + 变量
          </button>

          <div style={{ fontSize: 11, color: '#6b7280', margin: '8px 0 4px' }}>初始物品</div>
          {inv.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 3, marginBottom: 3, fontSize: 11 }}>
              <input
                value={item}
                onChange={e => updateInv(inv.map((x, i) => (i === idx ? e.target.value : x)))}
                style={{ ...inputStyle, flex: 1, padding: '2px 4px' }}
              />
              <button onClick={() => updateInv(inv.filter((_, i) => i !== idx))} style={delBtnStyle}>×</button>
            </div>
          ))}
          <button onClick={() => updateInv([...inv, '新物品'])} style={addBtnStyle}>
            + 物品
          </button>
        </div>
      </details>
    </>
  )
}

function NarrativeEditor({ update }: { data: NarrativeNode; update: (patch: any) => void }) {
  return (
    <Field label="📝 自动跳转到下一节点">
      <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
        描述将自动展示后跳转（用边连到下一节点）
      </div>
    </Field>
  )
}

function ChoiceEditor({
  data,
  update
}: {
  data: ChoiceNode
  update: (patch: Partial<ChoiceNode>) => void
}) {
  return (
    <>
      <Field label="提示语（可选）">
        <input
          value={data.prompt ?? ''}
          onChange={e => update({ prompt: e.target.value })}
          placeholder="如：你选择："
          style={inputStyle}
        />
      </Field>
      <Field label="选项列表">
        <OptionEditor
          options={data.options}
          onChange={options => update({ options })}
        />
      </Field>
    </>
  )
}

function ConditionEditor({
  data,
  update
}: {
  data: ConditionNode
  update: (patch: Partial<ConditionNode>) => void
}) {
  return (
    <>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        全部条件满足时走 <b style={{ color: '#16a34a' }}>✓ true</b> 分支，否则走 <b style={{ color: '#dc2626' }}>✗ false</b> 分支
      </div>
      <ConditionListEditor
        conditions={data.conditions}
        onChange={conditions => update({ conditions })}
      />
    </>
  )
}

function EndingEditor({
  data,
  update
}: {
  data: EndingNode
  update: (patch: Partial<EndingNode>) => void
}) {
  return (
    <>
      <Field label="结局名">
        <input
          value={data.endingTitle}
          onChange={e => update({ endingTitle: e.target.value })}
          style={inputStyle}
        />
      </Field>
      <Field label="">
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={data.hidden ?? false}
            onChange={e => update({ hidden: e.target.checked })}
          />
          隐藏结局
        </label>
      </Field>
    </>
  )
}

// ===== UI 部件 =====

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 4
          }}
        >
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontFamily: 'inherit'
}

const summaryStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
  userSelect: 'none',
  padding: 4
}

const delBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '1px 5px',
  background: '#fee2e2',
  color: '#991b1b',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer'
}

const addBtnStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '2px 6px',
  background: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: 3,
  cursor: 'pointer',
  marginTop: 4
}
