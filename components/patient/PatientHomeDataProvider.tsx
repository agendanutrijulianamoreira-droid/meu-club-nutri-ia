"use client"

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"

type PatientHomeContextValue = {
  payload: any | null
  loading: boolean
  error: string | null
  localDate: string
  readOnly: boolean
  refresh: () => Promise<void>
}

type PatientHomeDataProviderProps = {
  children: ReactNode
  initialPayload?: any | null
  staticPayload?: boolean
  readOnly?: boolean
}

const PatientHomeDataContext = createContext<PatientHomeContextValue | null>(null)

function getLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function PatientHomeDataProvider({
  children,
  initialPayload = null,
  staticPayload = false,
  readOnly = false,
}: PatientHomeDataProviderProps) {
  const [localDate, setLocalDate] = useState<string>(() => initialPayload?.today || getLocalDate())
  const [payload, setPayload] = useState<any | null>(initialPayload)
  const [loading, setLoading] = useState(!initialPayload && !staticPayload)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (staticPayload) {
      setPayload(initialPayload)
      if (initialPayload?.today) setLocalDate(String(initialPayload.today))
      setLoading(false)
      setError(null)
    }
  }, [initialPayload, staticPayload])

  useEffect(() => {
    if (staticPayload) return

    const syncDate = () => {
      const nextDate = getLocalDate()
      setLocalDate((current: string) => current === nextDate ? current : nextDate)
    }

    syncDate()
    const intervalId = window.setInterval(syncDate, 60_000)
    return () => window.clearInterval(intervalId)
  }, [staticPayload])

  const refresh = useCallback(async () => {
    if (staticPayload) return

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
  }, [localDate, staticPayload])

  useEffect(() => {
    if (!staticPayload) refresh()
  }, [refresh, staticPayload])

  const value = useMemo(
    () => ({ payload, loading, error, localDate, readOnly, refresh }),
    [payload, loading, error, localDate, readOnly, refresh],
  )

  const content = readOnly ? (
    <div
      onClickCapture={event => { event.preventDefault(); event.stopPropagation() }}
      onSubmitCapture={event => { event.preventDefault(); event.stopPropagation() }}
      onKeyDownCapture={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      {children}
    </div>
  ) : children

  return <PatientHomeDataContext.Provider value={value}>{content}</PatientHomeDataContext.Provider>
}

export function usePatientHomeData() {
  const context = useContext(PatientHomeDataContext)
  if (!context) throw new Error("usePatientHomeData deve ser usado dentro de PatientHomeDataProvider")
  return context
}
