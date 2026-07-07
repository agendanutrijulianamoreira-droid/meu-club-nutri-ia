"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, Loader2 } from "lucide-react"

const CAPTURA_STORAGE_KEY = "diarioFotoCaptura"

function CapturarRefeicaoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refeicao = searchParams.get("refeicao") || "almoco"

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => setErro("Não foi possível acessar a câmera. Verifique as permissões."))

    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const voltar = useCallback(() => {
    router.back()
  }, [router])

  const digitar = useCallback(() => {
    router.push(`/patient/diario/adicionar?refeicao=${refeicao}`)
  }, [router, refeicao])

  const escanearCodigoBarras = useCallback(() => {
    router.push("/patient/scanner")
  }, [router])

  const analisarFrame = useCallback(async (base64: string) => {
    setAnalisando(true)
    setErro(null)
    try {
      const res = await fetch("/api/patient/foto-refeicao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === "PLAN_UPGRADE_REQUIRED") {
          setErro("Avaliação de pratos por IA é exclusiva do plano VIP")
        } else {
          setErro(data.error || "Erro ao analisar a foto")
        }
        return
      }
      if (!data.alimentos || data.alimentos.length === 0) {
        setErro("Nenhum alimento identificado. Tente novamente com mais luz.")
        return
      }
      sessionStorage.setItem(CAPTURA_STORAGE_KEY, JSON.stringify({
        foto_base64: base64,
        alimentos: data.alimentos,
        insights: data.insights ?? [],
      }))
      router.replace(`/patient/diario/resultado?refeicao=${refeicao}`)
    } catch {
      setErro("Não foi possível analisar a foto agora")
    } finally {
      setAnalisando(false)
    }
  }, [router, refeicao])

  const capturar = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    setCapturedFrame(dataUrl)
    analisarFrame(dataUrl)
  }, [analisarFrame])

  const tentarNovamente = useCallback(() => {
    setCapturedFrame(null)
    setErro(null)
  }, [])

  return (
    <div className="fixed inset-0 bg-black">
      {/* Câmera em tela cheia */}
      {capturedFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capturedFrame} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay sutil apenas nas margens superior e inferior */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

      {/* Topo: fechar + título */}
      <div className="absolute top-0 inset-x-0 pt-[max(1.25rem,env(safe-area-inset-top))] px-5 flex items-center justify-center">
        <button
          onClick={voltar}
          className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] text-white/80 hover:text-white transition-colors"
        >
          <X size={22} strokeWidth={1.5} />
        </button>
        <p className="font-serif text-white text-xl">Capture sua refeição</p>
      </div>

      {/* Estado de análise */}
      {analisando && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
          <Loader2 size={28} className="text-white animate-spin" />
          <p className="text-white text-sm font-sans">Analisando refeição...</p>
        </div>
      )}

      {/* Erro */}
      {erro && !analisando && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center space-y-4">
          <p className="text-white text-sm font-sans">{erro}</p>
          <button
            onClick={tentarNovamente}
            className="px-5 py-2 rounded-full border border-white/60 text-white text-sm font-sans"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Base: obturador + atalhos */}
      {!analisando && !erro && (
        <div className="absolute bottom-0 inset-x-0 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-6">
          <button
            onClick={capturar}
            aria-label="Capturar foto"
            className="w-[72px] h-[72px] rounded-full border-4 border-white active:scale-95 transition-transform"
          />
          <div className="flex items-center gap-8">
            <button onClick={escanearCodigoBarras} className="text-white/85 text-sm font-sans hover:text-white transition-colors">
              Escanear código de barras
            </button>
            <button onClick={digitar} className="text-white/85 text-sm font-sans hover:text-white transition-colors">
              Digitar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CapturarRefeicaoPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <CapturarRefeicaoInner />
    </Suspense>
  )
}
