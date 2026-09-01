"use client"

import { useState, useEffect, ReactNode } from "react"
import {
    BookOpen, Search, LayoutDashboard, Utensils, Apple, Soup,
    Coffee, Leaf, Pill, FileText as FileIcon, Target, Loader2, AlertCircle, CheckCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import {
    useRecipes, useMeals, useShots, useTeas, useSupplements, useMaterials,
    useClinicalCategories, useGoals, useShotComponents, useTeaComponents,
    useMealComponents, useRecipeComponents, Recipe, Meal, Shot, Tea, Supplement, Material,
} from "@/lib/hooks/useDatabase"
import { AssetList } from "./clinical-library/AssetList"
import { AssetFormModal, AssetFormValues } from "./clinical-library/AssetFormModal"
import { AIGenerateModal } from "./clinical-library/AIGenerateModal"
import { ComponentsEditor } from "./clinical-library/ComponentsEditor"
import { GoalCard, CreateGoalForm } from "./clinical-library/GoalComponents"

type LibTab = 'dashboard' | 'all' | 'recipes' | 'foods' | 'meals' | 'shots' | 'teas' | 'supplements' | 'materials' | 'goals'

const TABS: { id: LibTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all', label: 'Todos', icon: Search },
    { id: 'recipes', label: 'Receitas', icon: Utensils },
    { id: 'foods', label: 'Alimentos', icon: Apple },
    { id: 'meals', label: 'Refeições', icon: Soup },
    { id: 'shots', label: 'Shots', icon: Coffee },
    { id: 'teas', label: 'Chás', icon: Leaf },
    { id: 'supplements', label: 'Suplementos', icon: Pill },
    { id: 'materials', label: 'Materiais', icon: FileIcon },
    { id: 'goals', label: 'Metas', icon: Target },
]

function tagsToArray(tags: string): string[] {
    return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function DashboardTab() {
    const [stats, setStats] = useState<any[] | null>(null)
    useEffect(() => {
        fetch('/api/admin/clinical-library/stats').then(r => r.json()).then(d => setStats(d.stats || []))
    }, [])

    const LABELS: Record<string, string> = {
        recipe: 'Receitas', meal: 'Refeições', shot: 'Shots', tea: 'Chás',
        supplement: 'Suplementos', material: 'Materiais', goal: 'Metas',
    }

    if (!stats) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>

    return (
        <div className="space-y-4">
            <p className="text-slate-500 text-sm">Visão geral dos Ativos Clínicos cadastrados. "Mais utilizados" fica disponível quando Protocolos/Dietas passarem a referenciar estes ativos.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map(s => (
                    <div key={s.entity_type} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                        <p className="text-2xl font-bold text-white">{s.total}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mt-1">{LABELS[s.entity_type] || s.entity_type}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                            <span className="text-emerald-400">{s.active} ativos</span>
                            {s.inactive > 0 && <span className="text-slate-600">· {s.inactive} arquivados</span>}
                        </div>
                        {(s.missing_category > 0 || s.missing_tags > 0) && (
                            <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
                                {s.missing_category > 0 && <p className="text-[10px] text-amber-400">{s.missing_category} sem categoria</p>}
                                {s.missing_tags > 0 && <p className="text-[10px] text-amber-400">{s.missing_tags} sem tags</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function AllTab() {
    const [q, setQ] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const LABELS: Record<string, string> = {
        recipe: 'Receita', meal: 'Refeição', shot: 'Shot', tea: 'Chá',
        supplement: 'Suplemento', material: 'Material', goal: 'Meta',
    }

    const search = async (query: string) => {
        setLoading(true)
        const res = await fetch(`/api/admin/clinical-library/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || [])
        setLoading(false)
    }

    useEffect(() => { search('') }, [])

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={q} onChange={e => { setQ(e.target.value); search(e.target.value) }}
                    placeholder="Buscar em toda a Biblioteca Clínica..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40" />
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.map(r => (
                        <div key={`${r.entity_type}-${r.id}`} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400">
                                {LABELS[r.entity_type]}
                            </span>
                            <p className="text-white font-bold text-sm mt-2">{r.title}</p>
                            {r.description && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{r.description}</p>}
                            {!r.is_active && <p className="text-[10px] text-slate-600 mt-1">Arquivado</p>}
                        </div>
                    ))}
                    {results.length === 0 && (
                        <p className="text-slate-500 text-sm col-span-full text-center py-10">Nenhum resultado encontrado.</p>
                    )}
                </div>
            )}
        </div>
    )
}

function FoodsTab() {
    const [query, setQuery] = useState('')
    const [foods, setFoods] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const search = async (q: string) => {
        setLoading(true)
        let sb = supabase.from('foods').select('id, name, category, energy_kcal, protein_g').order('name').limit(60)
        if (q.trim()) sb = sb.ilike('name', `%${q.trim()}%`)
        const { data } = await sb
        setFoods(data || [])
        setLoading(false)
    }

    useEffect(() => { search('') }, [])

    return (
        <div className="space-y-4">
            <p className="text-slate-500 text-sm">Base global de alimentos (TACO/TBCA), compartilhada entre todos os clubes — somente leitura.</p>
            <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={query} onChange={e => { setQuery(e.target.value); search(e.target.value) }}
                    placeholder="Buscar alimento..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40" />
            </div>
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {foods.map(f => (
                        <div key={f.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-white font-bold text-sm">{f.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{f.category}</p>
                            <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                                {f.energy_kcal && <span>{f.energy_kcal} kcal</span>}
                                {f.protein_g && <span>{f.protein_g}g prot</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function useToast() {
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }
    const ToastNode = (
        <AnimatePresence>
            {toast && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border
                        ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {toast.msg}
                </motion.div>
            )}
        </AnimatePresence>
    )
    return { showToast, ToastNode }
}

interface EntityTabConfig {
    entityType: 'recipe' | 'meal' | 'shot' | 'tea' | 'supplement' | 'material'
    entityLabel: string
    entityLabelPlural: string
    generatePath?: string
    extraFields?: (values: AssetFormValues, setValue: (k: string, v: any) => void) => ReactNode
    renderExtra?: (item: any) => ReactNode
}

function EntityTab({
    config, tenantId, hookResult,
}: {
    config: EntityTabConfig
    tenantId: string
    hookResult: {
        items: any[]; loading: boolean
        createItem: (v: any) => Promise<any>; updateItem: (id: string, v: any) => Promise<any>
        toggleActive: (id: string) => Promise<any>; duplicateItem: (id: string) => Promise<any>
        fetchItems: () => Promise<void>
    }
}) {
    const { categories } = useClinicalCategories(config.entityType)
    const { showToast, ToastNode } = useToast()
    const [editing, setEditing] = useState<any | null | undefined>(undefined)
    const [generating, setGenerating] = useState(false)
    const [showAI, setShowAI] = useState(false)
    const [saving, setSaving] = useState(false)

    const handleSave = async (values: AssetFormValues) => {
        setSaving(true)
        const payload = { ...values, tags: tagsToArray(values.tags), tenant_id: tenantId, category_id: values.category_id || null }
        delete (payload as any).id
        const result = editing?.id ? await hookResult.updateItem(editing.id, payload) : await hookResult.createItem(payload)
        setSaving(false)
        if (result?.error) { showToast('error', result.error); return }
        showToast('success', editing?.id ? `${config.entityLabel} atualizada!` : `${config.entityLabel} criada!`)
        setEditing(undefined)
    }

    const handleGenerateAI = async (theme: string, categoryId: string) => {
        if (!config.generatePath) return
        setGenerating(true)
        try {
            const res = await fetch(config.generatePath, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme, category_id: categoryId }),
            })
            const data = await res.json()
            if (!res.ok) { showToast('error', data.error || 'Erro na geração'); return }
            showToast('success', `${config.entityLabel} gerada com IA!`)
            setShowAI(false)
            await hookResult.fetchItems()
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="space-y-4">
            {ToastNode}
            <AssetList
                items={hookResult.items}
                loading={hookResult.loading}
                categories={categories}
                entityLabel={config.entityLabel}
                entityLabelPlural={config.entityLabelPlural}
                onCreate={() => setEditing(null)}
                onGenerateAI={config.generatePath ? () => setShowAI(true) : undefined}
                onEdit={item => setEditing(item)}
                onToggleActive={async id => {
                    const r = await hookResult.toggleActive(id)
                    if (r?.error) showToast('error', r.error)
                }}
                onDuplicate={async id => {
                    const r = await hookResult.duplicateItem(id)
                    if (r?.error) showToast('error', r.error); else showToast('success', 'Duplicado!')
                }}
                renderExtra={config.renderExtra}
            />

            {editing !== undefined && (
                <AssetFormModal
                    entityLabel={config.entityLabel}
                    categories={categories}
                    initial={editing}
                    saving={saving}
                    onClose={() => setEditing(undefined)}
                    onSave={handleSave}
                    extraFields={config.extraFields}
                />
            )}

            {showAI && config.generatePath && (
                <AIGenerateModal
                    entityLabel={config.entityLabel}
                    categories={categories}
                    saving={generating}
                    onClose={() => setShowAI(false)}
                    onGenerate={handleGenerateAI}
                />
            )}
        </div>
    )
}

function RecipeComponentsField({ recipeId, tenantId }: { recipeId: string; tenantId: string }) {
    const hook = useRecipeComponents(recipeId)
    return <ComponentsEditor hook={hook} tenantId={tenantId} />
}

function MealComponentsField({ mealId, tenantId }: { mealId: string; tenantId: string }) {
    const hook = useMealComponents(mealId)
    return <ComponentsEditor hook={hook} tenantId={tenantId} />
}

function ShotComponentsField({ shotId, tenantId }: { shotId: string; tenantId: string }) {
    const hook = useShotComponents(shotId)
    return <ComponentsEditor hook={hook} tenantId={tenantId} />
}

function TeaComponentsField({ teaId, tenantId }: { teaId: string; tenantId: string }) {
    const hook = useTeaComponents(teaId)
    return <ComponentsEditor hook={hook} tenantId={tenantId} />
}

function GoalsTab({ tenantId }: { tenantId: string }) {
    const { goals, loading, createGoal, deleteGoal, toggleGoalFavorite } = useGoals(tenantId)
    const [showCreate, setShowCreate] = useState(false)
    const { showToast, ToastNode } = useToast()

    return (
        <div className="space-y-4">
            {ToastNode}
            {showCreate ? (
                <CreateGoalForm
                    tenantId={tenantId}
                    onClose={() => setShowCreate(false)}
                    onSave={async (data) => {
                        const result = await createGoal(data)
                        if (result.error) showToast('error', 'Erro ao salvar meta')
                        else { showToast('success', 'Meta criada!'); setShowCreate(false) }
                    }}
                />
            ) : (
                <>
                    <div className="flex justify-end">
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                            Nova Meta
                        </button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
                    ) : goals.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-10 text-center">
                            <p className="text-white font-bold mb-1">Nenhuma meta criada ainda</p>
                            <p className="text-slate-500 text-sm">Crie metas reutilizáveis: hidratação, sono, proteína, exercício.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {goals.map(goal => (
                                <GoalCard key={goal.id} goal={goal}
                                    onDelete={async (id) => { await deleteGoal(id); showToast('success', 'Meta excluída') }}
                                    onToggleFavorite={toggleGoalFavorite} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export function ClinicalLibraryView({ tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
    const [activeTab, setActiveTab] = useState<LibTab>('dashboard')

    const recipesHook = useRecipes()
    const mealsHook = useMeals()
    const shotsHook = useShots()
    const teasHook = useTeas()
    const supplementsHook = useSupplements()
    const materialsHook = useMaterials()

    return (
        <div className="space-y-5 pb-10">
            <div>
                <h1 className="text-3xl font-light text-white flex items-center gap-2">
                    <BookOpen className="text-indigo-400" size={28} />
                    Biblioteca <span className="font-bold">Clínica</span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">Ativos Clínicos reutilizáveis — fonte única de verdade para Protocolos, Dietas e Desafios.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex gap-1 w-fit flex-wrap">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all
                            ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {activeTab === 'dashboard' && <DashboardTab />}
                    {activeTab === 'all' && <AllTab />}
                    {activeTab === 'foods' && <FoodsTab />}
                    {activeTab === 'goals' && <GoalsTab tenantId={tenantId} />}

                    {activeTab === 'recipes' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: recipesHook.items, loading: recipesHook.loading, createItem: recipesHook.createItem, updateItem: recipesHook.updateItem, toggleActive: recipesHook.toggleActive, duplicateItem: recipesHook.duplicateItem, fetchItems: recipesHook.fetchItems }}
                            config={{
                                entityType: 'recipe', entityLabel: 'Receita', entityLabelPlural: 'Receitas', generatePath: '/api/admin/recipes/generate',
                                extraFields: (values, setValue) => (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Emoji</p>
                                            <input value={values.emoji || ''} onChange={e => setValue('emoji', e.target.value)} placeholder="🍽️"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Preparo (min)</p>
                                            <input type="number" value={values.prep_time_min || ''} onChange={e => setValue('prep_time_min', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Porções</p>
                                            <input type="number" value={values.servings || 1} onChange={e => setValue('servings', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div className="col-span-3">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modo de preparo</p>
                                            <textarea value={values.instructions || ''} onChange={e => setValue('instructions', e.target.value)} rows={3}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        {values.id && (
                                            <div className="col-span-3">
                                                <RecipeComponentsField recipeId={values.id} tenantId={tenantId} />
                                            </div>
                                        )}
                                    </div>
                                ),
                            }}
                        />
                    )}

                    {activeTab === 'meals' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: mealsHook.items, loading: mealsHook.loading, createItem: mealsHook.createItem, updateItem: mealsHook.updateItem, toggleActive: mealsHook.toggleActive, duplicateItem: mealsHook.duplicateItem, fetchItems: mealsHook.fetchItems }}
                            config={{
                                entityType: 'meal', entityLabel: 'Refeição', entityLabelPlural: 'Refeições', generatePath: '/api/admin/meals/generate',
                                extraFields: (values, setValue) => (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Observações</p>
                                            <input value={values.notes || ''} onChange={e => setValue('notes', e.target.value)} placeholder="ex: sirva gelado"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        {values.id && <MealComponentsField mealId={values.id} tenantId={tenantId} />}
                                    </div>
                                ),
                            }}
                        />
                    )}

                    {activeTab === 'shots' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: shotsHook.items, loading: shotsHook.loading, createItem: shotsHook.createItem, updateItem: shotsHook.updateItem, toggleActive: shotsHook.toggleActive, duplicateItem: shotsHook.duplicateItem, fetchItems: shotsHook.fetchItems }}
                            config={{
                                entityType: 'shot', entityLabel: 'Shot', entityLabelPlural: 'Shots', generatePath: '/api/admin/shots/generate',
                                extraFields: (values, setValue) => (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Volume (ml)</p>
                                                <input type="number" value={values.volume_ml || ''} onChange={e => setValue('volume_ml', e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Melhor horário</p>
                                                <input value={values.best_time || ''} onChange={e => setValue('best_time', e.target.value)} placeholder="em jejum"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modo de preparo</p>
                                            <textarea value={values.instructions || ''} onChange={e => setValue('instructions', e.target.value)} rows={2}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Contraindicações</p>
                                            <input value={values.contraindications || ''} onChange={e => setValue('contraindications', e.target.value)} placeholder="ex: gastrite, úlcera"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        {values.id && <ShotComponentsField shotId={values.id} tenantId={tenantId} />}
                                    </div>
                                ),
                            }}
                        />
                    )}

                    {activeTab === 'teas' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: teasHook.items, loading: teasHook.loading, createItem: teasHook.createItem, updateItem: teasHook.updateItem, toggleActive: teasHook.toggleActive, duplicateItem: teasHook.duplicateItem, fetchItems: teasHook.fetchItems }}
                            config={{
                                entityType: 'tea', entityLabel: 'Chá', entityLabelPlural: 'Chás', generatePath: '/api/admin/teas/generate',
                                extraFields: (values, setValue) => (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Melhor horário</p>
                                            <input value={values.best_time || ''} onChange={e => setValue('best_time', e.target.value)} placeholder="noturno"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modo de preparo</p>
                                            <textarea value={values.instructions || ''} onChange={e => setValue('instructions', e.target.value)} rows={2}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        {values.id && <TeaComponentsField teaId={values.id} tenantId={tenantId} />}
                                    </div>
                                ),
                            }}
                        />
                    )}

                    {activeTab === 'supplements' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: supplementsHook.items, loading: supplementsHook.loading, createItem: supplementsHook.createItem, updateItem: supplementsHook.updateItem, toggleActive: supplementsHook.toggleActive, duplicateItem: supplementsHook.duplicateItem, fetchItems: supplementsHook.fetchItems }}
                            config={{
                                entityType: 'supplement', entityLabel: 'Suplemento', entityLabelPlural: 'Suplementos', generatePath: '/api/admin/supplements/generate',
                                extraFields: (values, setValue) => (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Dosagem padrão</p>
                                            <input type="number" value={values.default_dosage || ''} onChange={e => setValue('default_dosage', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Unidade</p>
                                            <input value={values.dosage_unit || ''} onChange={e => setValue('dosage_unit', e.target.value)} placeholder="mg/UI/cápsula"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Frequência</p>
                                            <input value={values.frequency || ''} onChange={e => setValue('frequency', e.target.value)} placeholder="1x ao dia"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Melhor horário</p>
                                            <input value={values.best_time || ''} onChange={e => setValue('best_time', e.target.value)} placeholder="após o almoço"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Contraindicações</p>
                                            <input value={values.contraindications || ''} onChange={e => setValue('contraindications', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                    </div>
                                ),
                            }}
                        />
                    )}

                    {activeTab === 'materials' && (
                        <EntityTab
                            tenantId={tenantId}
                            hookResult={{ items: materialsHook.items, loading: materialsHook.loading, createItem: materialsHook.createItem, updateItem: materialsHook.updateItem, toggleActive: materialsHook.toggleActive, duplicateItem: materialsHook.duplicateItem, fetchItems: materialsHook.fetchItems }}
                            config={{
                                entityType: 'material', entityLabel: 'Material', entityLabelPlural: 'Materiais',
                                extraFields: (values, setValue) => (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Link do arquivo</p>
                                            <input value={values.file_url || ''} onChange={e => setValue('file_url', e.target.value)} placeholder="https://..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tempo estimado (min)</p>
                                            <input type="number" value={values.estimated_minutes || ''} onChange={e => setValue('estimated_minutes', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Autor</p>
                                            <input value={values.author || ''} onChange={e => setValue('author', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                        </div>
                                    </div>
                                ),
                            }}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
