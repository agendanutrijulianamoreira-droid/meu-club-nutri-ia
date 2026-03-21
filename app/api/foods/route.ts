import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/foods?q=frango&category=Carnes&limit=20
 * Busca alimentos na base TACO/TBCA com fuzzy search
 */
export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const category = url.searchParams.get('category')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

    let query = supabase
        .from('foods')
        .select('id, name, category, source, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, serving_size_g, serving_label, calcium_mg, iron_mg, sodium_mg, vitamin_c_mg')
        .eq('is_active', true)
        .limit(limit)

    if (q.length >= 2) {
        // Fuzzy search usando pg_trgm
        const normalized = q.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        query = query.ilike('name_search', `%${normalized}%`)
    }

    if (category) {
        query = query.eq('category', category)
    }

    query = query.order('name')

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        foods: data || [],
        total: data?.length || 0,
    })
}

/**
 * GET /api/foods/categories
 * Lista categorias disponíveis
 */
