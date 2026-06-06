import { Handle, Position, type NodeProps } from 'reactflow'
import type { ConditionNode as ConditionNodeType } from '../types'

export function ConditionNode({ data, selected }: NodeProps<ConditionNodeType>) {
  const conds = data?.conditions ?? []
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: '#e0e7ff',
        border: `2px solid ${selected ? '#6366f1' : '#a5b4fc'}`,
        minWidth: 200,
        position: 'relative',
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none'
      }}
    >
      <div style={{ fontSize: 11, color: '#3730a3', fontWeight: 700 }}>🔀 条件</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {data?.title || '条件节点'}
      </div>
      <div style={{ fontSize: 11, color: '#4338ca', marginTop: 4, fontFamily: 'monospace' }}>
        {conds.length > 0
          ? conds
              .map((c: any) =>
                c.type === 'compare' ? `${c.key} ${c.op} ${c.value}` : c.type
              )
              .join(' && ')
          : '（未设置条件）'}
      </div>

      {/* true / false 两个输出 */}
      <div style={{ position: 'absolute', right: -8, top: '40%' }}>
        <div style={{ position: 'relative', textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ true</span>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ background: '#16a34a', top: 6, width: 10, height: 10 }}
          />
        </div>
        <div style={{ position: 'relative', textAlign: 'right', marginTop: 16 }}>
          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>✗ false</span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ background: '#dc2626', top: 6, width: 10, height: 10 }}
          />
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#6366f1' }}
      />
    </div>
  )
}
