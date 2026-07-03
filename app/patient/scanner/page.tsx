"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Camera, Search, Loader2, AlertTriangle, CheckCircle2, XCircle, ScanLine, Flame, Drumstick, Wheat, Droplets } from "lucide-react"
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
        label: "Liberado", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25",
        icon: <CheckCircle2 size={18} className="text-emerald-400" />,
    },
    amarelo: {
        label: "Atenção moderada", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25",
        icon: <AlertTriangle size={18} className="text-amber-400" />,
    },
    vermelho: {
        label: "Evitar", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25",
        icon: <XCircle size={18} className="text-rose-400" />,
    },
}

function MacroBadge({ label, value, unit, color, Icon }: { label: string; value: number | null; unit: string; color: string; Icon: typeof Flame }) {
    return (
        <div className="text-center bg-white/5 border border-white/5 rounded-2xl px-2 py-3">
            <Icon size={13} style={{ color }} className="mx-auto mb-1" />
            <p className="text-sm font-bold text-white leading-none">
                {value != null ? Math.round(value) : "—"}
                <span className="text-[10px] text-slate-500 font-normal">{value != null ? unit : ""}</span>
            </p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
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
        <div className="min-h-screen bg-slate-950 text-white pb-10">
            <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-10">
                <div className="max-w-md mx-auto px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3">
                        <Link href="/patient/home"
                            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                            <ChevronLeft size={20} />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-base font-bold text-white">Scanner de Produtos</h1>
                            <p className="text-[11px] text-slate-500">Avalie embalagens antes de consumir</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
                {scanning && (
                    <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black">
                        <video ref={videoRef} className="w-full aspect-[4/3] object-cover" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <ScanLine size={32} className="text-emerald-400/70 animate-pulse" />
                        </div>
                        <button onClick={pararCamera}
                            className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 text-xs text-white rounded-xl border border-white/20">
                            Cancelar
                        </button>
                    </div>
                )}

                {!scanning && (
                    <button onClick={iniciarCamera}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                        <Camera size={18} />
                        Escanear com a câmera
                    </button>
                )}

                <div className="flex items-center gap-2">
                    <input
                        value={ean}
                        onChange={e => setEan(e.target.value)}
                        placeholder="Ou digite o código de barras"
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500/50"
                    />
                    <button onClick={() => buscarProduto(ean)} disabled={loading || !ean.trim()}
                        className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-300 disabled:opacity-40 hover:bg-white/10 transition-all">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-sm text-rose-400">
                        {error}
                    </div>
                )}

                <AnimatePresence>
                    {resultado && meta && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                {resultado.imagem_url ? (
                                    <img src={resultado.imagem_url} alt={resultado.nome}
                                        className={`w-16 h-16 rounded-2xl object-cover bg-white/5 border-2 ${meta.border}`} />
                                ) : (
                                    <div className={`w-16 h-16 rounded-2xl bg-white/5 border-2 ${meta.border} flex items-center justify-center flex-shrink-0`}>
                                        {meta.icon}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{resultado.nome}</p>
                                    <p className="text-xs text-slate-500 truncate">{resultado.marca}</p>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 border ${meta.bg} ${meta.border}`}>
                                {meta.icon}
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-wider ${meta.color}`}>{meta.label}</p>
                                    <p className="text-xs text-slate-300 mt-0.5">{resultado.avaliacao.mensagem}</p>
                                </div>
                            </div>

                            {resultado.avaliacao.alertas.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ingredientes de atenção</p>
                                    {resultado.avaliacao.alertas.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                            <span className="text-xs text-slate-300 capitalize">{a.termo}</span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${a.risco === 'alto' ? 'bg-rose-500/15 border-rose-500/25 text-rose-400' : 'bg-amber-500/15 border-amber-500/25 text-amber-400'}`}>
                                                {a.risco === 'alto' ? 'Alto risco' : 'Risco médio'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-2">
                                <MacroBadge label="Kcal" value={resultado.dados_nutricionais.energia_kcal} unit="" color="#fb923c" Icon={Flame} />
                                <MacroBadge label="Prot" value={resultado.dados_nutricionais.proteina} unit="g" color="#818cf8" Icon={Drumstick} />
                                <MacroBadge label="Carb" value={resultado.dados_nutricionais.carboidrato} unit="g" color="#fbbf24" Icon={Wheat} />
                                <MacroBadge label="Gord" value={resultado.dados_nutricionais.gordura} unit="g" color="#38bdf8" Icon={Droplets} />
                            </div>

                            <p className="text-[10px] text-slate-600">Valores por 100g/100ml, conforme Open Food Facts.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
