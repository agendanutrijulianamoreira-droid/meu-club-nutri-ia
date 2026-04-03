// ─── Shared AI helper for Next.js API routes ───────────────────────────────
// Migrado para Google Gemini 2.5 Flash (free tier)
// Mantém mesmas assinaturas: callClaude, callClaudeJSON, streamClaude
// Usage: import { callClaude, callClaudeJSON, streamClaude } from '@/lib/services/anthropic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL = 'gemini-2.5-flash-preview-05-20'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`

interface ClaudeOptions {
  system?: string
  maxTokens?: number
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

function toGeminiMessages(messages: ClaudeOptions['messages']) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

export async function callClaude(opts: ClaudeOptions): Promise<string> {
  const res = await fetch(`${API_URL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: toGeminiMessages(opts.messages),
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      generationConfig: { maxOutputTokens: opts.maxTokens || 1000 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }))
    throw new Error(`Gemini error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function callClaudeJSON<T = any>(opts: ClaudeOptions): Promise<T> {
  const res = await fetch(`${API_URL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: toGeminiMessages(opts.messages),
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      generationConfig: { maxOutputTokens: opts.maxTokens || 1000, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }))
    throw new Error(`Gemini error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())
}

export function streamClaude(opts: ClaudeOptions): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const res = await fetch(`${API_URL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: toGeminiMessages(opts.messages),
            ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
            generationConfig: { maxOutputTokens: opts.maxTokens || 1000 },
          }),
        })
        if (!res.ok || !res.body) throw new Error(`Gemini stream error: ${res.status}`)
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
              try {
                const evt = JSON.parse(line.slice(6))
                const t = evt.candidates?.[0]?.content?.parts?.[0]?.text
                if (t) controller.enqueue(encoder.encode(t))
              } catch {}
            }
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n\n[Erro: ${err.message}]`))
      } finally { controller.close() }
    },
  })
}

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
