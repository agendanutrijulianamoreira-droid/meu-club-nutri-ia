"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, ChevronDown, ChevronUp, Droplets, Sparkles, CheckCircle2 } from "lucide-react"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Task {
  time: string | null
  type: string
  description: string
  ingredients?: string[]
  points: number
  dietary_tags?: string[]  // ['sem_gluten', 'vegetariana', 'sem_lactose']
}

interface ProtocolDay {
  day: number
  title: string
  items: Task[]
}

interface Props {
  protocol: any       // objeto vindo do activeProtocol.protocol
  days: ProtocolDay[] // dias já processados (do hook useAssignments)
  currentDay: number  // dia atual do protocolo (baseado em assigned_at)
  progress: number
  onGoIA: () => void
}

// ─── Configuração dos slots de refeição ──────────────────────────────────────

const MEAL_SLOTS = [
  { key: 'shot',          label: 'Shot Matinal',    emoji: '🧪', time: '06:30', color: 'from-orange-500/10 to-amber-500/5',  border: 'border-orange-500/20',  badge: 'bg-orange-500/15 text-orange-400' },
  { key: 'cafe_manha',    label: 'Café da Manhã',   emoji: '☀️',  time: '08:30', color: 'from-yellow-500/10 to-amber-500/5', border: 'border-yellow-500/20', badge: 'bg-yellow-500/15 text-yellow-400' },
  { key: 'lanche_manha',  label: 'Lanche da Manhã', emoji: '🍋',  time: '10:00', color: 'from-lime-500/10 to-green-500/5',  border: 'border-lime-500/20',   badge: 'bg-lime-500/15 text-lime-400' },
  { key: 'colacao',       label: 'Colação',         emoji: '🍎',  time: '10:00', color: 'from-lime-500/10 to-green-500/5',  border: 'border-lime-500/20',   badge: 'bg-lime-500/15 text-lime-400' },
  { key: 'meal',          label: 'Refeição',        emoji: '🍽️', time: null,    color: 'from-indigo-500/10 to-violet-500/5', border: 'border-indigo-500/20', badge: 'bg-indigo-500/15 text-indigo-400' },
  { key: 'almoco',        label: 'Almoço',          emoji: '🍽️', time: '12:00', color: 'from-indigo-500/10 to-violet-500/5', border: 'border-indigo-500/20', badge: 'bg-indigo-500/15 text-indigo-400' },
  { key: 'lanche_tarde',  label: 'Lanche da Tarde', emoji: '🥤',  time: '16:00', color: 'from-sky-500/10 to-cyan-500/5',    border: 'border-sky-500/20',    badge: 'bg-sky-500/15 text-sky-400' },
  { key: 'jantar',        label: 'Jantar',          emoji: '🌙',  time: '19:30', color: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-500/20', badge: 'bg-violet-500/15 text-violet-400' },
  { key: 'ceia',          label: 'Ceia',            emoji: '🍵',  time: '22:00', color: 'from-slate-500/10 to-slate-600/5', border: 'border-slate-500/20',  badge: 'bg-slate-500/15 text-slate-400' },
  { key: 'cha_noturno',   label: 'Chá Noturno',     emoji: '🍵',  time: '22:00', color: 'from-slate-500/10 to-slate-600/5', border: 'border-slate-500/20',  badge: 'bg-slate-500/15 text-slate-400' },
  { key: 'water',         label: 'Hidratação',      emoji: '💧',  time: null,    color: 'from-blue-500/10 to-sky-500/5',    border: 'border-blue-500/20',   badge: 'bg-blue-500/15 text-blue-400' },
  { key: 'workout',       label: 'Treino',          emoji: '💪',  time: null,    color: 'from-rose-500/10 to-pink-500/5',   border: 'border-rose-500/20',   badge: 'bg-rose-500/15 text-rose-400' },
  { key: 'content',       label: 'Dica',            emoji: '💡',  time: null,    color: 'from-amber-500/10 to-yellow-500/5', border: 'border-amber-500/20', badge: 'bg-amber-500/15 text-amber-400' },
]

const SLOT_ORDER = MEAL_SLOTS.map(s => s.key)

// Refeições que têm lembrete de água
const WATER_AFTER = ['cafe_manha', 'almoco', 'lanche_tarde', 'jantar', 'lanche_manha', 'colacao']

// Tags alimentares
const DIETARY_TAG_CONFIG: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  sem_gluten:   { label: 'Sem glúten',   emoji: '🌾', bg: 'bg-amber-500/10',  text: 'text-amber-400' },
  vegetariana:  { label: 'Vegetariana',  emoji: '🌿', bg: 'bg-green-500/10',  text: 'text-green-400' },
  sem_lactose:  { label: 'Sem lactose',  emoji: '🥛', bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  vegana:       { label: 'Vegana',       emoji: '🫘', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
}

// Infere tags a partir do texto (para protocolos sem tags explícitas)
function inferTags(text: string, ingredients: string[] = []): string[] {
  const all = [text, ...ingredients].join(' ').toLowerCase()
  const tags: string[] = []
  if (!all.includes('gluten') && !all.includes('trigo') && !all.includes('aveia') && !all.includes('pão') && !all.includes('macarrão') && !all.includes('tapioca')) {
    // não inferir — muito falso-positivo
  }
  if (all.includes('sem glúten') || all.includes('sem gluten')) tags.push('sem_gluten')
  if (all.includes('vegetarian') || all.includes('proteína de soja') || all.includes('tofu')) tags.push('vegetariana')
  if (all.includes('sem lactose') || all.includes('leite de soja') || all.includes('vegano')) tags.push('sem_lactose')
  return tags
}

// ─── Componente de um grupo de refeição ──────────────────────────────────────

function MealSection({ slot, tasks }: { slot: typeof MEAL_SLOTS[0]; tasks: Task[] }) {
  const [expanded, setExpanded] = useState(true)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)

  // Se só 1 task, mostra direto sem numeração
  const hasOptions = tasks.length > 1

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${slot.color} border ${slot.border} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{slot.emoji}</span>
          <div className="text-left">
            <p className="text-white font-bold text-sm">{slot.label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {slot.time && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={10} />{slot.time}
                </span>
              )}
              {hasOptions && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${slot.badge}`}>
                  {tasks.length} opções
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={18} className="text-slate-500 shrink-0" />
          : <ChevronDown size={18} className="text-slate-500 shrink-0" />
        }
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2.5">
              {/* Selector de opção (quando múltiplas) */}
              {hasOptions && (
                <div className="flex gap-2 flex-wrap mb-1">
                  {tasks.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOption(selectedOption === i ? null : i)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all ${
                        selectedOption === i
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      Opção {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Tasks / options */}
              {tasks.map((task, i) => {
                // Se tem seleção ativa e não é este, esconde
                if (selectedOption !== null && selectedOption !== i) return null

                const tags = task.dietary_tags?.length
                  ? task.dietary_tags
                  : inferTags(task.description, task.ingredients)

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-black/20 rounded-xl p-3.5"
                  >
                    {/* Tags alimentares */}
                    {tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {tags.map(tag => {
                          const cfg = DIETARY_TAG_CONFIG[tag]
                          if (!cfg) return null
                          return (
                            <span key={tag} className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                              {cfg.emoji} {cfg.label}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Descrição principal */}
                    <p className="text-white text-sm font-medium leading-relaxed">
                      {task.description}
                    </p>

                    {/* Ingredientes */}
                    {task.ingredients && task.ingredients.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {task.ingredients.map((ing, ii) => (
                          <li key={ii} className="text-xs text-slate-400 flex items-start gap-1.5">
                            <span className="text-slate-600 mt-0.5">•</span>
                            <span>{ing}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Pontos XP */}
                    {task.points > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-xs text-amber-400 font-semibold">+{task.points} XP</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Lembrete de água ─────────────────────────────────────────────────────────

function WaterReminder() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/5 rounded-xl border border-blue-500/10">
      <Droplets size={16} className="text-blue-400 shrink-0" />
      <p className="text-xs text-blue-300/70">Beba 1 copo de água agora 💧</p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProtocolMealView({ protocol, days, currentDay, progress, onGoIA }: Props) {

  // Pega o dia atual (ou primeiro dia disponível)
  const activeDayData = days.find(d => d.day === currentDay) || days[0]

  if (!activeDayData) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-slate-600" />
        </div>
        <p className="text-white font-semibold">Protocolo sem conteúdo</p>
        <p className="text-slate-500 text-sm">Aguarde sua nutricionista configurar o plano.</p>
        <button
          onClick={onGoIA}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-400"
        >
          <Sparkles size={14} />Gerar plano interativo enquanto isso
        </button>
      </div>
    )
  }

  // Agrupa tasks por tipo, respeitando a ordem do SLOT_ORDER
  const grouped: Record<string, Task[]> = {}
  for (const task of (activeDayData.items || [])) {
    const type = (task as any).type || 'meal'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(task as any)
  }

  // Ordena os grupos pelo SLOT_ORDER
  const orderedGroups = SLOT_ORDER
    .filter(key => grouped[key]?.length > 0)
    .map(key => ({
      slot: MEAL_SLOTS.find(s => s.key === key)!,
      tasks: grouped[key],
    }))

  // Adiciona grupos de tipos não reconhecidos no final
  for (const [key, tasks] of Object.entries(grouped)) {
    if (!SLOT_ORDER.includes(key)) {
      orderedGroups.push({
        slot: { key, label: key, emoji: '🍽️', time: null, color: 'from-slate-500/10 to-slate-600/5', border: 'border-slate-500/20', badge: 'bg-slate-500/15 text-slate-400' },
        tasks,
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header do protocolo */}
      <div className="bg-gradient-to-br from-indigo-600/15 to-violet-600/10 rounded-2xl border border-indigo-500/20 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1 block">Protocolo Ativo</span>
            <h2 className="text-white font-bold text-lg leading-tight">
              {protocol?.title || 'Meu Protocolo'}
            </h2>
            {protocol?.description && (
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">{protocol.description}</p>
            )}
          </div>
        </div>

        {/* Progresso */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">Progresso</span>
            <span className="text-xs font-bold text-white">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dia atual */}
      {days.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-500 font-medium">
            {activeDayData.title || `Dia ${activeDayData.day}`}
          </p>
          <span className="text-xs text-slate-600">Dia {activeDayData.day} de {days.length}</span>
        </div>
      )}

      {/* Legenda das tags */}
      {orderedGroups.some(g => g.tasks.some(t => inferTags(t.description, t.ingredients).length > 0 || (t.dietary_tags || []).length > 0)) && (
        <div className="flex gap-2 flex-wrap px-1">
          {Object.values(DIETARY_TAG_CONFIG).map(cfg => (
            <span key={cfg.label} className={`text-[10px] px-2 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
              {cfg.emoji} {cfg.label}
            </span>
          ))}
        </div>
      )}

      {/* Refeições */}
      <div className="space-y-3">
        {orderedGroups.map(({ slot, tasks }, idx) => (
          <div key={slot.key}>
            <MealSection slot={slot} tasks={tasks} />
            {WATER_AFTER.includes(slot.key) && <WaterReminder />}
          </div>
        ))}
      </div>

      {orderedGroups.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          Sem refeições configuradas para hoje.
        </div>
      )}
    </div>
  )
}
