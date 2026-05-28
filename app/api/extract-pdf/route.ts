import { NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const data = await new PDFParse({ data: buffer }).getText()
        const text = data.text

        return NextResponse.json({ text })
    } catch (error: any) {
        console.error('PDF Route Error:', error)
        return NextResponse.json({ error: error.message || 'Erro ao extrair texto do PDF' }, { status: 500 })
    }
}
