import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buscarProdutoPorEAN } from '@/lib/services/openFoodFacts'
import { avaliarProduto } from '@/lib/config/ingredientesProblematicos'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const ean = (url.searchParams.get('ean') || '').trim()
    if (!ean) return NextResponse.json({ error: 'EAN obrigatório' }, { status: 400 })

    const { data: cached } = await supabase
        .from('cache_produtos_barcode')
        .select('*')
        .eq('ean', ean)
        .maybeSingle()

    let produto = cached

    if (!produto) {
        const resultado = await buscarProdutoPorEAN(ean)
        if (!resultado) {
            return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
        }

        const { data: inserted } = await supabase
            .from('cache_produtos_barcode')
            .insert({
                ean,
                nome: resultado.nome,
                marca: resultado.marca,
                ingredientes: resultado.ingredientes,
                dados_nutricionais: {
                    energia_kcal: resultado.energia_kcal,
                    proteina: resultado.proteina,
                    carboidrato: resultado.carboidrato,
                    gordura: resultado.gordura,
                    sodio: resultado.sodio,
                    fibra: resultado.fibra,
                    acucares: resultado.acucares,
                    nutriscore: resultado.nutriscore,
                },
                imagem_url: resultado.imagem,
            })
            .select('*')
            .single()

        produto = inserted
    }

    if (!produto) return NextResponse.json({ error: 'Erro ao processar produto' }, { status: 500 })

    const avaliacao = avaliarProduto(produto.ingredientes || '')

    return NextResponse.json({
        ean: produto.ean,
        nome: produto.nome,
        marca: produto.marca,
        ingredientes: produto.ingredientes,
        dados_nutricionais: produto.dados_nutricionais,
        imagem_url: produto.imagem_url,
        avaliacao,
    })
}
