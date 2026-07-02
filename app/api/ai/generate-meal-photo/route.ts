import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateFoodImage } from '@/lib/services/anthropic'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Título da refeição é obrigatório' }, { status: 400 })

  const prompt = `Foto profissional de comida em estilo fotografia culinária (food photography), luz natural, fundo neutro claro, vista de cima ou 45 graus: "${title}"${description ? ` — ${description}` : ''}. Realista, apetitosa, sem texto na imagem.`

  const image = await generateFoodImage(prompt)
  if (!image) {
    return NextResponse.json({ error: 'Não foi possível gerar a foto agora. Tente novamente ou envie uma foto manualmente.' }, { status: 502 })
  }

  try {
    const admin = getSupabaseAdmin()
    const ext = image.mimeType.split('/')[1] || 'png'
    const fileName = `meal-plans/${tenant.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(image.base64, 'base64')

    const { error: uploadError } = await admin.storage
      .from('assets')
      .upload(fileName, buffer, { contentType: image.mimeType, upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = admin.storage.from('assets').getPublicUrl(fileName)
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: any) {
    console.error('[generate-meal-photo] upload error', err)
    return NextResponse.json({ error: 'Foto gerada, mas houve erro ao salvar. Tente novamente.' }, { status: 500 })
  }
}
