import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { PDFParse } from 'pdf-parse'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

interface ClassifiedItem {
  type: 'recipe' | 'protocol' | 'challenge' | 'goal' | 'meal_plan' | 'notification_template'
  title: string
  data: Record<string, any>
}

interface ClassificationResult {
  detected_type: string
  ai_summary: string
  ai_tags: string[]
  items: ClassifiedItem[]
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let docId: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const hint = (formData.get('hint') as string) || ''

    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    // Extract text from file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let extractedText = ''

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const pdfData = await new PDFParse({ data: buffer }).getText()
        extractedText = pdfData.text || ''
      } else {
        extractedText = buffer.toString('utf-8')
      }
    } catch {
      return NextResponse.json({ error: 'Não foi possível extrair texto do arquivo. Verifique se o PDF não está protegido.' }, { status: 400 })
    }

    if (extractedText.trim().length < 30) {
      return NextResponse.json({ error: 'O arquivo parece estar vazio ou em formato não suportado.' }, { status: 400 })
    }

    // Upload to Supabase Storage (library bucket)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${tenant.id}/${Date.now()}_${safeName}`
    let fileUrl = ''

    const { data: uploadData } = await supabase.storage
      .from('library')
      .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (uploadData?.path) {
      const { data: urlData } = supabase.storage.from('library').getPublicUrl(uploadData.path)
      fileUrl = urlData?.publicUrl || ''
    }

    // Create document record in pending state
    const { data: doc } = await supabase
      .from('library_documents')
      .insert({
        tenant_id: tenant.id,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        description: hint,
        user_hint: hint,
        file_url: fileUrl,
        file_name: file.name,
        file_type: 'pdf',
        file_size_bytes: file.size,
        extracted_text: extractedText.substring(0, 15000),
        status: 'processing',
        uploaded_by: user.id,
      })
      .select('id')
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Erro ao registrar documento' }, { status: 500 })
    }
    docId = doc.id

    // Classify with Gemini AI
    const classifyPrompt = `Você é um assistente especializado em nutrição clínica. Analise o conteúdo extraído de um documento e classifique-o em categorias para um sistema de saúde.

DESCRIÇÃO FORNECIDA PELA USUÁRIA:
${hint || '(não fornecida)'}

CONTEÚDO DO DOCUMENTO:
${extractedText.substring(0, 8000)}

Retorne um JSON estruturado exatamente neste formato (sem texto extra):

{
  "detected_type": "recipe|protocol|challenge|goal|meal_plan|notification_template|mixed|educational",
  "ai_summary": "resumo de 2-3 frases do conteúdo",
  "ai_tags": ["tag1", "tag2", "tag3"],
  "items": [
    {
      "type": "recipe|protocol|challenge|goal|meal_plan|notification_template",
      "title": "título do item",
      "data": {
        // Para recipe:
        // description, emoji, category (uma de: café da manhã|lanche|almoço|jantar|sobremesa|shot|bebida|refeição),
        // dietary_tags (array), prep_time_min (número), servings (número),
        // ingredients (array de {name, quantity}), instructions (texto), calories (número)

        // Para protocol:
        // description, emoji, category (uma de: detox|lowcarb|maintenance|challenge|seasonal|custom),
        // duration_days (número), content (array de {day, title, tasks: [string]})

        // Para challenge:
        // description, emoji, duration_days (número), prize_pool_coins (número), rewards_json (array)

        // Para goal (protocolo de hábito, 7 dias):
        // description, emoji, content (array de {day, title, tasks: [string]})

        // Para meal_plan:
        // description, goal, duration_days, target_kcal, tags (array),
        // items (array de {day_number, meal_type (cafe_manha|lanche_manha|almoco|lanche_tarde|jantar|ceia|shot),
        //   meal_label, food_name, quantity_g, serving_qty, serving_label, preparation_notes})

        // Para notification_template:
        // message, tip_content, category (upsell|engagement|milestone|educational|general),
        // trigger_event, cta_text
      }
    }
  ]
}

REGRAS:
- Extraia TODOS os itens distintos do documento
- Se o documento tiver múltiplos tipos, coloque todos em "items"
- Seja fiel ao conteúdo — não invente informações ausentes
- category de recipe DEVE ser uma das opções listadas
- category de protocol DEVE ser uma das opções listadas
- meal_type DEVE ser um de: cafe_manha|lanche_manha|almoco|lanche_tarde|jantar|ceia|shot`

    const geminiResp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: classifyPrompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })

    if (!geminiResp.ok) {
      const errBody = await geminiResp.text()
      console.error('[LibraryUpload] Gemini error:', errBody)
      throw new Error('Falha na classificação por IA')
    }

    const geminiData = await geminiResp.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const classified: ClassificationResult = JSON.parse(clean)

    // Distribute items to appropriate tables
    const itemsCreated: Array<{ table: string; id: string; title: string }> = []

    for (const item of (classified.items || [])) {
      try {
        switch (item.type) {
          case 'recipe': {
            const { data: r } = await supabase.from('recipes').insert({
              tenant_id: tenant.id,
              title: item.title,
              description: item.data.description || null,
              emoji: item.data.emoji || '🍽️',
              category: item.data.category || 'refeição',
              dietary_tags: item.data.dietary_tags || [],
              prep_time_min: item.data.prep_time_min || null,
              servings: item.data.servings || 1,
              ingredients: item.data.ingredients || [],
              instructions: item.data.instructions || '',
              calories: item.data.calories || null,
              is_ai_generated: true,
              access_tier: 'basic',
            }).select('id').single()
            if (r) itemsCreated.push({ table: 'recipes', id: r.id, title: item.title })
            break
          }

          case 'protocol': {
            const { data: p } = await supabase.from('protocols').insert({
              tenant_id: tenant.id,
              title: item.title,
              description: item.data.description || null,
              emoji: item.data.emoji || '📋',
              category: item.data.category || 'custom',
              duration_days: item.data.duration_days || 21,
              content: item.data.content || [],
              is_active: true,
              is_public: false,
            }).select('id').single()
            if (p) itemsCreated.push({ table: 'protocols', id: p.id, title: item.title })
            break
          }

          case 'goal': {
            const { data: g } = await supabase.from('protocols').insert({
              tenant_id: tenant.id,
              title: item.title,
              description: item.data.description || null,
              emoji: item.data.emoji || '🎯',
              category: 'custom',
              duration_days: 7,
              content: item.data.content || [],
              is_active: true,
              is_public: false,
            }).select('id').single()
            if (g) itemsCreated.push({ table: 'protocols', id: g.id, title: item.title })
            break
          }

          case 'challenge': {
            const { data: c } = await supabase.from('challenges').insert({
              tenant_id: tenant.id,
              title: item.title,
              description: item.data.description || null,
              emoji: item.data.emoji || '🏆',
              duration_days: item.data.duration_days || 7,
              is_active: false,
              prize_pool_coins: item.data.prize_pool_coins || 500,
              rewards_json: item.data.rewards_json || [],
            }).select('id').single()
            if (c) itemsCreated.push({ table: 'challenges', id: c.id, title: item.title })
            break
          }

          case 'meal_plan': {
            const { data: mp } = await supabase.from('meal_plans').insert({
              tenant_id: tenant.id,
              created_by: user.id,
              title: item.title,
              description: item.data.description || null,
              goal: item.data.goal || null,
              duration_days: item.data.duration_days || 1,
              target_kcal: item.data.target_kcal || null,
              status: 'draft',
              is_ai_generated: true,
              tags: item.data.tags || [],
            }).select('id').single()

            if (mp) {
              const mealItems = (item.data.items || []).map((mi: any, idx: number) => ({
                meal_plan_id: mp.id,
                day_number: mi.day_number || 1,
                meal_type: mi.meal_type || 'almoco',
                meal_label: mi.meal_label || item.title,
                sort_order: idx + 1,
                food_name: mi.food_name || null,
                quantity_g: mi.quantity_g || null,
                serving_qty: mi.serving_qty || null,
                serving_label: mi.serving_label || null,
                preparation_notes: mi.preparation_notes || null,
              }))
              if (mealItems.length > 0) {
                await supabase.from('meal_plan_items').insert(mealItems)
              }
              itemsCreated.push({ table: 'meal_plans', id: mp.id, title: item.title })
            }
            break
          }

          case 'notification_template': {
            const { data: n } = await supabase.from('notification_templates').insert({
              tenant_id: tenant.id,
              title: item.title,
              message: item.data.message || '',
              tip_content: item.data.tip_content || null,
              category: item.data.category || 'general',
              trigger_event: item.data.trigger_event || null,
              cta_text: item.data.cta_text || null,
              is_template: false,
            }).select('id').single()
            if (n) itemsCreated.push({ table: 'notification_templates', id: n.id, title: item.title })
            break
          }
        }
      } catch (itemErr) {
        console.error('[LibraryUpload] Error creating item:', item.title, itemErr)
      }
    }

    // Update document record with results
    await supabase.from('library_documents').update({
      status: 'distributed',
      detected_type: classified.detected_type,
      ai_summary: classified.ai_summary,
      ai_tags: classified.ai_tags || [],
      extracted_content: classified,
      items_created: itemsCreated,
      processed_at: new Date().toISOString(),
    }).eq('id', docId)

    return NextResponse.json({
      success: true,
      document_id: docId,
      detected_type: classified.detected_type,
      ai_summary: classified.ai_summary,
      ai_tags: classified.ai_tags || [],
      items_created: itemsCreated,
    })
  } catch (error: any) {
    console.error('[LibraryUpload]', error)
    if (docId) {
      await supabase.from('library_documents').update({
        status: 'error',
        error_message: error?.message || 'Erro interno',
      }).eq('id', docId)
    }
    return NextResponse.json({ error: error?.message || 'Erro interno ao processar arquivo' }, { status: 500 })
  }
}
