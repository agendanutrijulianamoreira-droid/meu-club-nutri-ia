"use client"

import { createContext, useContext, useState, useEffect } from "react"

// MOCK AUTH CONTEXT - Sempre logado como Admin para desenvolvimento
type AuthContextType = {
    user: any
    profile: any
    loading: boolean
    signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
    user: { id: 'mock-id', email: 'nutri@admin.com' },
    profile: { role: 'admin', full_name: 'Nutri Poderosa' },
    loading: false,
    signOut: () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // Simula um loading rápido só para não piscar
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500)
        return () => clearTimeout(timer)
    }, [])

    const mockUser = { id: 'mock-id', email: 'nutri@admin.com' }
    const mockProfile = { role: 'admin', full_name: 'Nutri Poderosa', avatar_url: 'https://api.dicebear.com/9.x/micah/svg?seed=Nutri' }

    return (
        <AuthContext.Provider value={{
            user: mockUser,
            profile: mockProfile,
            loading,
            signOut: () => { window.location.href = "/" }
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
