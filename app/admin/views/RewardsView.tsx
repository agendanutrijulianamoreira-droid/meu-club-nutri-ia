"use client"

import { useState } from "react"
import {
    Gift,
    Clock,
    CheckCircle,
    Plus,
    Trash2,
    Edit3,
    Search,
    Package,
    Tag,
    Sparkles,
    Loader2,
    X,
    Diamond,
    Crown,
    Star,
    ShoppingBag,
    Truck,
    Download,
    Percent,
    Award
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface Reward {
    id: string
    name: string
    description: string
    cost: number
    type: 'digital' | 'fisico' | 'cupom' | 'experiencia'
    image: string
    stock?: number
    active: boolean
}

interface Order {
    id: string
    userId: string
    userName: string
    userAvatar: string
    rewardId: string
    rewardName: string
    rewardCost: number
    date: string
    status: 'pending' | 'processing' | 'completed' | 'cancelled'
    notes?: string
}

// Mock Data
const MOCK_REWARDS: Reward[] = [
    { id: '1', name: 'E-book Receitas Secretas', description: '50 receitas fit exclusivas', cost: 500, type: 'digital', image: '📘', active: true },
    { id: '2', name: 'Desconto 10% Renovação', description: 'Cupom para próxima assinatura', cost: 1000, type: 'cupom', image: '🏷️', active: true },
    { id: '3', name: 'Caneca Exclusiva', description: 'Caneca personalizada Reino', cost: 2500, type: 'fisico', image: '☕', stock: 50, active: true },
    { id: '4', name: 'Mentoria Express 30min', description: 'Sessão individual com a Nutri', cost: 5000, type: 'experiencia', image: '👑', active: true },
    { id: '5', name: 'Kit Suplementos', description: 'Whey + Creatina + Colágeno', cost: 8000, type: 'fisico', image: '💪', stock: 20, active: true },
]

const MOCK_ORDERS: Order[] = [
    { id: 'o1', userId: 'u1', userName: 'Ana Júlia Silva', userAvatar: 'AJ', rewardId: '3', rewardName: 'Caneca Exclusiva', rewardCost: 2500, date: 'Hoje, 09:00', status: 'pending' },
    { id: 'o2', userId: 'u2', userName: 'Carla Dias', userAvatar: 'CD', rewardId: '1', rewardName: 'E-book Receitas', rewardCost: 500, date: 'Ontem, 15:30', status: 'completed' },
    { id: 'o3', userId: 'u3', userName: 'Fernanda Lima', userAvatar: 'FL', rewardId: '4', rewardName: 'Mentoria Express', rewardCost: 5000, date: 'Ontem, 10:00', status: 'processing' },
    { id: 'o4', userId: 'u4', userName: 'Marina Santos', userAvatar: 'MS', rewardId: '2', rewardName: 'Desconto 10%', rewardCost: 1000, date: '2 dias atrás', status: 'completed' },
]

export function RewardsView({ setView }: { setView: (v: any) => void }) {
    const [activeTab, setActiveTab] = useState<'catalog' | 'orders'>('catalog')
    const [rewards, setRewards] = useState(MOCK_REWARDS)
    const [orders, setOrders] = useState(MOCK_ORDERS)
    const [searchQuery, setSearchQuery] = useState("")
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingReward, setEditingReward] = useState<Reward | null>(null)

    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing')
    const totalCrystalsRedeemed = orders.filter(o => o.status === 'completed').reduce((acc, o) => acc + o.rewardCost, 0)

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'digital': return <Download size={14} />
            case 'fisico': return <Package size={14} />
            case 'cupom': return <Percent size={14} />
            case 'experiencia': return <Star size={14} />
            default: return <Gift size={14} />
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'digital': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            case 'fisico': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            case 'cupom': return 'bg-green-500/20 text-green-400 border-green-500/30'
            case 'experiencia': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <Clock size={12} /> Pendente
                    </span>
                )
            case 'processing':
                return (
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <Truck size={12} /> Enviando
                    </span>
                )
            case 'completed':
                return (
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <CheckCircle size={12} /> Entregue
                    </span>
                )
            case 'cancelled':
                return (
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                        <X size={12} /> Cancelado
                    </span>
                )
            default:
                return null
        }
    }

    const markAsDelivered = (orderId: string) => {
        setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, status: 'completed' as const } : o
        ))
    }

    const deleteReward = (rewardId: string) => {
        if (confirm('Tem certeza que deseja excluir este prêmio?')) {
            setRewards(prev => prev.filter(r => r.id !== rewardId))
        }
    }

    const filteredRewards = rewards.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Diamond className="text-purple-400" />
                        Loja de Prêmios
                    </h1>
                    <p className="text-gray-400 mt-1">Gerencie o que suas Rainhas podem resgatar com cristais.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'catalog'
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Package size={16} className="inline mr-2" />
                            Catálogo
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'orders'
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <ShoppingBag size={16} />
                            Pedidos
                            {pendingOrders.length > 0 && (
                                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                    {pendingOrders.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Gift size={24} className="text-purple-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{rewards.length}</p>
                        <p className="text-xs text-gray-500">Prêmios Ativos</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Clock size={24} className="text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{pendingOrders.length}</p>
                        <p className="text-xs text-gray-500">Pedidos Pendentes</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle size={24} className="text-green-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{orders.filter(o => o.status === 'completed').length}</p>
                        <p className="text-xs text-gray-500">Entregas Concluídas</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                        <Diamond size={24} className="text-pink-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{totalCrystalsRedeemed.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Cristais Resgatados</p>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'catalog' && (
                <div className="space-y-6">
                    {/* Search */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-purple-500 outline-none"
                                placeholder="Buscar prêmio..."
                            />
                        </div>
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-gradient-to-r from-purple-600 to-pink-600"
                        >
                            <Plus size={18} className="mr-2" />
                            Novo Prêmio
                        </Button>
                    </div>

                    {/* Rewards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRewards.map((reward) => (
                            <motion.div
                                key={reward.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel rounded-2xl border border-white/5 p-6 relative group hover:border-purple-500/30 transition-all"
                            >
                                {/* Image/Emoji */}
                                <div className="text-5xl mb-4">{reward.image}</div>

                                {/* Content */}
                                <h3 className="font-bold text-lg">{reward.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">{reward.description}</p>

                                {/* Price */}
                                <div className="flex items-center gap-2 mt-4">
                                    <Diamond size={16} className="text-purple-400" />
                                    <span className="text-xl font-bold text-purple-400">{reward.cost.toLocaleString()}</span>
                                    <span className="text-sm text-gray-500">cristais</span>
                                </div>

                                {/* Type Badge */}
                                <div className={`inline-flex items-center gap-1 mt-3 px-2 py-1 rounded text-xs font-bold uppercase border ${getTypeColor(reward.type)}`}>
                                    {getTypeIcon(reward.type)}
                                    {reward.type}
                                </div>

                                {/* Stock */}
                                {reward.stock !== undefined && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Estoque: <span className="text-white">{reward.stock}</span> unidades
                                    </p>
                                )}

                                {/* Hover Actions */}
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                                    <button
                                        onClick={() => setEditingReward(reward)}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteReward(reward.id)}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}

                        {/* Add New Card */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-purple-400 hover:border-purple-500/50 transition min-h-[250px]"
                        >
                            <Plus size={40} className="mb-3" />
                            <span className="font-bold">Criar Novo Prêmio</span>
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02] text-xs uppercase text-gray-500 font-bold border-b border-white/5">
                            <tr>
                                <th className="p-4">Rainha</th>
                                <th className="p-4">Prêmio Resgatado</th>
                                <th className="p-4">Cristais</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-white/[0.02] transition">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">
                                                {order.userAvatar}
                                            </div>
                                            <span className="font-bold">{order.userName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-purple-300">{order.rewardName}</td>
                                    <td className="p-4">
                                        <span className="flex items-center gap-1 text-yellow-400">
                                            <Diamond size={14} />
                                            {order.rewardCost.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">{order.date}</td>
                                    <td className="p-4">{getStatusBadge(order.status)}</td>
                                    <td className="p-4 text-right">
                                        {(order.status === 'pending' || order.status === 'processing') && (
                                            <Button
                                                onClick={() => markAsDelivered(order.id)}
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-500 text-xs"
                                            >
                                                <CheckCircle size={14} className="mr-1" />
                                                Marcar Entregue
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {(showCreateModal || editingReward) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#1a1a2e] border border-white/10 w-full max-w-lg rounded-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-xl font-bold">
                                    {editingReward ? 'Editar Prêmio' : 'Novo Prêmio'}
                                </h3>
                                <button
                                    onClick={() => { setShowCreateModal(false); setEditingReward(null) }}
                                    className="text-gray-500 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Emoji</label>
                                    <input
                                        defaultValue={editingReward?.image || '🎁'}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-3xl text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nome do Prêmio</label>
                                    <input
                                        defaultValue={editingReward?.name || ''}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4"
                                        placeholder="Ex: Caneca Exclusiva"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Descrição</label>
                                    <textarea
                                        defaultValue={editingReward?.description || ''}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 h-20 resize-none"
                                        placeholder="Breve descrição do prêmio"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Custo (Cristais)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingReward?.cost || 500}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tipo</label>
                                        <select
                                            defaultValue={editingReward?.type || 'digital'}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4"
                                        >
                                            <option value="digital">Digital</option>
                                            <option value="fisico">Físico</option>
                                            <option value="cupom">Cupom</option>
                                            <option value="experiencia">Experiência</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setShowCreateModal(false); setEditingReward(null) }}
                                >
                                    Cancelar
                                </Button>
                                <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                                    <CheckCircle size={16} className="mr-2" />
                                    {editingReward ? 'Salvar Alterações' : 'Criar Prêmio'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
