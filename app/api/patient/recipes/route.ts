import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET: receitas da paciente, filtradas pelas suas restrições e plano
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, current_plan, dietary_restrictions')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')

  // Plano premium libera receitas premium
  const isPremium = ['vip', 'tech_diet'].includes(profile.current_plan || '')

  let query = supabase.from('recipes')
    .select('id, title, description, emoji, category, dietary_tags, prep_time_min, servings, ingredients, instructions, substitutions, calories, protein_g, carbs_g, fat_g, access_tier, is_ai_generated, created_at')
    .eq('tenant_id', profile.tenant_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // Plano básico só vê receitas básicas
  if (!isPremium) query = query.eq('access_tier', 'basic')

  if (category) query = query.eq('category', category)
  if (tag) query = query.contains('dietary_tags', [tag])

  const { data: recipes, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-filtrar pelas restrições da paciente
  // Receitas SEM tag de restrição aparecem para todos.
  // Receitas COM tag de restrição só aparecem se a paciente tiver essa restrição.
  const restrictions: string[] = profile.dietary_restrictions || []
  const filtered = (recipes || []).filter((r: any) => {
    if (!r.dietary_tags?.length) return true
    return r.dietary_tags.some((t: string) => restrictions.includes(t))
  })

  return NextResponse.json({
    recipes: filtered,
    is_premium: isPremium,
    restrictions,
  })
}
