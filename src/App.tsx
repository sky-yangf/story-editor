import { useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  useEditorStore,
  nodeTypes,
  exportStoryJson,
  importStoryJson
} from './store/editor'
import { PropertyPanel } from './panels/PropertyPanel'
import { PlayPanel } from './panels/PlayPanel'
import { DeletableEdge } from './edges/DeletableEdge'
import { StorySettingsModal } from './panels/StorySettingsModal'
import { ApiKeyModal } from './panels/ApiKeyModal'
import { AIGenerateModal } from './panels/AIGenerateModal'
import { exportStoryHtml } from './utils/exportHtml'
import type { StoryNodeType } from './store/editor'

const NODE_PALETTE: { type: StoryNodeType; label: string; color: string; emoji: string }[] = [
  { type: 'start',     label: '开始',   color: '#fef3c7', emoji: '🎬' },
  { type: 'narrative', label: '叙述',   color: '#dbeafe', emoji: '📖' },
  { type: 'choice',    label: '选项',   color: '#fce7f3', emoji: '❓' },
  { type: 'condition', label: '条件',   color: '#e0e7ff', emoji: '🔀' },
  { type: 'ending',    label: '结局',   color: '#dcfce7', emoji: '🏁' }
]

// 边类型映射：用自定义 DeletableEdge 让选中时显示删除按钮
const EDGE_TYPES = { deletable: DeletableEdge }

type Mode = 'edit' | 'play'

