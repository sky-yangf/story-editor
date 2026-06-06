import type { OptionItem, Effect, Condition } from '../types'

/** 选项编辑器：增删改排序 */
export function OptionEditor({
  options,
  onChange
}: {
  options: OptionItem[]
  onChange: (options: OptionItem[]) => void
}) {
  const update = (idx: number, patch: Partial<OptionItem>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }

  const remove = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx))
  }

  const add = () => {
    onChange([
      ...options,
      {
        id: `opt_${Date.now()}`,
        text: `选项 ${options.length + 1}`,
        effects: []
      }
    ])
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          选项（{options.length}）
        </label>
        <button
          onClick={add}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            background: '#ec4899',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          + 添加
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, idx) => (
          <div
            key={opt.id}
            style={{
              border: '1px solid #f9a8d4',
              background: '#fff',
              borderRadius: 4,
              padding: 8
            }}
          >
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 10,
                  color: '#9d174d',
                  fontWeight: 700,
                  minWidth: 16
                }}
              >
                {idx + 1}.
              </span>
              <input
                value={opt.text}
                onChange={e => update(idx, { text: e.target.value })}
                placeholder="选项文字"
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '4px 6px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 3
                }}
              />
              <button
                onClick={() => remove(idx)}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer'
                }}
                title="删除"
              >
                ×
              </button>
            </div>

            {/* 选项的 effects（简化版：下拉添加） */}
            <details style={{ marginTop: 6 }}>
              <summary
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                效果（{(opt.effects ?? []).length}）
              </summary>
              <div style={{ marginTop: 4 }}>
                <EffectListEditor
                  effects={opt.effects ?? []}
                  onChange={effects => update(idx, { effects })}
                />
              </div>
            </details>
          </div>
        ))}
        {options.length === 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
            暂无选项
          </div>
        )}
      </div>
    </div>
  )
}

