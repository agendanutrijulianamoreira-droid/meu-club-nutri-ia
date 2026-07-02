import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Rota pública (sem auth) para a landing page de venda avulsa de um protocolo sazonal.
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const admin = getSupabaseAdmin()

  const { data: protocol, error } = await admin
    .from('protocols')
    .select(`
      id, title, description, goals, duration_days, cover_image_url,
      sales_headline, sales_description, standalone_price_cents, standalone_slug,
      tenant_id,
      protocol_days(day_number, title, protocol_items(type, title, description, image_url, order_index))
    `)
    .eq('standalone_slug', params.slug)
    .eq('is_standalone', true)
    .single()

  if (error || !protocol) {
    return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name:brand_name, logo_url, brand_color, slug')
    .eq('id', protocol.tenant_id)
    .single()

  const days = (protocol.protocol_days || [])
    .sort((a: any, b: any) => a.day_number - b.day_number)
    .map((d: any) => ({
      day_number: d.day_number,
      title: d.title,
      items: (d.protocol_items || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((i: any) => ({ type: i.type, title: i.title, description: i.description, image_url: i.image_url })),
    }))

  return NextResponse.json({
    protocol: {
      id: protocol.id,
      title: protocol.title,
      description: protocol.description,
      goals: protocol.goals || [],
      duration_days: protocol.duration_days,
      cover_image_url: protocol.cover_image_url,
      sales_headline: protocol.sales_headline,
      sales_description: protocol.sales_description,
      price_cents: protocol.standalone_price_cents,
      days,
    },
    tenant,
  })
}
