import { useState, useEffect } from 'react'
import { PROVIDER_PRESETS, loadAISettings, saveAISettings, type AISettings } from '../services/aiSettings'
import { chatCompletion } from '../services/llm'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (s: AISettings) => void
}

export function ApiKeyModal({ open, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<AISettings>(loadAISettings())
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState<string>('')

  // 每次打开重新从 localStorage 加载
  useEffect(() => {
    if (open) {
      setDraft(loadAISettings())
      setTestStatus('idle')
      setTestMsg('')
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

  const pickPreset = (label: string) => {
    const p = PROVIDER_PRESETS.find(x => x.label === label)
    if (!p) return
    setDraft({
      ...draft,
      presetLabel: p.label,
      baseUrl: p.baseUrl,
      model: p.defaultModel
    })
  }

  const handleSave = () => {
    saveAISettings(draft)
    onSaved?.(draft)
    onClose()
  }

  const handleTest = async () => {
    setTestStatus('testing')
    setTestMsg('')
    try {
      const r = await chatCompletion(draft, {
        messages: [
          { role: 'system', content: 'You are a connectivity test bot. Reply with exactly: PONG' },
          { role: 'user', content: 'ping' }
        ],
        maxTokens: 16,
        temperature: 0
      })
      if (r.content.toUpperCase().includes('PONG') || r.content.length > 0) {
        setTestStatus('ok')
        setTestMsg(`✓ 连接成功（模型: ${r.model || draft.model}）`)
      } else {
        setTestStatus('fail')
        setTestMsg('返回内容异常：' + r.content.substring(0, 100))
      }
    } catch (e: any) {
      setTestStatus('fail')
      setTestMsg('✗ ' + (e?.message || String(e)).substring(0, 300))
    }
  }

  const currentPreset = PROVIDER_PRESETS.find(p => p.baseUrl === draft.baseUrl)

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 16 }}>🤖 AI 设置（OpenAI 兼容）</h2>
          <button onClick={onClose} style={btnGhost}>✕</button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Preset 选择 */}
          <Field label="Provider 预设">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PROVIDER_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => pickPreset(p.label)}
                  style={{
                    ...presetStyle,
                    ...(draft.presetLabel === p.label ? presetActive : {})
                  }}
                >
                  <div style={{ fontSize: 18 }}>{p.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{p.defaultModel}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Base URL（兼容 OpenAI 即可）">
            <input
              value={draft.baseUrl}
              onChange={e => setDraft({ ...draft, baseUrl: e.target.value, presetLabel: currentPreset?.label ?? '自定义' })}
              placeholder="https://api.openai.com/v1"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              任何 <a href="https://platform.openai.com/docs/api-reference/chat" target="_blank" rel="noopener" style={{ color: '#2563eb' }}>OpenAI Chat Completions 兼容</a> 的服务都可以填（如本地 Ollama / vLLM / LM Studio / Azure / DashScope 兼容模式）
            </div>
          </Field>

          <Field label="API Key">
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-...（本地服务可留空）"
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
              />
              <button onClick={() => setShowKey(!showKey)} style={btnGhost}>
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
          </Field>

          <Field label="Model 名称">
            <input
              value={draft.model}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
              placeholder="gpt-4o-mini / qwen-plus / qwen2.5:7b"
              style={inputStyle}
            />
          </Field>

          {/* 测试连接 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              style={{
                ...btnGhost,
                background: testStatus === 'testing' ? '#f3f4f6' : '#fff',
                cursor: testStatus === 'testing' ? 'wait' : 'pointer'
              }}
            >
              {testStatus === 'testing' ? '⏳ 测试中...' : '🔌 测试连接'}
            </button>
            {testMsg && (
              <span style={{
                fontSize: 11,
                color: testStatus === 'ok' ? '#16a34a' : testStatus === 'fail' ? '#dc2626' : '#6b7280',
                fontFamily: 'monospace'
              }}>
                {testMsg}
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#9ca3af', background: '#f9fafb', padding: 8, borderRadius: 4 }}>
            💡 API key 保存在浏览器 localStorage（明文，仅本机）。生产环境应使用后端代理避免泄露。
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button onClick={handleSave} style={btnPrimary}>保存</button>
        </div>
      </div>
    </div>
  )
}

// ===== 样式 =====
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
const presetStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: 10, background: '#f9fafb',
  border: '1px solid #d1d5db', borderRadius: 6,
  cursor: 'pointer', textAlign: 'center'
}
const presetActive: React.CSSProperties = {
  background: '#dbeafe', borderColor: '#2563eb'
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
