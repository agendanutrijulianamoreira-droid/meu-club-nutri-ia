import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'

export function useStorage() {
    const [uploading, setUploading] = useState(false)

    const uploadImage = async (file: File, path: string) => {
        try {
            setUploading(true)

            // Gerar nome único para o arquivo
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${path}/${fileName}`

            const { error: uploadError, data } = await supabase.storage
                .from('assets')
                .upload(filePath, file)

            if (uploadError) {
                if (uploadError.message.includes('Bucket not found')) {
                    throw new Error('O bucket "assets" não foi encontrado. Por favor, crie um bucket público chamado "assets" no seu painel do Supabase Storage ou execute a migração SQL.')
                }
                throw uploadError
            }

            // Pegar a URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath)

            return { url: publicUrl, error: null }
        } catch (err: any) {
            console.error('Error uploading image:', err)
            return { url: null, error: err.message }
        } finally {
            setUploading(false)
        }
    }

    return {
        uploading,
        uploadImage
    }
}
