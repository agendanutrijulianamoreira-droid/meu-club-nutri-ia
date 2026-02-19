"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function SetupWizardPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/admin/clinic')
    }, [router])

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
    )
}
