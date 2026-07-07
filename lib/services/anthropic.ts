// ─── Shared AI helper for Next.js API routes ───────────────────────────────
// Migrado para Google Gemini 2.5 Flash (free tier)
// Mantém mesmas assinaturas: callClaude, callClaudeJSON, streamClaude
// Usage: import { callClaude, callClaudeJSON, streamClaude } from '@/lib/services/anthropic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL = 'gemini-2.5-flash'
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

// Gemini free tier ocasionalmente responde 503 (sobrecarga) ou 429 (rate limit) —
// erros transitórios que se resolvem sozinhos em segundos. Tenta de novo com backoff
// antes de propagar o erro pro chamador.
const RETRYABLE_STATUS = new Set([429, 503])

async function fetchGeminiWithRetry(url: string, body: unknown, attempts = 3): Promise<any> {
  let lastError: Error = new Error('Gemini: falha desconhecida')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res.json()

    const err = await res.json().catch(() => ({ error: 'Unknown' }))
    lastError = new Error(`Gemini error ${res.status}: ${JSON.stringify(err)}`)
    if (!RETRYABLE_STATUS.has(res.status) || attempt === attempts) throw lastError

    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

export async function callClaude(opts: ClaudeOptions): Promise<string> {
  const data = await fetchGeminiWithRetry(`${API_URL}:generateContent?key=${GEMINI_API_KEY}`, {
    contents: toGeminiMessages(opts.messages),
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: { maxOutputTokens: opts.maxTokens || 1000 },
  })
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function callClaudeJSON<T = any>(opts: ClaudeOptions): Promise<T> {
  const data = await fetchGeminiWithRetry(`${API_URL}:generateContent?key=${GEMINI_API_KEY}`, {
    contents: toGeminiMessages(opts.messages),
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: { maxOutputTokens: opts.maxTokens || 1000, responseMimeType: 'application/json' },
  })
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Robust JSON extraction: handles markdown fences, leading/trailing junk,
  // and common Gemini quirks (unescaped newlines, trailing commas).
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  // If the response has junk before/after, extract the outermost {...} or [...]
  const firstBrace = cleaned.search(/[{[]/)
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace)
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1)

  try {
    return JSON.parse(cleaned)
  } catch (firstErr: any) {
    // Second pass: strip trailing commas and retry
    const patched = cleaned
      .replace(/,(\s*[}\]])/g, '$1')         // trailing commas
      .replace(/[\u0000-\u001F]+/g, ' ')      // control chars including raw newlines in strings
    try {
      return JSON.parse(patched)
    } catch (secondErr: any) {
      // Third pass: truncation recovery
      // If Gemini got cut off mid-array/object, try to close unterminated structures
      try {
        const recovered = recoverTruncatedJSON(patched)
        return JSON.parse(recovered)
      } catch (thirdErr: any) {
        console.error('[callClaudeJSON] Failed to parse Gemini response:')
        console.error('Length:', text.length)
        console.error('Raw text start:', text.slice(0, 300))
        console.error('Raw text end:', text.slice(-300))
        console.error('First parse error:', firstErr.message)
        throw new Error(`Gemini returned invalid JSON: ${firstErr.message}`)
      }
    }
  }
}

/**
 * Best-effort recovery for JSON truncated mid-structure.
 * Walks the string, tracks open brackets/braces/strings, and closes them.
 */
function recoverTruncatedJSON(s: string): string {
  const stack: string[] = []
  let inString = false
  let escape = false
  let lastGoodEnd = -1

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{' || c === '[') stack.push(c)
    else if (c === '}') { if (stack[stack.length - 1] === '{') stack.pop() }
    else if (c === ']') { if (stack[stack.length - 1] === '[') stack.pop() }
    if (stack.length === 0) lastGoodEnd = i
  }

  // If still inside a string, close it
  let result = s
  if (inString) {
    // Drop incomplete string: cut at last quoted value
    const lastComma = result.lastIndexOf(',')
    const lastOpenBracket = Math.max(result.lastIndexOf('['), result.lastIndexOf('{'))
    const cutAt = Math.max(lastComma, lastOpenBracket)
    if (cutAt > 0) result = result.slice(0, cutAt)
    // Recompute stack after cut
    return recoverTruncatedJSON(result)
  }

  // Remove any trailing partial content after last complete value
  // Find last complete element by walking back to nearest closing bracket
  const lastClose = Math.max(result.lastIndexOf('}'), result.lastIndexOf(']'))
  if (lastClose >= 0 && lastClose < result.length - 1) {
    // Trim trailing junk but keep structure up to lastClose
    const trailing = result.slice(lastClose + 1).trim()
    if (trailing && !trailing.match(/^[\]}]*$/)) {
      result = result.slice(0, lastClose + 1)
    }
  }

  // Strip trailing commas
  result = result.replace(/,(\s*)$/g, '$1')

  // Close unclosed brackets in reverse order
  while (stack.length > 0) {
    const open = stack.pop()
    result += open === '{' ? '}' : ']'
  }

  return result
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

const IMAGE_MODEL = 'gemini-2.5-flash-image'
const IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`

/**
 * Gera uma foto de comida via IA (Gemini nano-banana). Retorna base64 + mimeType,
 * ou null se a geração falhar (chamador deve tratar como opcional/best-effort).
 */
export async function generateFoodImage(prompt: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(`${IMAGE_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!res.ok) {
      console.error('[generateFoodImage] Gemini error', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p.inlineData?.data)
    if (!imagePart) return null
    return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png' }
  } catch (err) {
    console.error('[generateFoodImage] Erro:', err)
    return null
  }
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
