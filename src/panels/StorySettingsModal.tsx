import { useState, useEffect } from 'react'
import { useEditorStore } from '../store/editor'
import type { Story } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

export function StorySettingsModal({ open, onClose }: Props) {
  const story = useEditorStore(s => s.story)
  const updateStoryMeta = useEditorStore(s => s.updateStoryMeta)
  const updateStorySettings = useEditorStore(s => s.updateStorySettings)

  // 本地表单状态（编辑时不影响 store，按"应用"才提交）
  const [draft, setDraft] = useState<Story>(story)

  // === Hook 1：每次打开模态时，从 store 重新加载最新值
  useEffect(() => {
    if (open) setDraft(story)
  }, [open, story])

  // === Hook 2：Esc 关闭（必须在所有早 return 之前声明，否则 hooks 数量变化 → React 炸）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 早 return 必须放在所有 hooks 之后
  if (!open) return null

  // 应用
  const handleApply = () => {
    const { title, author, description, cover, version, settings } = draft
    updateStoryMeta({ title, author, description, cover, version })
    updateStorySettings(settings)
    onClose()
  }

  // 重置
  const handleReset = () => setDraft(story)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: 560,
          maxHeight: '90vh', overflowY: 'auto',
          fontFamily: 'sans-serif'
        }}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>⚙️ 故事设置</h2>
          <button onClick={onClose} style={btnGhost} title="关闭 (Esc)">✕</button>
        </div>

        {/* 表单 */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="标题 *">
            <input
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="如：迷雾山庄"
              style={inputStyle}
            />
          </Field>

          <Field label="作者">
            <input
              value={draft.author}
              onChange={e => setDraft({ ...draft, author: e.target.value })}
              placeholder="如：匿名"
              style={inputStyle}
            />
          </Field>

          <Field label="简介">
            <textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="故事的简短描述，玩家在试玩页能看到"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          <Field label="封面图 URL（可选）">
            <input
              value={draft.cover ?? ''}
              onChange={e => setDraft({ ...draft, cover: e.target.value || undefined })}
              placeholder="https://... 或留空"
              style={inputStyle}
            />
            {draft.cover && (
              <div style={{ marginTop: 6 }}>
                <img
                  src={draft.cover}
                  alt="封面预览"
                  style={{
                    maxWidth: '100%', maxHeight: 120,
                    borderRadius: 4, border: '1px solid #e5e7eb'
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
          </Field>

          <Field label="版本号">
            <input
              value={draft.version}
              onChange={e => setDraft({ ...draft, version: e.target.value })}
              placeholder="1.0"
              style={{ ...inputStyle, width: 100 }}
            />
          </Field>

          <Field label="主题（试玩页用）">
            <select
              value={draft.settings.theme}
              onChange={e => setDraft({
                ...draft,
                settings: { ...draft.settings, theme: e.target.value as 'light' | 'dark' | 'custom' }
              })}
              style={inputStyle}
            >
              <option value="light">亮色</option>
              <option value="dark">暗色</option>
              <option value="custom">自定义</option>
            </select>
          </Field>

          <Field label="">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CheckRow
                checked={draft.settings.allowSave}
                onChange={v => setDraft({ ...draft, settings: { ...draft.settings, allowSave: v } })}
                label="允许玩家存档"
              />
              <CheckRow
                checked={draft.settings.allowRestart}
                onChange={v => setDraft({ ...draft, settings: { ...draft.settings, allowRestart: v } })}
                label="允许玩家重新开始"
              />
            </div>
          </Field>
        </div>

        {/* 底部 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', borderTop: '1px solid #e5e7eb', background: '#f9fafb',
          borderRadius: '0 0 10px 10px'
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            按 Esc 关闭 · 修改后可 Ctrl+Z 撤销
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleReset} style={btnGhost}>重置</button>
            <button onClick={onClose} style={btnGhost}>取消</button>
            <button
              onClick={handleApply}
              style={{
                ...btnPrimary,
                opacity: !draft.title.trim() ? 0.5 : 1,
                cursor: !draft.title.trim() ? 'not-allowed' : 'pointer'
              }}
              disabled={!draft.title.trim()}
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== 子组件 =====

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label style={{
          display: 'block', fontSize: 12, fontWeight: 600,
          color: '#374151', marginBottom: 4
        }}>
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

// ===== 样式 =====
const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontFamily: 'inherit'
}

const btnPrimary: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 14px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600
}

const btnGhost: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 10px',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer'
}
