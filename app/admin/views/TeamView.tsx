'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Calendar, DollarSign, Shield, Trash2, Edit, Copy, TrendingUp, Award } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase-browser'
import { AddProfessionalModal } from '../components/AddProfessionalModal'

interface ProfessionalProfile {
    id: string
    user_id: string
    is_moderator: boolean
    has_agenda: boolean
    commission_rate: number
    referral_code: string
    status: 'active' | 'inactive' | 'pending'
    pix_key: string | null
    total_sales: number
    total_commission_earned: number
    created_at: string
    // Join com profiles
    name?: string
    email?: string
    avatar_url?: string
}

export function TeamView() {
    const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [stats, setStats] = useState({
        totalPaid: 0,
        totalAppointments: 0,
        topReferrer: ''
    })

    // supabase importado do singleton

    useEffect(() => {
        loadProfessionals()
        loadStats()
    }, [])

    const loadProfessionals = async () => {
        try {
            const { data, error } = await supabase
                .from('professional_profiles')
                .select(`
          *,
          profiles!professional_profiles_user_id_fkey (
            name,
            email,
            avatar_url
          )
        `)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Flatten nested profile data
            const formatted = data?.map(prof => ({
                ...prof,
                name: prof.profiles?.name,
                email: prof.profiles?.email,
                avatar_url: prof.profiles?.avatar_url
            }))

            setProfessionals(formatted || [])
        } catch (error) {
            console.error('Erro ao carregar profissionais:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadStats = async () => {
        try {
            // Buscar totais de comissão e vendas
            const { data: salesData } = await supabase
                .from('sales')
                .select('professional_id, commission_amount')
                .eq('commission_paid', true)

            const totalPaid = salesData?.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0) || 0

            // Buscar agendamentos (se existir tabela de appointments)
            // const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true })

            // Top referrer
            const topProf = professionals.sort((a, b) => b.total_sales - a.total_sales)[0]

            setStats({
                totalPaid,
                totalAppointments: 0, // Placeholder
                topReferrer: topProf?.name || 'N/A'
            })
        } catch (error) {
            console.error('Erro ao carregar stats:', error)
        }
    }

    const copyReferralCode = (code: string) => {
        navigator.clipboard.writeText(`/signup?ref=${code}`)
        alert(`Link copiado: /signup?ref=${code}`)
    }

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
        const { error } = await supabase
            .from('professional_profiles')
            .update({ status: newStatus })
            .eq('id', id)

        if (!error) {
            loadProfessionals()
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-slate-400">Carregando equipe...</div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-light text-white mb-2">
                        Gestão de <span className="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Equipe & Parceiros</span>
                    </h2>
                    <p className="text-slate-400">Cadastre nutricionistas, defina comissões e libere agendas.</p>
                </div>
                <Button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-900/40"
                >
                    <Plus size={18} className="mr-2" /> Novo Profissional
                </Button>
            </div>

            {/* Resumo Financeiro da Equipe */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-slate-400 text-sm font-semibold">Total Pago em Comissões</h4>
                        <DollarSign size={20} className="text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalPaid)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Mês atual</p>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-slate-400 text-sm font-semibold">Consultas Agendadas</h4>
                        <Calendar size={20} className="text-blue-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{professionals.length}</p>
                    <p className="text-xs text-slate-500 mt-1">Profissionais ativos</p>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-slate-400 text-sm font-semibold">Top Indicador</h4>
                        <Award size={20} className="text-yellow-400" />
                    </div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        {stats.topReferrer}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Maior vendedor</p>
                </GlassCard>
            </div>

            {/* Lista de Profissionais */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users size={20} className="text-indigo-400" />
                    Profissionais ({professionals.length})
                </h3>

                <div className="grid gap-4">
                    {professionals.map((member) => (
                        <GlassCard
                            key={member.id}
                            className="p-6 flex items-center justify-between group hover:border-indigo-500/30 transition-all"
                        >

                            {/* Info Pessoal */}
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center border-2 border-white/10 shadow-lg">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full" />
                                    ) : (
                                        <span className="font-bold text-white text-lg">
                                            {member.name?.charAt(0) || '?'}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-white font-bold mb-1">{member.name || 'Sem nome'}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded border ${member.status === 'active'
                                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20'
                                        : 'text-slate-500 bg-slate-800 border-slate-700'
                                        }`}>
                                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <p className="text-xs text-slate-500 mt-1">{member.email}</p>
                                </div>
                            </div>

                            {/* Métricas e Configs */}
                            <div className="flex items-center gap-8">

                                {/* Comissão */}
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase mb-1">Comissão</p>
                                    <div className="flex items-center gap-1 text-white font-mono text-lg">
                                        <DollarSign size={16} className="text-emerald-400" />
                                        {member.commission_rate}%
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{member.total_sales} vendas</p>
                                    <p className="text-xs text-emerald-400 font-semibold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(member.total_commission_earned)}
                                    </p>
                                </div>

                                {/* Código de Referral */}
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase mb-1">Código</p>
                                    <button
                                        onClick={() => copyReferralCode(member.referral_code)}
                                        className="flex items-center gap-1 text-indigo-400 font-mono text-sm bg-indigo-400/10 px-3 py-1 rounded border border-indigo-500/20 hover:bg-indigo-400/20 transition-all"
                                    >
                                        {member.referral_code}
                                        <Copy size={12} />
                                    </button>
                                </div>

                                {/* Status/Permissões */}
                                <div className="flex gap-2">
                                    <div
                                        title="Moderador"
                                        className={`p-2 rounded-lg border ${member.is_moderator
                                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-600'
                                            }`}
                                    >
                                        <Shield size={18} />
                                    </div>
                                    <div
                                        title="Agenda Aberta"
                                        className={`p-2 rounded-lg border ${member.has_agenda
                                            ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-600'
                                            }`}
                                    >
                                        <Calendar size={18} />
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleStatus(member.id, member.status)}
                                        className="p-2 text-slate-500 hover:text-blue-400 transition"
                                        title="Editar"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        className="p-2 text-slate-500 hover:text-red-400 transition"
                                        title="Remover"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                        </GlassCard>
                    ))}

                    {professionals.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <Users size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhum profissional cadastrado ainda.</p>
                            <p className="text-sm">Clique em "+ Novo Profissional" para começar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Adicionar (placeholder) */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <GlassCard className="max-w-xl w-full p-8">
                        <h3 className="text-2xl font-bold text-white mb-6">Adicionar Profissional</h3>
                        <p className="text-slate-400 mb-4">Funcionalidade em implementação...</p>
                        <Button onClick={() => setIsAddModalOpen(false)}>Fechar</Button>
                    </GlassCard>
                </div>
            )}

        </div>
    )
}
