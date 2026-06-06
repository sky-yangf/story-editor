import type { Condition, GameState } from '../types'

/** 求值单个条件 */
export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case 'compare': {
      const actual = state.variables[condition.key]
      if (actual === undefined) return false
      switch (condition.op) {
        case '>=': return Number(actual) >= Number(condition.value)
        case '>':  return Number(actual) > Number(condition.value)
        case '==': return actual === condition.value
        case '<':  return Number(actual) < Number(condition.value)
        case '<=': return Number(actual) <= Number(condition.value)
        case '!=': return actual !== condition.value
      }
      return false
    }
    case 'has_item':
      return state.inventory.includes(condition.item)
    case 'not_has_item':
      return !state.inventory.includes(condition.item)
    case 'and':
      return condition.conditions.every(c => evaluateCondition(c, state))
    case 'or':
      return condition.conditions.some(c => evaluateCondition(c, state))
  }
}
