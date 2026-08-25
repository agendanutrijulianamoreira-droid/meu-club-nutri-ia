'use client'

import { useState } from 'react'

export function IntegrationTestButton({ provider, disabled = false }: { provider: string; disabled?: boolean }) {
  const [state, setState] = useState<'idle'|'loading'|'ok'|'error'>('idle')
  const [message, setMessage] = useState('')

  const run = async () => {
    setState('loading')
    setMessage('')
    try {
      const r = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const b = await r.json().catch(() => ({}))
      setState(r.ok ? 'ok' : 'error')
      setMessage(b.detail || b.error || (r.ok ? 'Conexão validada' : 'Falha na validação'))
    } catch (e) {
      setState('error')
      setMessage('Não foi possível executar o teste agora.')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={disabled || state === 'loading'}
        className="rounded-xl border border-[#B8DED5] bg-white px-3 py-2 text-xs font-black text-[#0D7166] hover:bg-[#E2F3EF] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {state === 'loading' ? 'Testando…' : 'Testar conexão'}
      </button>
      {message && (
        <p className={`max-w-[230px] text-right text-[10px] font-bold leading-relaxed ${state === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