/** 效果列表编辑器（共用） */
export function EffectListEditor({
  effects,
  onChange
}: {
  effects: Effect[]
  onChange: (effects: Effect[]) => void
}) {
  const update = (idx: number, patch: Partial<Effect>) => {
    onChange(effects.map((e, i) => (i === idx ? ({ ...e, ...patch } as Effect) : e)))
  }
  const remove = (idx: number) => {
    onChange(effects.filter((_, i) => i !== idx))
  }
  const add = (type: Effect['type']) => {
    const newEffect = (() => {
      switch (type) {
        case 'set':
          return { type: 'set' as const, key: '', value: '' }
        case 'add':
          return { type: 'add' as const, key: '', value: 0 }
        case 'add_item':
          return { type: 'add_item' as const, item: '' }
        case 'remove_item':
          return { type: 'remove_item' as const, item: '' }
      }
    })()
    onChange([...effects, newEffect])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {effects.map((eff, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            fontSize: 11
          }}
        >
          <select
            value={eff.type}
            onChange={e => {
              const t = e.target.value as Effect['type']
              const empty = (() => {
                switch (t) {
                  case 'set': return { type: t, key: '', value: '' }
                  case 'add': return { type: t, key: '', value: 0 }
                  case 'add_item': return { type: t, item: '' }
                  case 'remove_item': return { type: t, item: '' }
                }
              })()
              onChange(effects.map((x, i) => (i === idx ? (empty as Effect) : x)))
            }}
            style={{ fontSize: 11, padding: '2px' }}
          >
            <option value="set">设置</option>
            <option value="add">加减</option>
            <option value="add_item">获得物品</option>
            <option value="remove_item">失去物品</option>
          </select>

          {eff.type === 'set' && (
            <>
              <input
                placeholder="变量名"
                value={eff.key}
                onChange={e => update(idx, { key: e.target.value })}
                style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
              />
              <span>=</span>
              <input
                placeholder="值"
                value={String(eff.value)}
                onChange={e => {
                  const v = e.target.value
                  const num = Number(v)
                  update(idx, {
                    value: !isNaN(num) && v !== '' ? num : v
                  } as any)
                }}
                style={{ width: 50, fontSize: 11, padding: '2px 4px' }}
              />
            </>
          )}

          {eff.type === 'add' && (
            <>
              <input
                placeholder="变量名"
                value={eff.key}
                onChange={e => update(idx, { key: e.target.value })}
                style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
              />
              <span>±</span>
              <input
                type="number"
                value={eff.value}
                onChange={e => update(idx, { value: Number(e.target.value) } as any)}
                style={{ width: 50, fontSize: 11, padding: '2px 4px' }}
              />
            </>
          )}

          {(eff.type === 'add_item' || eff.type === 'remove_item') && (
            <input
              placeholder="物品名"
              value={eff.item}
              onChange={e => update(idx, { item: e.target.value } as any)}
              style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
            />
          )}

          <button
            onClick={() => remove(idx)}
            style={{
              fontSize: 11,
              padding: '1px 5px',
              background: '#fee2e2',
              color: '#991b1b',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {(['set', 'add', 'add_item', 'remove_item'] as const).map(t => (
          <button
            key={t}
            onClick={() => add(t)}
            style={{
              fontSize: 10,
              padding: '2px 5px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 3,
              cursor: 'pointer'
            }}
          >
            + {t === 'set' ? '设' : t === 'add' ? '±' : t === 'add_item' ? '获得' : '失去'}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 条件列表编辑器（共用） */
export function ConditionListEditor({
  conditions,
  onChange,
  allowAndOr = true
}: {
  conditions: Condition[]
  onChange: (conditions: Condition[]) => void
  allowAndOr?: boolean
}) {
  const update = (idx: number, patch: Partial<Condition>) => {
    onChange(conditions.map((c, i) => (i === idx ? ({ ...c, ...patch } as Condition) : c)))
  }
  const remove = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx))
  }
  const add = (type: Condition['type']) => {
    const empty = (() => {
      switch (type) {
        case 'compare': return { type: 'compare' as const, key: '', op: '>' as const, value: 0 }
        case 'has_item': return { type: 'has_item' as const, item: '' }
        case 'not_has_item': return { type: 'not_has_item' as const, item: '' }
        case 'and': return { type: 'and' as const, conditions: [] }
        case 'or': return { type: 'or' as const, conditions: [] }
      }
    })()
    onChange([...conditions, empty])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {conditions.map((cond, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            fontSize: 11,
            background: '#f9fafb',
            padding: 4,
            borderRadius: 3
          }}
        >
          <select
            value={cond.type}
            onChange={e => {
              const t = e.target.value as Condition['type']
              let empty: Condition
              switch (t) {
                case 'compare': empty = { type: t, key: '', op: '>', value: 0 }; break
                case 'has_item': empty = { type: t, item: '' }; break
                case 'not_has_item': empty = { type: t, item: '' }; break
                case 'and': empty = { type: t, conditions: [] }; break
                case 'or': empty = { type: t, conditions: [] }; break
              }
              onChange(conditions.map((c, i) => (i === idx ? empty : c)))
            }}
            style={{ fontSize: 11, padding: '2px' }}
          >
            <option value="compare">比较</option>
            <option value="has_item">有物品</option>
            <option value="not_has_item">无物品</option>
            {allowAndOr && <option value="and">且 (AND)</option>}
            {allowAndOr && <option value="or">或 (OR)</option>}
          </select>

          {cond.type === 'compare' && (
            <>
              <input
                placeholder="变量"
                value={cond.key}
                onChange={e => update(idx, { key: e.target.value } as any)}
                style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
              />
              <select
                value={cond.op}
                onChange={e => update(idx, { op: e.target.value as any } as any)}
                style={{ fontSize: 11, padding: '2px' }}
              >
                <option value=">">{'>'}</option>
                <option value=">=">{'>='}</option>
                <option value="==">{'=='}</option>
                <option value="<=">{'<='}</option>
                <option value="<">{'<'}</option>
                <option value="!=">{'!='}</option>
              </select>
              <input
                value={String(cond.value)}
                onChange={e => {
                  const v = e.target.value
                  const num = Number(v)
                  update(idx, { value: !isNaN(num) && v !== '' ? num : v } as any)
                }}
                style={{ width: 50, fontSize: 11, padding: '2px 4px' }}
              />
            </>
          )}

          {(cond.type === 'has_item' || cond.type === 'not_has_item') && (
            <input
              placeholder="物品名"
              value={cond.item}
              onChange={e => update(idx, { item: e.target.value } as any)}
              style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
            />
          )}

          <button
            onClick={() => remove(idx)}
            style={{
              fontSize: 11,
              padding: '1px 5px',
              background: '#fee2e2',
              color: '#991b1b',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          onClick={() => add('compare')}
          style={{ fontSize: 10, padding: '2px 5px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer' }}
        >
          + 比较
        </button>
        <button
          onClick={() => add('has_item')}
          style={{ fontSize: 10, padding: '2px 5px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer' }}
        >
          + 有物品
        </button>
        <button
          onClick={() => add('not_has_item')}
          style={{ fontSize: 10, padding: '2px 5px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer' }}
        >
          + 无物品
        </button>
      </div>
    </div>
  )
}
