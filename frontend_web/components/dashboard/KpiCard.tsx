import React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

export function Trend({ current, previous, inverse = false, suffix = "%" }: {
  current: number; previous: number; inverse?: boolean; suffix?: string
}) {
  const diff = +(current - previous).toFixed(1)
  if (!diff) return null
  const isGood = inverse ? diff < 0 : diff > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(diff)}{suffix}
    </span>
  )
}

function KpiCardComponent({ title, value, subtitle, icon, iconBg, trend, alert, progress }: {
  title: string; value: string | number; subtitle: string
  icon: React.ReactNode; iconBg: string
  trend?: React.ReactNode; alert?: "danger" | "warning" | null
  progress?: number
}) {
  const borderMap = { danger: "border-l-4 border-red-400", warning: "border-l-4 border-orange-400" }
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] ${alert ? borderMap[alert] : "border border-gray-100"}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      {trend && <div className="mb-1">{trend}</div>}
      {progress !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-1 my-2 overflow-hidden">
          <div className={`h-1 rounded-full transition-all duration-700
            ${progress >= 80 ? "bg-emerald-500" : progress >= 60 ? "bg-orange-400" : "bg-red-400"}`}
            style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  )
}

export const KpiCard = React.memo(KpiCardComponent)
