import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/meal-plans/[id]/substitutions
 * Retorna alimentos substitutos compatíveis para um item do plano alimentar
 * Query params: ?meal_item_id=uuid&category=carboidrato&calories=130
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const mealItemId = searchParams.get('meal_item_id')
  const categoryOverride = searchParams.get('category')
  const originalCalories = searchParams.get('calories')

  let category = categoryOverride
  let caloriesValue = originalCalories ? parseFloat(originalCalories) : null
  let originalFoodName: string | null = null

  // If meal_item_id provided, fetch item details from meal_items or meal_plan_items
  if (mealItemId) {
    // Try premium meal_items first
    const { data: premiumItem } = await supabase
      .from('meal_items')
      .select('food_name, calories, category')
      .eq('id', mealItemId)
      .single()

    if (premiumItem) {
      originalFoodName = premiumItem.food_name
      if (!category && (premiumItem as any).category) category = (premiumItem as any).category
      if (!caloriesValue && premiumItem.calories) caloriesValue = premiumItem.calories
    } else {
      // Fallback to legacy meal_plan_items
      const { data: legacyItem } = await supabase
        .from('meal_plan_items')
        .select('food_name, calc_kcal')
        .eq('id', mealItemId)
        .single()

      if (legacyItem) {
        originalFoodName = legacyItem.food_name
        if (!caloriesValue && legacyItem.calc_kcal) caloriesValue = legacyItem.calc_kcal
      }
    }
  }

  // Query substitutable_foods: global or tenant-owned, filtered by category if available
  // Caloric difference filter: < 20% absolute difference
  let query = supabase
    .from('substitutable_foods')
    .select('*')
    .or(`is_global.eq.true,tenant_id.eq.${tenant.id}`)

  if (category) {
    query = query.eq('category', category)
  }

  if (originalFoodName) {
    query = query.eq('original_food', originalFoodName)
  }

  const { data: allSubstitutes, error } = await query.order('caloric_difference_pct').limit(20)

  if (error) {
    console.error('[substitutions GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by caloric difference < 20% if we have a calories value and no exact food match
  let substitutes = allSubstitutes || []
  if (caloriesValue && !originalFoodName && substitutes.length > 0) {
    substitutes = substitutes.filter(s => {
      if (!s.original_calories) return true
      const diff = Math.abs((s.original_calories - caloriesValue!) / caloriesValue!) * 100
      return diff < 30 // Allow up to 30% difference in caloric baseline
    })
  }

  // If no exact food match, return category-based suggestions
  if (substitutes.length === 0 && category) {
    const { data: fallback } = await supabase
      .from('substitutable_foods')
      .select('*')
      .or(`is_global.eq.true,tenant_id.eq.${tenant.id}`)
      .eq('category', category)
      .order('caloric_difference_pct')
      .limit(10)

    substitutes = fallback || []
  }

  return NextResponse.json({
    original_food: originalFoodName,
    original_calories: caloriesValue,
    category,
    substitutes,
    count: substitutes.length,
  })
}
