export interface AvailabilityMap {
  mon?: string[]
  tue?: string[]
  wed?: string[]
  thu?: string[]
  fri?: string[]
  sat?: string[]
  sun?: string[]
}

export interface AgendaSlot {
  time: string
  available: boolean
}

export interface AgendaDay {
  date: string // YYYY-MM-DD
  weekday: string // 'mon' | 'tue' | ...
  slots: AgendaSlot[]
}

const WEEKDAY_KEYS: (keyof AvailabilityMap)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Monta a agenda dos próximos `days` dias a partir de `availability`,
 * marcando como indisponível qualquer horário já presente em `bookedIso`
 * (timestamps ISO no formato usado ao criar bookings: `${date}T${time}:00-03:00`).
 */
export function buildAgenda(availability: AvailabilityMap | null | undefined, bookedIso: string[], days = 14): AgendaDay[] {
  // Compara por instante (epoch), não por string — o Postgres devolve
  // scheduled_at com offset UTC, diferente do "-03:00" usado ao montar o slot.
  const bookedTimestamps = new Set(bookedIso.map(iso => new Date(iso).getTime()))
  const now = new Date()
  const agenda: AgendaDay[] = []

  for (let i = 0; i < days; i++) {
    const day = new Date(now.getTime() + i * 86400000)
    const weekday = WEEKDAY_KEYS[day.getDay()]
    const dateKey = toDateKey(day)
    const times = (availability?.[weekday] || []).slice().sort()

    const slots: AgendaSlot[] = times.map(time => {
      const slotDate = new Date(`${dateKey}T${time}:00-03:00`)
      const isPast = slotDate.getTime() <= now.getTime()
      return { time, available: !bookedTimestamps.has(slotDate.getTime()) && !isPast }
    })

    agenda.push({ date: dateKey, weekday, slots })
  }

  return agenda
}

/**
 * Retorna o primeiro dia+horário disponível dentro da agenda, ou null se
 * não houver nenhum nos próximos `days` dias.
 */
export function nextAvailableSlot(availability: AvailabilityMap | null | undefined, bookedIso: string[], days = 14): { date: string; time: string } | null {
  const agenda = buildAgenda(availability, bookedIso, days)
  for (const day of agenda) {
    const slot = day.slots.find(s => s.available)
    if (slot) return { date: day.date, time: slot.time }
  }
  return null
}
