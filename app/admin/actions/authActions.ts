"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

export async function signOutAction() {
    const supabase = createSupabaseServerClient(cookies())
    await supabase.auth.signOut()
}
