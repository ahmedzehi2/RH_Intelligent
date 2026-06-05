import React from "react"

export function EmptyChart({ message = "Aucune donnée disponible" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
      <span className="text-3xl">📭</span>
      <p className="text-xs">{message}</p>
    </div>
  )
}
