import { Handle, Position, type NodeProps } from 'reactflow'
import type { StartNode as StartNodeType } from '../types'

export function StartNode({ data, selected }: NodeProps<StartNodeType>) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: '#fef3c7',
        border: `2px solid ${selected ? '#f59e0b' : '#fbbf24'}`,
        minWidth: 180,
        boxShadow: selected ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none'
      }}
    >
      <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>🎬 开始</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {data?.title || '开始节点'}
      </div>
      <div style={{ fontSize: 12, color: '#78350f', marginTop: 4, maxWidth: 200 }}>
        {data?.description || '故事入口'}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#f59e0b' }}
      />
    </div>
  )
}
