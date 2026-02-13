import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'link' | 'outline' | 'indigo';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {

        const variants = {
            primary: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] border-none",
            secondary: "bg-white/10 text-slate-200 hover:bg-white/20 border border-white/10",
            indigo: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-900/40 border-none",
            glass: "glass-card text-white hover:bg-white/10",
            ghost: "text-slate-400 hover:text-white hover:bg-white/5",
            outline: "bg-transparent border border-white/10 hover:border-indigo-500/50 text-slate-400 hover:text-white transition-all",
            link: "text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline h-auto p-0"
        }

        const sizes = {
            sm: "h-9 px-4 text-xs font-black uppercase tracking-widest",
            md: "h-11 px-6 text-sm font-bold",
            lg: "h-14 px-8 text-base font-bold",
            xl: "h-16 px-10 text-sm font-black uppercase tracking-widest",
            icon: "h-10 w-10 p-0"
        }

        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"
