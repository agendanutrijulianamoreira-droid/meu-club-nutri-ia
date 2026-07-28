import { z } from 'zod'

// ─── Prompt Injection Guard ────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(if\s+you\s+(are|were)|a)\s+/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\bhuman\s*:/i,
  /<\s*\/?system\s*>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /###\s*(system|instruction)/i,
  /jailbreak/i,
  /prompt\s+injection/i,
]

/**
 * Strips known injection patterns and limits length before inserting
 * user-supplied data into a prompt. Returns an empty string for null/undefined.
 */
export function sanitizeForPrompt(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return ''
  const str = String(input).trim()

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(str)) return '[conteúdo removido]'
  }

  return str
    .replace(/[<>]/g, '')    // remove angle brackets that could break XML-style prompts
    .slice(0, maxLength)
}

// ─── AI Output Schemas (Zod) ───────────────────────────────────────────────

export const ProtocolSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000).optional().default(''),
  days: z.array(z.object({
    day: z.number().int().positive(),
    title: z.string().max(200),
    items: z.array(z.object({
      title: z.string().max(200),
      time: z.string().max(10).optional(),
      item_type: z.enum(['meal', 'shot', 'water', 'exercise', 'habit']).optional(),
      description: z.string().max(1000).optional(),
      points: z.number().int().nonnegative().optional(),
    })).max(50).optional().default([]),
  })).max(90).optional().default([]),
})

export const ChallengeSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  emoji: z.string().max(10).optional().default('🏆'),
  duration_days: z.number().int().positive().max(365),
})

export const SalesCopySchema = z.object({
  headline: z.string().max(200),
  subheadline: z.string().max(500),
  benefits: z.array(z.string().max(200)).max(10),
  cta: z.string().max(100),
})

export const MarketingSchema = z.object({
  title: z.string().max(100),
  message: z.string().max(500),
})

export const CheckinAnalysisSchema = z.object({
  title: z.string().max(200),
  message: z.string().max(500),
  risk_impact: z.enum(['low', 'medium', 'high']),
})

export const MealPlanSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  days: z.array(z.object({
    day: z.number().int().positive(),
    title: z.string().max(200),
    tasks: z.array(z.object({
      time: z.string().max(10).optional(),
      type: z.enum(['shot', 'meal', 'water', 'workout', 'content']).optional(),
      description: z.string().max(500),
      ingredients: z.array(z.string().max(200)).optional(),
      points: z.number().int().nonnegative().optional(),
    })).max(20),
  })).max(30),
})

export const BusinessPlanSchema = z.object({
  summary: z.string().max(1500),
  months: z.array(z.object({
    month_number: z.number().int().min(1).max(12),
    theme: z.string().max(200),
    focus_area: z.string().max(200).optional().default(''),
    revenue_target_cents: z.number().int().nonnegative().optional(),
    weeks: z.array(z.object({
      week_number: z.number().int().min(1).max(5),
      theme: z.string().max(200),
    })).max(5).optional().default([]),
    suggested_items: z.array(z.object({
      item_type: z.enum(['challenge', 'protocol', 'content_post', 'push_campaign', 'email_campaign', 'promotion', 'product_launch', 'special_event']),
      club_tier: z.enum(['tech_diet', 'vip', 'both']),
      title: z.string().max(200),
      description: z.string().max(500).optional().default(''),
    })).max(15).optional().default([]),
  })).max(12),
})

export type GenerateTask =
  | 'generate-protocol'
  | 'generate-challenge'
  | 'sales-copy'
  | 'marketing-suggestion'
  | 'checkin-analysis'
  | 'email-marketing'
  | 'generate-business-plan'

const VALID_TASKS = new Set<GenerateTask>([
  'generate-protocol',
  'generate-challenge',
  'sales-copy',
  'marketing-suggestion',
  'checkin-analysis',
  'email-marketing',
  'generate-business-plan',
])

export function isValidTask(task: string): task is GenerateTask {
  return VALID_TASKS.has(task as GenerateTask)
}

const EmailMarketingSchema = z.object({
  subject: z.string().min(1).max(200),
  html_body: z.string().min(1).max(5000),
})

export function validateGenerateOutput(task: GenerateTask, data: unknown) {
  switch (task) {
    case 'generate-protocol':    return ProtocolSchema.parse(data)
    case 'generate-challenge':   return ChallengeSchema.parse(data)
    case 'sales-copy':           return SalesCopySchema.parse(data)
    case 'marketing-suggestion': return MarketingSchema.parse(data)
    case 'checkin-analysis':     return CheckinAnalysisSchema.parse(data)
    case 'email-marketing':      return EmailMarketingSchema.parse(data)
    case 'generate-business-plan': return BusinessPlanSchema.parse(data)
  }
}
