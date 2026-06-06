import { Handle, Position, type NodeProps } from 'reactflow'
import type { NarrativeNode as NarrativeNodeType } from '../types'

export function NarrativeNode({ data, selected }: NodeProps<NarrativeNodeType>) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: '#dbeafe',
        border: `2px solid ${selected ? '#3b82f6' : '#93c5fd'}`,
        minWidth: 180,
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none'
      }}
    >
      <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700 }}>📖 叙述</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {data?.title || '叙述节点'}
      </div>
      <div style={{ fontSize: 12, color: '#1e3a8a', marginTop: 4, maxWidth: 200 }}>
        {data?.description || '纯叙事，自动跳转'}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#3b82f6' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#3b82f6' }}
      />
    </div>
  )
}
