import { Handle, Position, type NodeProps } from 'reactflow'
import type { ChoiceNode as ChoiceNodeType } from '../types'

export function ChoiceNode({ data, selected }: NodeProps<ChoiceNodeType>) {
  const options = data?.options ?? []
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: '#fce7f3',
        border: `2px solid ${selected ? '#ec4899' : '#f9a8d4'}`,
        minWidth: 220,
        boxShadow: selected ? '0 0 0 3px rgba(236,72,153,0.2)' : 'none'
      }}
    >
      <div style={{ fontSize: 11, color: '#9d174d', fontWeight: 700 }}>❓ 选项</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {data?.title || '选项节点'}
      </div>
      <div style={{ fontSize: 12, color: '#831843', marginTop: 4, maxWidth: 240 }}>
        {data?.description || '玩家选择'}
      </div>

      {/* 选项列表 + 每个选项一个输出锚点 */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map((opt: any, idx: number) => (
          <div
            key={opt.id ?? idx}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #f9a8d4',
              borderRadius: 4,
              position: 'relative',
              paddingRight: 20
            }}
          >
            <span style={{ color: '#9d174d', fontWeight: 600 }}>
              {idx + 1}.
            </span>{' '}
            {opt.text}
            <Handle
              type="source"
              position={Position.Right}
              id={`option-${idx}`}
              style={{
                background: '#ec4899',
                top: '50%',
                width: 10,
                height: 10
              }}
            />
          </div>
        ))}
        {options.length === 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
            暂无选项（点击编辑）
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#ec4899' }}
      />
    </div>
  )
}
