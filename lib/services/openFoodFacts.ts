export interface ProdutoOpenFoodFacts {
    nome: string
    marca: string
    ingredientes: string
    energia_kcal: number | null
    proteina: number | null
    carboidrato: number | null
    gordura: number | null
    sodio: number | null
    fibra: number | null
    acucares: number | null
    nutriscore: string | null
    imagem: string | null
}

export async function buscarProdutoPorEAN(ean: string): Promise<ProdutoOpenFoodFacts | null> {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json`)
    if (!res.ok) {
        throw new Error(`Open Food Facts retornou status ${res.status} para EAN ${ean}`)
    }

    const data = await res.json()
    if (data.status === 0 || !data.product) return null

    const p = data.product
    const n = p.nutriments || {}

    return {
        nome: p.product_name || p.product_name_pt || 'Produto sem nome',
        marca: p.brands || '',
        ingredientes: p.ingredients_text_pt || p.ingredients_text || '',
        energia_kcal: n['energy-kcal_100g'] ?? null,
        proteina: n.proteins_100g ?? null,
        carboidrato: n.carbohydrates_100g ?? null,
        gordura: n.fat_100g ?? null,
        sodio: n.sodium_100g ?? null,
        fibra: n.fiber_100g ?? null,
        acucares: n.sugars_100g ?? null,
        nutriscore: p.nutriscore_grade || null,
        imagem: p.image_url || null,
    }
}
