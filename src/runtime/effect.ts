import type { Effect, GameState, StateValue } from '../types'

/** 执行一个效果，返回新状态 */
export function applyEffect(effect: Effect, state: GameState): GameState {
  switch (effect.type) {
    case 'set': {
      return {
        ...state,
        variables: { ...state.variables, [effect.key]: effect.value as StateValue }
      }
    }
    case 'add': {
      const current = Number(state.variables[effect.key] ?? 0)
      return {
        ...state,
        variables: { ...state.variables, [effect.key]: (current + effect.value) as StateValue }
      }
    }
    case 'add_item': {
      if (state.inventory.includes(effect.item)) return state
      return { ...state, inventory: [...state.inventory, effect.item] }
    }
    case 'remove_item': {
      return { ...state, inventory: state.inventory.filter(i => i !== effect.item) }
    }
  }
}

/** 批量执行效果 */
export function applyEffects(effects: Effect[], state: GameState): GameState {
  return effects.reduce((s, e) => applyEffect(e, s), state)
}
