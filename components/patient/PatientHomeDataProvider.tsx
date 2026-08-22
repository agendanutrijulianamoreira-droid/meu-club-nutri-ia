"use client"

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"

type PatientHomeContextValue = {
  payload: any | null
  loading: boolean
  error: string | null
  localDate: string
  refresh: () => Promise<void>
}

const PatientHomeDataContext = createContext<PatientHomeContextValue | null>(null)

function getLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function PatientHomeDataProvider({ children }: { children: ReactNode }) {
  const localDate = useMemo(() => getLocalDate(), [])
  const [payload, setPayload] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(`/api/patient/home?date=${localDate}`, { cache: "no-store" })
      if (!response.ok) throw new Error(`Falha ao carregar Home (${response.status})`)
      setPayload(await response.json())
    } catch (err) {
      console.error("Erro ao carregar dados agregados da Home:", err)
      setError(err instanceof Error ? err.message : "Falha ao carregar Home")
    } finally {
      setLoading(false)
    }
  }, [localDate])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ payload, loading, error, localDate, refresh }), [payload, loading, error, localDate, refresh])

  return <PatientHomeDataContext.Provider value={value}>{children}</PatientHomeDataContext.Provider>
}

export function usePatientHomeData() {
  const context = useContext(PatientHomeDataContext)
  if (!context) throw new Error("usePatientHomeData deve ser usado dentro de PatientHomeDataProvider")
  return context
}
