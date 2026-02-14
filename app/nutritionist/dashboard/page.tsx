'use client'

import { DollarSign, TrendingUp, Users, Calendar, Copy, Share2, QrCode } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { useProfessionalProfile } from '@/lib/hooks/useProfessionalProfile'
import { useCommissions } from '@/lib/hooks/useCommissions'
import { useLinkedPatients } from '@/lib/hooks/useLinkedPatients'

export default function NutritionistDashboard() {
    const { profile, loading: profileLoading } = useProfessionalProfile()
    const { summary, commissions, loading: commissionsLoading } = useCommissions(profile?.user_id)
    const { patients, loading: patientsLoading } = useLinkedPatients(profile?.user_id)

    const copyReferralCode = () => {
        if (!profile?.referral_code) return
        const link = `${window.location.origin}/signup?ref=${profile.referral_code}`
        navigator.clipboard.writeText(link)
        alert('🎉 Link de indicação copiado!')
    }

    if (profileLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-slate-400">Carregando...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight uppercase mb-2">
                            Meu Painel <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Nutri</span>
                        </h1>
                        <p className="text-slate-400">
                            Bem-vinda, <span className="text-white font-semibold">{profile?.name}</span>! 👋
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                            <span className="px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
                                {profile?.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                    {/* Total Recebido */}
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Recebido (Total)
                            </h4>
                            <div className="h-12 w-12 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                                <DollarSign size={24} className="text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.paid)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Comissões pagas</p>
                    </GlassCard>

                    {/* Pendente */}
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Pendente
                            </h4>
                            <div className="h-12 w-12 rounded-xl bg-amber-600/20 flex items-center justify-center">
                                <TrendingUp size={24} className="text-amber-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-amber-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.pending)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">A receber</p>
                    </GlassCard>

                    {/* Vendas Mês */}
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Vendas (Mês)
                            </h4>
                            <div className="h-12 w-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                                <Calendar size={24} className="text-purple-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-purple-400">
                            {summary.current_month_sales}
                        </p>
                        <p className="text-xs text-emerald-400 mt-1 font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.current_month_earned)}
                        </p>
                    </GlassCard>

                    {/* Pacientes */}
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Pacientes
                            </h4>
                            <div className="h-12 w-12 rounded-xl bg-pink-600/20 flex items-center justify-center">
                                <Users size={24} className="text-pink-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-pink-400">
                            {patients.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Vinculadas</p>
                    </GlassCard>

                </div>

                {/* Código de Referral */}
                <GlassCard className="p-8">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Share2 size={20} className="text-purple-400" />
                                Meu Código de Indicação
                            </h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Compartilhe este código para ganhar comissões em cada venda!
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-950/50 border border-purple-500/30">
                                    <span className="text-2xl font-mono font-black text-purple-400">
                                        {profile?.referral_code}
                                    </span>
                                </div>
                                <Button
                                    onClick={copyReferralCode}
                                    className="bg-purple-600 hover:bg-purple-500 h-12 px-6"
                                >
                                    <Copy size={18} className="mr-2" />
                                    Copiar Link
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 px-6 border-purple-500/30 hover:bg-purple-600/20"
                                >
                                    <QrCode size={18} className="mr-2" />
                                    QR Code
                                </Button>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Grid de 2 colunas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Últimas Vendas */}
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <DollarSign size={20} className="text-emerald-400" />
                            Últimas Vendas
                        </h3>
                        <div className="space-y-3">
                            {commissionsLoading ? (
                                <p className="text-slate-500 text-center py-8">Carregando...</p>
                            ) : commissions.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">Nenhuma venda ainda</p>
                            ) : (
                                commissions.slice(0, 5).map((sale) => (
                                    <div
                                        key={sale.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-slate-950/30 border border-white/5 hover:border-purple-500/30 transition-all"
                                    >
                                        <div>
                                            <p className="text-white font-semibold">{sale.patient_name || 'Sem nome'}</p>
                                            <p className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-bold">
                                                +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.commission_amount)}
                                            </p>
                                            <span className={`text-xs px-2 py-0.5 rounded ${sale.commission_paid
                                                    ? 'bg-emerald-600/20 text-emerald-400'
                                                    : 'bg-amber-600/20 text-amber-400'
                                                }`}>
                                                {sale.commission_paid ? 'Pago' : 'Pendente'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>

                    {/* Pacientes Recentes */}
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Users size={20} className="text-pink-400" />
                            Pacientes Recentes
                        </h3>
                        <div className="space-y-3">
                            {patientsLoading ? (
                                <p className="text-slate-500 text-center py-8">Carregando...</p>
                            ) : patients.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">Nenhuma paciente ainda</p>
                            ) : (
                                patients.slice(0, 5).map((patient) => (
                                    <div
                                        key={patient.user_id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-slate-950/30 border border-white/5 hover:border-pink-500/30 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                                {patient.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold">{patient.name}</p>
                                                <p className="text-xs text-slate-500">{patient.email}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500 uppercase">{patient.plan_type}</p>
                                            <p className="text-xs text-emerald-400 font-semibold">
                                                +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(patient.commission_generated)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>

                </div>

            </div>
        </div>
    )
}
