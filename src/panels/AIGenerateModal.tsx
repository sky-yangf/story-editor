import { useState, useEffect } from 'react'
import { useEditorStore } from '../store/editor'
import { loadAISettings } from '../services/aiSettings'
import { generateStory } from '../services/storyGen'
import type { Story } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** 第一次打开时若未配置 AI，会跳到设置面板 */
  onRequestSettings: () => void
}

export function AIGenerateModal({ open, onClose, onRequestSettings }: Props) {
  const loadStory = useEditorStore(s => s.loadStory)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('')
  // 分支长度约束
  const [minPathLength, setMinPathLength] = useState(5)
  const [minNodes, setMinNodes] = useState(8)
  const [maxNodes, setMaxNodes] = useState(15)
  const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setPrompt('')
      setStyle('')
      setMinPathLength(5)
      setMinNodes(8)
      setMaxNodes(15)
      setStatus('idle')
      setErrorMsg('')
    }
  }, [open])

  // Esc 关闭（hook 必须在所有早 return 之前声明，否则 #310）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const ai = loadAISettings()

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg('请输入故事描述')
      return
    }
    setStatus('generating')
    setErrorMsg('')
    try {
      const story: Story = await generateStory(ai, {
        prompt,
        style: style || undefined,
        options: { minPathLength, minNodes, maxNodes }
      })
      // 让用户确认是否覆盖当前故事
      if (!confirm(`AI 生成了故事「${story.title}」（${Object.keys(story.nodes).length} 个节点，${story.edges.length} 条边）。\n\n将替换当前画布。继续？`)) {
        setStatus('idle')
        return
      }
      loadStory(story)
      setStatus('success')
      // 短暂显示成功再关
      setTimeout(() => onClose(), 600)
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message || String(e))
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 16 }}>✨ AI 生成故事</h2>
          <button onClick={onClose} style={btnGhost}>✕</button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* AI 配置提示 */}
          <div style={{
            fontSize: 11, color: '#6b7280',
            background: '#f9fafb', padding: 8, borderRadius: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>当前 Provider: <b>{ai.presetLabel || '自定义'}</b> · Model: <code>{ai.model}</code></span>
            <button onClick={onRequestSettings} style={{ ...btnGhost, fontSize: 11, padding: '2px 6px' }}>
              ⚙️ 改
            </button>
          </div>

          <Field label="故事点子 *（1-2 句话）">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="例：玩家醒来发现自己在一艘失事的潜水艇里，氧气只够 10 分钟，必须做出选择"
              rows={3}
              disabled={status === 'generating'}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          <Field label="风格（可选）">
            <input
              value={style}
              onChange={e => setStyle(e.target.value)}
              placeholder="例：黑色幽默、克苏鲁、温馨童话、日式推理..."
              disabled={status === 'generating'}
              style={inputStyle}
            />
          </Field>

          {/* 分支长度约束（高级） */}
          <Field label="分支结构约束">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>最短路径</div>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={minPathLength}
                  onChange={e => setMinPathLength(Math.max(2, parseInt(e.target.value) || 2))}
                  disabled={status === 'generating'}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  title="从 start 到任一 ending 最少需要多少跳"
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>最少节点</div>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={minNodes}
                  onChange={e => setMinNodes(Math.max(3, parseInt(e.target.value) || 3))}
                  disabled={status === 'generating'}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>最多节点</div>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={maxNodes}
                  onChange={e => setMaxNodes(Math.max(5, parseInt(e.target.value) || 5))}
                  disabled={status === 'generating'}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              最短路径决定"分支深度"（推荐 4-8）；节点数范围控制故事规模
            </div>
          </Field>

          {/* 错误条 */}
          {status === 'error' && (
            <div style={errorBoxStyle}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ 生成失败</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {errorMsg}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div style={{ ...errorBoxStyle, background: '#dcfce7', color: '#14532d', borderColor: '#86efac' }}>
              ✓ 已生成，正在加载到画布...
            </div>
          )}

          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            提示：生成的节点/边会自动布局成网格。生成后你可以手动调整位置、修改文本。
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={btnGhost} disabled={status === 'generating'}>
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={status === 'generating' || !prompt.trim()}
            style={{
              ...btnPrimary,
              opacity: (status === 'generating' || !prompt.trim()) ? 0.5 : 1,
              cursor: (status === 'generating' || !prompt.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {status === 'generating' ? '⏳ 生成中...' : '✨ 生成'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
  width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
  fontFamily: 'sans-serif'
}
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 18px', borderBottom: '1px solid #e5e7eb'
}
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 6,
  padding: '12px 18px', borderTop: '1px solid #e5e7eb', background: '#f9fafb',
  borderRadius: '0 0 10px 10px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '6px 10px',
  border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit'
}
const btnPrimary: React.CSSProperties = {
  fontSize: 13, padding: '6px 14px', background: '#2563eb', color: '#fff',
  border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600
}
const btnGhost: React.CSSProperties = {
  fontSize: 13, padding: '5px 10px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer'
}
const errorBoxStyle: React.CSSProperties = {
  background: '#fee2e2', color: '#7f1d1d',
  border: '1px solid #fca5a5', borderRadius: 4, padding: 10, fontSize: 12
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: '#374151', marginBottom: 4
      }}>{label}</label>
      {children}
    </div>
  )
}
