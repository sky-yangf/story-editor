import { Handle, Position, type NodeProps } from 'reactflow'
import type { EndingNode as EndingNodeType } from '../types'

export function EndingNode({ data, selected }: NodeProps<EndingNodeType>) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: data?.hidden ? '#fee2e2' : '#dcfce7',
        border: `2px solid ${selected ? (data?.hidden ? '#dc2626' : '#16a34a') : data?.hidden ? '#fca5a5' : '#86efac'}`,
        minWidth: 180,
        boxShadow: selected ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none'
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: data?.hidden ? '#7f1d1d' : '#14532d',
          fontWeight: 700
        }}
      >
        {data?.hidden ? '🏁 隐藏结局' : '🏁 结局'}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {data?.endingTitle || '结局'}
      </div>
      <div
        style={{
          fontSize: 12,
          color: data?.hidden ? '#991b1b' : '#166534',
          marginTop: 4,
          maxWidth: 200
        }}
      >
        {data?.description || '故事结束'}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: data?.hidden ? '#dc2626' : '#16a34a' }}
      />
    </div>
  )
}
