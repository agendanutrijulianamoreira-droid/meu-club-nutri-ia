// ─── Shared Anthropic Claude helper for Next.js API routes ─────────────────
// Usage: import { callClaude, streamClaude } from '@/lib/services/anthropic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-20250514'
const API_URL = 'https://api.anthropic.com/v1/messages'

interface ClaudeOptions {
  system?: string
  maxTokens?: number
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

/**
 * Non-streaming Claude call. Returns parsed text.
 */
export async function callClaude(opts: ClaudeOptions): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens || 1000,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }))
    throw new Error(`Anthropic error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

/**
 * Non-streaming Claude call that returns parsed JSON.
 */
export async function callClaudeJSON<T = any>(opts: ClaudeOptions): Promise<T> {
  const text = await callClaude(opts)
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(clean)
}

/**
 * Streaming Claude call. Returns a ReadableStream of text chunks.
 * Compatible with Next.js streaming responses.
 */
export function streamClaude(opts: ClaudeOptions): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: opts.maxTokens || 1000,
            stream: true,
            ...(opts.system ? { system: opts.system } : {}),
            messages: opts.messages,
          }),
        })

        if (!res.ok || !res.body) {
          throw new Error(`Anthropic streaming error: ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6)
              if (jsonStr === '[DONE]') continue
              try {
                const event = JSON.parse(jsonStr)
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  controller.enqueue(encoder.encode(event.delta.text))
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n\n[Erro: ${err.message}]`))
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Fire-and-forget trigger to orchestrator Edge Function.
 */
export function triggerOrchestrator(type: string, tenantId: string, userId?: string, payload?: any) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-orchestrator`
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ type, tenant_id: tenantId, user_id: userId, payload }),
  }).catch(err => console.error('[triggerOrchestrator]', err))
}
