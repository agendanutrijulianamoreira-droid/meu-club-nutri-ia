'use client'

import { useState } from 'react'
import { X, DollarSign, Shield, Calendar, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase-browser'

interface AddProfessionalModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function AddProfessionalModal({ isOpen, onClose, onSuccess }: AddProfessionalModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        commission_rate: 10,
        is_moderator: false,
        has_agenda: false,
        pix_key: ''
    })

    // supabase importado do singleton

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // 1. Usar server action para criar usuário no Auth
            const response = await fetch('/api/admin/create-professional', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name,
                    commission_rate: formData.commission_rate,
                    is_moderator: formData.is_moderator,
                    has_agenda: formData.has_agenda,
                    pix_key: formData.pix_key || null
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao criar profissional')
            }

            // Sucesso!
            alert('✅ Profissional cadastrado com sucesso!')
            onSuccess()
            onClose()

            // Reset form
            setFormData({
                name: '',
                email: '',
                password: '',
                commission_rate: 10,
                is_moderator: false,
                has_agenda: false,
                pix_key: ''
            })

        } catch (err: any) {
            console.error('Erro:', err)
            setError(err.message || 'Erro ao cadastrar profissional')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-white">Adicionar Profissional</h3>
                        <p className="text-sm text-slate-400 mt-1">Cadastre um novo nutricionista parceiro</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Informações Básicas */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                            Informações Básicas
                        </h4>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Nome Completo *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full h-12 px-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                placeholder="Dra. Maria Silva"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                E-mail *
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full h-12 px-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                placeholder="maria@exemplo.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Senha Inicial *
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full h-12 px-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                placeholder="Mínimo 6 caracteres"
                            />
                            <p className="text-xs text-slate-500 mt-1">O profissional poderá alterar depois</p>
                        </div>
                    </div>

                    {/* Configurações de Comissão */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <DollarSign size={16} />
                            Comissão
                        </h4>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Percentual de Comissão (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={formData.commission_rate}
                                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                                className="w-full h-12 px-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Exemplo: 10 = 10% de comissão sobre cada venda
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Chave PIX (Opcional)
                            </label>
                            <input
                                type="text"
                                value={formData.pix_key}
                                onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                                className="w-full h-12 px-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                placeholder="maria@exemplo.com ou CPF"
                            />
                        </div>
                    </div>

                    {/* Permissões */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                            Permissões e Recursos
                        </h4>

                        <label className="flex items-center gap-3 p-4 bg-slate-950/30 border border-white/10 rounded-xl cursor-pointer hover:border-indigo-500/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.is_moderator}
                                onChange={(e) => setFormData({ ...formData, is_moderator: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-white font-semibold">
                                    <Shield size={16} className="text-indigo-400" />
                                    Moderador da Comunidade
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Permite moderar posts, responder perguntas e gerenciar conteúdo
                                </p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-4 bg-slate-950/30 border border-white/10 rounded-xl cursor-pointer hover:border-pink-500/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.has_agenda}
                                onChange={(e) => setFormData({ ...formData, has_agenda: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-pink-600 focus:ring-pink-500 focus:ring-offset-0"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-white font-semibold">
                                    <Calendar size={16} className="text-pink-400" />
                                    Habilitar Agenda de Consultas
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Permite que pacientes agendem consultas diretamente
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="mr-2 animate-spin" />
                                    Cadastrando...
                                </>
                            ) : (
                                'Cadastrar Profissional'
                            )}
                        </Button>
                    </div>
                </form>
            </GlassCard>
        </div>
    )
}
