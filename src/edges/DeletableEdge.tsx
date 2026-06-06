import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'
import { useEditorStore } from '../store/editor'

/**
 * 自定义边组件：
 * - 根据 sourceHandle 在边中点显示语义化标签（1/2/3 ✓/✗ 等）
 * - 选中时叠加红色 ✕ 删除按钮
 * - 未选中且无 sourceHandle 时退化成普通 bezier 边
 */
export function DeletableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    selected
  } = props

  // reactflow 11 的 EdgeProps 故意 Omit 了 sourceHandle（用 sourceHandleId 代替），
  // 但运行时它会把整个 Edge 也塞进 props 上下文。这里通过 from `props as any` 安全地读
  // 实际 Edge 对象上的 sourceHandle（始终存在）
  const edge = props as any
  const sourceHandle: string | null | undefined = edge.sourceHandle ?? edge.sourceHandleId
  // 取源节点 id 用于查选项文本（让 badge 还能展示 "选项 1: 推开木门"）
  const sourceNodeId: string | undefined = edge.source
  // 用 getState() 而非 hook：避免订阅触发重渲染 → 重渲染时 reactflow setState → 循环 #185
  // 边不会动态改变 source，初始化时拿到节点即可
  const sourceNode = sourceNodeId ? useEditorStore.getState().nodes.find(n => n.id === sourceNodeId) : null
  const optionText = (() => {
    if (!sourceHandle || !sourceNode) return null
    if (sourceNode.type === 'choice' && sourceHandle.startsWith('option-')) {
      const idx = parseInt(sourceHandle.slice(7), 10)
      if (isNaN(idx)) return null
      const opt = (sourceNode.data as any)?.options?.[idx]
      return opt?.text ?? null
    }
    return null
  })()

  const removeEdge = useEditorStore(s => s.removeEdge)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })

  // 解析 sourceHandle → 标签
  const labelInfo = parseHandleLabel(sourceHandle, optionText)
  // 当未选中且没有语义标签时，不显示 EdgeLabelRenderer（避免空 div 占空间）
  const showBadge = labelInfo !== null
  const showDeleteBtn = !!selected

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {(showBadge || showDeleteBtn) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',  // 容器不接收事件，让 reactflow 仍能选中边
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {/* 语义标签：一直显示 */}
            {showBadge && labelInfo && (
              <div
                style={{
                  ...badgeBase,
                  background: labelInfo.bg,
                  color: labelInfo.color,
                  border: `1px solid ${labelInfo.border}`
                }}
                title={labelInfo.title}
              >
                {labelInfo.text}
              </div>
            )}

            {/* 删除按钮：选中时显示 */}
            {showDeleteBtn && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  removeEdge(id)
                }}
                style={{
                  ...deleteBtn,
                  pointerEvents: 'all'  // 按钮本身要可点
                }}
                title="删除连线"
              >
                ✕
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ===== 工具 =====

interface HandleLabel {
  text: string          // 1 / 2 / ✓ / ✗
  bg: string
  color: string
  border: string
  title: string         // tooltip：'选项 1' / '条件：满足' 等
}

/**
 * 把 reactflow 的 sourceHandle 字符串解析成可读标签
 * - 'option-0' / 'option-1' → '1' / '2' （数字 1-based）
 * - 'true' → '✓' （绿）
 * - 'false' → '✗' （红）
 * - 其他 / undefined → null（不显示）
 */
function parseHandleLabel(handle: string | undefined | null, optionText: string | null = null): HandleLabel | null {
  if (!handle) return null
  if (handle.startsWith('option-')) {
    const idx = parseInt(handle.slice(7), 10)
    if (isNaN(idx)) return null
    const titleSuffix = optionText ? `：${optionText}` : ''
    return {
      text: String(idx + 1),
      bg: '#fce7f3',       // 粉色（与 choice 节点同色系）
      color: '#831843',
      border: '#f9a8d4',
      title: `选项 ${idx + 1}${titleSuffix}`
    }
  }
  if (handle === 'true') {
    return {
      text: '✓',
      bg: '#dcfce7',       // 绿
      color: '#14532d',
      border: '#86efac',
      title: '条件：满足'
    }
  }
  if (handle === 'false') {
    return {
      text: '✗',
      bg: '#fee2e2',       // 红
      color: '#7f1d1d',
      border: '#fca5a5',
      title: '条件：不满足'
    }
  }
  return null
}

// ===== 样式 =====

const badgeBase: React.CSSProperties = {
  pointerEvents: 'all',  // 让 tooltip 能显示
  fontSize: 11,
  fontWeight: 700,
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  borderRadius: 11,     // 胶囊形
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'monospace',
  cursor: 'default',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
}

const deleteBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#dc2626',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1
}
