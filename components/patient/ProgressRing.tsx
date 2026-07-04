"use client"

import type { ReactNode } from "react"

interface ProgressRingProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color: string
  trackColor?: string
  children?: ReactNode
}

export function ProgressRing({ value, max, size = 56, strokeWidth = 5, color, trackColor = "rgba(255,255,255,0.08)", children }: ProgressRingProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