export default function App() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDragStop,
    addNode,
    setSelectedNodeId,
    setSelectedEdgeId,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectionCount,
    setSelectedItems,
    removeSelected,
    canUndo,
    canRedo,
    undo,
    redo,
    story,
    loadStory,
    newStory
  } = useEditorStore()

  const hasSelection = !!(selectedNodeId || selectedEdgeId)
  // 多选时按钮文案
  const deleteBtnText = selectionCount > 1
    ? `✂️ 删除 ${selectionCount} 项`
    : (selectedEdgeId ? '✂️ 删除连线' : selectedNodeId ? '✂️ 删除节点' : '✂️ 删除')

  const [mode, setMode] = useState<Mode>('edit')
  const [showSettings, setShowSettings] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 快捷键：Ctrl+Z 撤销 / Ctrl+Y 或 Ctrl+Shift+Z 重做
  useEffect(() => {
    if (mode !== 'edit') return
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      if (!meta) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, undo, redo])

  const onPaneClick = () => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setSelectedItems([], [])
    // 清掉所有 selected 标记（避免 reactflow 高亮残留）
    const hasSelected = nodes.some(n => n.selected) || edges.some(e => e.selected)
    if (hasSelected) {
      setNodes(nodes.map(n => ({ ...n, selected: false })))
      setEdges(edges.map(e => ({ ...e, selected: false })))
    }
  }
  const onNodeClick: NodeMouseHandler = (_, node) => {
    // 检查 selected 字段是否已经正确（避免重复 set）
    const alreadyCorrect = node.selected && nodes.every(n => n.id === node.id || !n.selected)
    if (!alreadyCorrect) {
      setNodes(nodes.map(n => ({ ...n, selected: n.id === node.id })))
    }
    setSelectedNodeId(node.id)
    setSelectedItems([node.id], [])
  }
  const onEdgeClick = (_e: React.MouseEvent, edge: { id: string; selected?: boolean }) => {
    const alreadyCorrect = edge.selected && edges.every(e => e.id === edge.id || !e.selected)
    if (!alreadyCorrect) {
      setEdges(edges.map(e => ({ ...e, selected: e.id === edge.id })))
    }
    setSelectedEdgeId(edge.id)
    setSelectedItems([], [edge.id])
  }

  // 拖拽开始
  const onDragStart = (e: React.DragEvent, type: StoryNodeType) => {
    e.dataTransfer.setData('application/reactflow', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  // 拖到画布放下
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow') as StoryNodeType
    if (!type) return
    const position = {
      x: e.clientX - 240,  // 减去侧边栏宽度
      y: e.clientY - 60
    }
    addNode(type, position)
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // ===== 顶部栏动作 =====
  const handleExport = () => {
    const json = exportStoryJson(story)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${story.title || 'story'}-${story.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportHtml = () => {
    const html = exportStoryHtml(story)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${story.title || 'story'}-${story.id}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = importStoryJson(text)
      if (confirm(`导入「${imported.title}」？当前未保存的修改将丢失。`)) {
        loadStory(imported)
        setMode('edit')
      }
    } catch (err: any) {
      alert('导入失败：' + (err?.message ?? String(err)))
    } finally {
      // 清 input value 以便下次还能选同名文件
      e.target.value = ''
    }
  }

  const handleNew = () => {
    if (confirm('新建空故事？当前未保存的修改将丢失。')) {
      newStory()
      setMode('edit')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* ===== 顶部工具栏 ===== */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>📖 Story Editor</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {story.title} <span style={{ color: '#9ca3af' }}>· v{story.version}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{ ...btnSecondary }}
            title="编辑故事标题/作者/封面/设置等元数据"
          >
            ⚙️ 故事设置
          </button>

          <button
            onClick={() => setShowAIGenerate(true)}
            style={{
              ...btnSecondary,
              background: 'linear-gradient(135deg, #f3e8ff 0%, #dbeafe 100%)',
              color: '#6b21a8',
              borderColor: '#c084fc',
              fontWeight: 600
            }}
            title="用 AI 生成一个完整的故事"
          >
            ✨ AI 生成
          </button>

          <div style={{ width: 1, height: 20, background: '#d1d5db' }} />

          {/* 模式切换 */}
          <div style={tabGroupStyle}>
            <button
              onClick={() => setMode('edit')}
              style={{ ...tabStyle, ...(mode === 'edit' ? tabActive : {}) }}
            >
              ✏️ 编辑
            </button>
            <button
              onClick={() => setMode('play')}
              style={{ ...tabStyle, ...(mode === 'play' ? tabActive : {}) }}
            >
              ▶ 试玩
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: '#d1d5db' }} />

          <button onClick={handleNew} style={btnSecondary} title="新建空故事">📄 新建</button>
          <button onClick={handleImportClick} style={btnSecondary} title="从 JSON 导入">📂 导入</button>
          <button onClick={handleExport} style={btnSecondary} title="导出为 JSON">💾 JSON</button>
          <button
            onClick={handleExportHtml}
            style={{ ...btnSecondary, background: '#dbeafe', color: '#1e3a8a', borderColor: '#93c5fd', fontWeight: 600 }}
            title="导出为单文件 HTML（双击即可玩，无需任何后端）"
          >
            📦 导出 HTML
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            style={{
              ...btnSecondary,
              opacity: canUndo ? 1 : 0.5,
              cursor: canUndo ? 'pointer' : 'not-allowed'
            }}
            title={canUndo ? '撤销 (Ctrl+Z)' : '没有可撤销的操作'}
          >
            ↶ 撤销
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            style={{
              ...btnSecondary,
              opacity: canRedo ? 1 : 0.5,
              cursor: canRedo ? 'pointer' : 'not-allowed'
            }}
            title={canRedo ? '重做 (Ctrl+Y / Ctrl+Shift+Z)' : '没有可重做的操作'}
          >
            ↷ 重做
          </button>
          <button
            onClick={removeSelected}
            disabled={!hasSelection}
            style={{
              ...btnSecondary,
              background: hasSelection ? '#fee2e2' : '#fff',
              color: hasSelection ? '#991b1b' : '#9ca3af',
              borderColor: hasSelection ? '#fca5a5' : '#d1d5db',
              cursor: hasSelection ? 'pointer' : 'not-allowed'
            }}
            title={hasSelection ? `删除选中项 (Backspace/Delete / 选中 ${selectionCount} 项)` : '先选中一个节点或连线'}
          >
            {deleteBtnText}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </header>

      {/* ===== 故事设置模态 ===== */}
      <StorySettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

      {/* ===== AI 设置 + AI 生成 ===== */}
      <ApiKeyModal
        open={showApiKey}
        onClose={() => setShowApiKey(false)}
      />
      <AIGenerateModal
        open={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        onRequestSettings={() => { setShowAIGenerate(false); setShowApiKey(true) }}
      />

      {/* ===== 主体 ===== */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {mode === 'edit' ? (
          <>
            {/* 左侧：节点库 + 属性面板 */}
            <aside
              style={{
                width: 240,
                background: '#f9fafb',
                borderRight: '1px solid #e5e7eb',
                padding: 16,
                overflowY: 'auto'
              }}
            >
              <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>📦 节点库</h2>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
                拖拽到右侧画布
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {NODE_PALETTE.map(p => (
                  <div
                    key={p.type}
                    draggable
                    onDragStart={e => onDragStart(e, p.type)}
                    style={{
                      padding: '10px 12px',
                      background: p.color,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'grab',
                      fontSize: 13,
                      fontWeight: 600,
                      userSelect: 'none'
                    }}
                  >
                    {p.emoji} {p.label}
                  </div>
                ))}
              </div>

              {/* 选中节点的属性面板 */}
              <h2 style={{ fontSize: 16, margin: '24px 0 12px' }}>✏️ 节点属性</h2>
              <PropertyPanel />
            </aside>

            {/* 右侧：画布 */}
            <main style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 10,
                  background: 'rgba(255,255,255,0.9)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#374151',
                  border: '1px solid #e5e7eb'
                }}
              >
                💡 从左侧拖节点到画布 → 拖动节点之间连线 → 点击节点查看属性
              </div>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onNodeDragStop={onNodesDragStop}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={EDGE_TYPES}
                defaultEdgeOptions={{ type: 'deletable' }}
                selectionOnDrag
                panOnDrag={[1, 2]}  // 滚轮/中键 pan（避免和拖框选冲突）
                selectionKeyCode={['Shift']}
                multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </main>
          </>
        ) : (
          /* ===== 试玩模式 ===== */
          <main style={{ flex: 1, background: '#f3f4f6', overflowY: 'auto' }}>
            <PlayPanel />
          </main>
        )}
      </div>
    </div>
  )
}

// ===== 样式 =====
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 16px',
  background: '#fff',
  borderBottom: '1px solid #e5e7eb',
  height: 48,
  flexShrink: 0
}

const tabGroupStyle: React.CSSProperties = {
  display: 'flex',
  background: '#f3f4f6',
  borderRadius: 5,
  padding: 2,
  gap: 2
}

const tabStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 12px',
  background: 'transparent',
  color: '#6b7280',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontWeight: 600
}

const tabActive: React.CSSProperties = {
  background: '#fff',
  color: '#1f2937',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
}

const btnSecondary: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 10px',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 500
}
