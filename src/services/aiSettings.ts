/**
 * AI 设置：baseUrl / apiKey / model，保存在 localStorage
 * 注意：apiKey 明文存浏览器 localStorage，仅本机本地。生产环境应使用后端代理。
 */

import type { LLMConfig } from './llm'

const STORAGE_KEY = 'story-editor:ai-settings'

// 3 个开箱即用的 preset
export interface ProviderPreset {
  label: string
  emoji: string
  baseUrl: string
  defaultModel: string
  needsApiKey: boolean
  helpUrl?: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: 'OpenAI 官方',
    emoji: '🌐',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsApiKey: true,
    helpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    label: 'DashScope 兼容模式 (Qwen)',
    emoji: '🐝',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    needsApiKey: true,
    helpUrl: 'https://dashscope.console.aliyun.com/apiKey'
  },
  {
    label: '本地 Ollama',
    emoji: '🏠',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    needsApiKey: false,
    helpUrl: 'https://ollama.com/'
  }
]

export interface AISettings extends LLMConfig {
  presetLabel?: string  // 用户当前选的 preset 名字
}

const DEFAULT_SETTINGS: AISettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  presetLabel: 'OpenAI 官方'
}

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.baseUrl !== undefined) return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (e) {
    console.warn('加载 AI 设置失败：', e)
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveAISettings(s: AISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('保存 AI 设置失败：', e)
  }
}

export function isAIConfigured(): boolean {
  const s = loadAISettings()
  return !!(s.baseUrl && s.model)
}
