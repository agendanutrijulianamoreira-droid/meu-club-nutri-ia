"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Camera, Search, Loader2, AlertTriangle, CheckCircle2, XCircle, ScanLine } from "lucide-react"
import Link from "next/link"

interface AlertaIngrediente {
    categoria: string
    risco: 'alto' | 'medio'
    termo: string
}

interface Avaliacao {
    semaforo: 'verde' | 'amarelo' | 'vermelho'
    alertas: AlertaIngrediente[]
    mensagem: string
}

interface ResultadoProduto {
    ean: string
    nome: string
    marca: string
    ingredientes: string
    dados_nutricionais: {
        energia_kcal: number | null
        proteina: number | null
        carboidrato: number | null
        gordura: number | null
        sodio: number | null
        fibra: number | null
        acucares: number | null
        nutriscore: string | null
    }
    imagem_url: string | null
    avaliacao: Avaliacao
}

const SEMAFORO_META: Record<string, { label: string; color: string; bg: string; border: string; icon: JSX.Element }> = {
    verde: {
        label: "Liberado", color: "text-sage-700", bg: "bg-sage-50", border: "border-sage-200/70",
        icon: <CheckCircle2 size={18} className="text-sage-600" />,
    },
    amarelo: {
        label: "Atenção moderada", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200/70",
        icon: <AlertTriangle size={18} className="text-amber-500" />,
    },
    vermelho: {
        label: "Evitar", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200/70",
        icon: <XCircle size={18} className="text-rose-500" />,
    },
}

function MacroBadge({ label, value, unit }: { label: string; value: number | null; unit: string }) {
    return (
        <div className="text-center bg-sand-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-bold text-stone-800">
                {value != null ? Math.round(value) : "—"}
                <span className="text-[10px] text-stone-400 font-normal">{value != null ? unit : ""}</span>
            </p>
        </div>
    )
}

export default function ScannerPage() {
    const [ean, setEan] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultado, setResultado] = useState<ResultadoProduto | null>(null)
    const [scanning, setScanning] = useState(false)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const buscarProduto = useCallback(async (codigo: string) => {
        const codigoLimpo = codigo.trim()
        if (!codigoLimpo) return
        setLoading(true)
        setError(null)
        setResultado(null)
        try {
            const res = await fetch(`/api/patient/scanner?ean=${encodeURIComponent(codigoLimpo)}`)
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Erro ao buscar produto")
                return
            }
            setResultado(data)
        } catch {
            setError("Não foi possível consultar o produto agora")
        } finally {
            setLoading(false)
        }
    }, [])

    const pararCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setScanning(false)
    }, [])

    const iniciarCamera = useCallback(async () => {
        if (!("BarcodeDetector" in window)) {
            setError("Seu navegador não suporta leitura de código de barras pela câmera. Digite o código manualmente.")
            return
        }
        try {
            setError(null)
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
            setScanning(true)

            // @ts-expect-error BarcodeDetector ainda não está no lib.dom.d.ts
            const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] })

            const loop = async () => {
                if (!streamRef.current || !videoRef.current) return
                try {
                    const codes = await detector.detect(videoRef.current)
                    if (codes.length > 0) {
                        const valor = codes[0].rawValue
                        pararCamera()
                        setEan(valor)
                        buscarProduto(valor)
                        return
                    }
                } catch {
                    // frame inválido, continua tentando
                }
                if (streamRef.current) requestAnimationFrame(loop)
            }
            requestAnimationFrame(loop)
        } catch {
            setError("Não foi possível acessar a câmera. Verifique as permissões.")
        }
    }, [buscarProduto, pararCamera])

    useEffect(() => () => pararCamera(), [pararCamera])

    const meta = resultado ? SEMAFORO_META[resultado.avaliacao.semaforo] : null

    return (
        <div className="min-h-screen bg-sand-50 pb-10">
            <div className="sticky top-0 bg-sand-50/90 backdrop-blur-xl border-b border-sage-900/[0.05] z-10">
                <div className="max-w-md mx-auto px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3">
                        <Link href="/patient/home"
                            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-white transition-all">
                            <ChevronLeft size={20} />
                        </Link>
                        <div className="flex-1">
                            <h1 className="font-display text-base font-medium text-stone-800">Scanner de Produtos</h1>
                            <p className="text-[11px] text-stone-500">Avalie embalagens antes de consumir</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
                {scanning && (
                    <div className="relative rounded-3xl overflow-hidden border border-sage-900/[0.06] bg-black">
                        <video ref={videoRef} className="w-full aspect-[4/3] object-cover" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <ScanLine size={32} className="text-sage-300/80 animate-pulse" />
                        </div>
                        <button onClick={pararCamera}
                            className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 text-xs text-white rounded-xl border border-white/20">
                            Cancelar
                        </button>
                    </div>
                )}

                {!scanning && (
                    <button onClick={iniciarCamera}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-2xl transition-all">
                        <Camera size={18} />
                        Escanear com a câmera
                    </button>
                )}

                <div className="flex items-center gap-2">
                    <input
                        value={ean}
                        onChange={e => setEan(e.target.value)}
                        placeholder="Ou digite o código de barras"
                        className="flex-1 bg-white border border-sage-900/[0.08] rounded-2xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-sage-400/60"
                    />
                    <button onClick={() => buscarProduto(ean)} disabled={loading || !ean.trim()}
                        className="p-3 bg-white border border-sage-900/[0.08] rounded-2xl text-stone-500 disabled:opacity-40 hover:bg-sand-100 transition-all">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200/70 rounded-2xl p-4 text-sm text-rose-600">
                        {error}
                    </div>
                )}

                <AnimatePresence>
                    {resultado && meta && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-[2rem] p-5 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                {resultado.imagem_url && (
                                    <img src={resultado.imagem_url} alt={resultado.nome}
                                        className="w-14 h-14 rounded-xl object-cover bg-sand-100" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-stone-800 truncate">{resultado.nome}</p>
                                    <p className="text-xs text-stone-400 truncate">{resultado.marca}</p>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 border ${meta.bg} ${meta.border}`}>
                                {meta.icon}
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</p>
                                    <p className="text-xs text-stone-600 mt-0.5">{resultado.avaliacao.mensagem}</p>
                                </div>
                            </div>

                            {resultado.avaliacao.alertas.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Ingredientes de atenção</p>
                                    {resultado.avaliacao.alertas.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between bg-sand-50 rounded-xl px-3 py-2">
                                            <span className="text-xs text-stone-700 capitalize">{a.termo}</span>
                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${a.risco === 'alto' ? 'bg-rose-50 border-rose-200/70 text-rose-600' : 'bg-amber-50 border-amber-200/70 text-amber-600'}`}>
                                                {a.risco === 'alto' ? 'Alto risco' : 'Risco médio'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-2">
                                <MacroBadge label="Kcal" value={resultado.dados_nutricionais.energia_kcal} unit="" />
                                <MacroBadge label="Prot" value={resultado.dados_nutricionais.proteina} unit="g" />
                                <MacroBadge label="Carb" value={resultado.dados_nutricionais.carboidrato} unit="g" />
                                <MacroBadge label="Gord" value={resultado.dados_nutricionais.gordura} unit="g" />
                            </div>

                            <p className="text-[10px] text-stone-400">Valores por 100g/100ml, conforme Open Food Facts.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
