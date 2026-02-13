// Utility to call the Edge Function (com fallback para mock)
import { supabase } from './supabase'

// Mock Generator (desenvolvimento local)
async function generateProtocolMock(prompt: string, duration: number) {
    // Simular delay da API
    await new Promise(resolve => setTimeout(resolve, 2000))

    const categories: Record<string, string> = {
        'detox': 'detox',
        'low carb': 'lowcarb',
        'lowcarb': 'lowcarb',
        'sop': 'challenge',
        'pcos': 'challenge',
        'emagrecer': 'lowcarb',
        'massa': 'custom',
    }

    let category = 'custom'
    for (const [key, val] of Object.entries(categories)) {
        if (prompt.toLowerCase().includes(key)) {
            category = val
            break
        }
    }

    const days = Array.from({ length: duration }).map((_, i) => ({
        day_number: i + 1,
        title: `Dia ${i + 1}: ${getDayTitle(i + 1, duration)}`,
        subtitle: "",
        items: generateDayItems(i + 1, category)
    }))

    return {
        title: generateTitle(prompt, duration),
        description: generateDescription(prompt, category),
        category,
        days
    }
}

function getDayTitle(day: number, total: number) {
    const titles = [
        'Despertar', 'Fortalecimento', 'Transformação', 'Renovação',
        'Energia', 'Equilíbrio', 'Clareza', 'Vitalidade',
        'Purificação', 'Foco', 'Leveza', 'Harmonia',
        'Poder', 'Raiz', 'Expansão', 'Luminosidade',
        'Conexão', 'Sabedoria', 'Realização', 'Celebração'
    ]

    if (day === 1) return 'Despertar'
    if (day === total) return 'Celebração'

    return titles[day % titles.length] || `Meta do Dia ${day}`
}

function generateTitle(prompt: string, duration: number) {
    if (prompt.toLowerCase().includes('detox')) {
        return `Protocolo Detox Renovação ${duration}D`
    }
    if (prompt.toLowerCase().includes('low carb') || prompt.toLowerCase().includes('emagrecer')) {
        return `Protocolo Queima Gordura ${duration}D`
    }
    if (prompt.toLowerCase().includes('sop') || prompt.toLowerCase().includes('pcos')) {
        return `Protocolo Equilíbrio Hormonal ${duration}D`
    }
    return `Protocolo Transformação ${duration}D`
}

function generateDescription(prompt: string, category: string) {
    const descriptions: Record<string, string> = {
        'detox': '🌿 Bem-vinda ao seu protocolo de renovação, Rainha! Prepare-se para despertar sua energia vital e renovar seu corpo de dentro para fora. Nesta jornada de transformação, você vai eliminar toxinas, reenergizar suas células e redescobrir o poder da alimentação consciente. 👑✨',
        'lowcarb': '💪 Este protocolo é sua porta de entrada para um metabolismo acelerado e uma energia estável, Rainha! Vamos reduzir carboidratos estrategicamente enquanto aumentamos gorduras boas e proteínas de qualidade. O resultado? Menos inchaço, mais foco mental e o corpo que você sempre quis. 🔥',
        'challenge': '⚖️ Protocolo de equilíbrio e transformação hormonal! Aqui você vai aprender a honrar seu corpo, fazer escolhas conscientes e criar hábitos que duram para sempre. Cada dia é um passo em direção à sua melhor versão, Rainha! 🌸',
        'custom': '✨ Este protocolo foi criado especialmente para você! Unindo ciência, nutrição e autoconhecimento para te guiar em uma jornada única de transformação. Prepare-se para resultados reais e duradouros! 💎'
    }
    return descriptions[category] || descriptions['custom']
}

function generateDayItems(day: number, category: string) {
    const items = []

    // Shot matinal
    items.push({
        time: '08:00',
        type: 'shot',
        title: day === 1 ? 'Shot Detox Despertar' : `Shot Energizante Dia ${day}`,
        description: 'Água morna (200ml) + suco de 1 limão siciliano + 1 pedaço de gengibre (2cm) + 1 pitada de cúrcuma',
        recipe: 'Misture todos os ingredientes e beba em jejum',
        is_mandatory: true,
        points: 20
    })

    // Café da manhã
    items.push({
        time: '09:00',
        type: 'meal',
        title: 'Café da Manhã Nutritivo',
        description: category === 'lowcarb'
            ? 'Omelete (2 ovos) com espinafre + 1/2 abacate + café sem açúcar'
            : 'Panqueca de aveia (2 colheres) com frutas vermelhas + iogurte natural',
        ingredients: category === 'lowcarb'
            ? ['2 ovos', 'Espinafre', '1/2 abacate', 'Café']
            : ['Aveia', 'Frutas vermelhas', 'Iogurte natural', '1 banana'],
        is_mandatory: true,
        points: 30
    })

    // Almoço
    items.push({
        time: '12:30',
        type: 'meal',
        title: 'Almoço Colorido',
        description: 'Proteína magra (frango, peixe ou tofu) + salada verde abundante + legumes grelhados + azeite extra virgem',
        ingredients: ['Frango grelhado (120g)', 'Alface', 'Tomate', 'Cenoura', 'Brócolis', 'Azeite'],
        is_mandatory: true,
        points: 40
    })

    // Treino (dias alternados)
    if (day % 2 === 1) {
        items.push({
            time: '17:00',
            type: 'workout',
            title: 'Treino HIIT 20min',
            description: '20 minutos de treino intervalado de alta intensidade. Alterne 30s de exercício intenso com 30s de descanso.',
            video_url: null,
            is_mandatory: false,
            points: 50
        })
    } else {
        items.push({
            time: '17:00',
            type: 'workout',
            title: 'Caminhada Energizante',
            description: '30 minutos de caminhada ao ar livre em ritmo moderado',
            video_url: null,
            is_mandatory: false,
            points: 40
        })
    }

    // Jantar
    items.push({
        time: '19:00',
        type: 'meal',
        title: 'Jantar Leve',
        description: 'Sopa de legumes ou salada com proteína magra. Priorize alimentos de fácil digestão.',
        ingredients: ['Caldo de legumes', 'Cenoura', 'Abobrinha', 'Batata-doce', 'Frango desfiado'],
        is_mandatory: true,
        points: 30
    })

    // Conteúdo motivacional
    if (day === 1 || day % 3 === 0) {
        items.push({
            time: null,
            type: 'content',
            title: '💭 Reflexão do Dia',
            description: 'Tire 5 minutos para refletir sobre sua jornada. O que você conquistou hoje? Como se sente? Anote em seu diário de transformação.',
            is_mandatory: false,
            points: 15
        })
    }

    return items
}

export async function generateProtocolWithAI(prompt: string, duration: number) {
    try {
        // Tentar Edge Function primeiro
        const { data, error } = await supabase.functions.invoke('generate-protocol', {
            body: { prompt, duration }
        })

        if (error) {
            console.warn('Edge Function not available, using mock generator:', error)
            // Fallback para mock
            const protocol = await generateProtocolMock(prompt, duration)
            return {
                success: true,
                protocol
            }
        }

        return {
            success: true,
            protocol: data.protocol
        }
    } catch (err: any) {
        console.warn('Error calling Edge Function, using mock generator:', err)
        // Fallback para mock em caso de erro
        try {
            const protocol = await generateProtocolMock(prompt, duration)
            return {
                success: true,
                protocol
            }
        } catch (mockErr: any) {
            return {
                success: false,
                error: mockErr.message || 'Failed to generate protocol'
            }
        }
    }
}
