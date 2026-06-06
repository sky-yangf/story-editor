/**
 * OpenAI 兼容 chat completion 客户端
 * 支持任何兼容 OpenAI Chat Completions API 的服务：
 * - OpenAI 官方
 * - DashScope 兼容模式 (https://dashscope.aliyuncs.com/compatible-mode/v1)
 * - 本地 Ollama / vLLM / LM Studio
 * - Azure OpenAI
 */

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  /** 如果设为 true，请求中带 response_format: { type: 'json_object' }（OpenAI JSON mode） */
  jsonMode?: boolean
}

export interface ChatResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  model?: string
}

/**
 * 发请求。非流式。返回第一段 choice 完整内容。
 * 错误抛 Error：包含 HTTP 状态码 + 响应体（截断 500 字）
 */
export async function chatCompletion(
  cfg: LLMConfig,
  req: ChatRequest
): Promise<ChatResponse> {
  if (!cfg.baseUrl) throw new Error('baseUrl 未设置')
  if (!cfg.model) throw new Error('model 未设置')
  // apiKey 对 Ollama 等本地服务可能为空
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const body: any = {
    model: cfg.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
    stream: false
  }
  if (req.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(
      `LLM API 错误 (HTTP ${resp.status}): ${text.substring(0, 500)}`
    )
  }

  const data = await resp.json()
  const choice = data.choices?.[0]
  if (!choice) throw new Error('LLM 返回无 choices 字段')
  const content = choice.message?.content
  if (typeof content !== 'string') {
    throw new Error('LLM 返回 content 不是字符串')
  }
  return {
    content,
    usage: data.usage,
    model: data.model
  }
}

/**
 * 让 LLM 输出 JSON 字符串，并容错地提取 JSON 块
 * 常见 LLM 错误：
 * - 包裹在 ```json ... ``` markdown fence 里
 * - 前面有 "Here's the JSON:" 等说明文字
 * - 后面有额外解释
 * 这个函数尝试从 content 中提取第一个完整的 { ... } 块
 */
export function extractJson<T = any>(content: string): T {
  // 1. 优先尝试直接 parse
  try {
    return JSON.parse(content)
  } catch {}

  // 2. 找 ```json ... ``` 块
  const fenceMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1])
    } catch {}
  }

  // 3. 找最外层 { ... } 块
  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = content.substring(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(candidate)
    } catch (e) {
      throw new Error(`无法解析 LLM 输出为 JSON：${(e as Error).message}\n\n原始内容：\n${content.substring(0, 500)}...`)
    }
  }

  throw new Error(`LLM 输出无 JSON 对象：\n${content.substring(0, 500)}...`)
}
