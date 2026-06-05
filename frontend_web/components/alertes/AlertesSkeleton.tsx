// frontend_web/components/alertes/AlertesSkeleton.tsx

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export function AlertesSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-12">
      <AppHeader title="Centre de Surveillance RH" />
      <div className="max-w-[1600px] mx-auto px-6 pt-6 grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start animate-pulse">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 bg-slate-200/50 rounded-lg" />
              <Skeleton className="h-4 w-96 bg-slate-200/50 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 bg-slate-100/50 rounded-2xl" />
            ))}
          </div>
          <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-6">
            <Skeleton className="h-44 w-full rounded-2xl bg-slate-100/50" />
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-6">
              <Skeleton className="h-40 w-full rounded-xl bg-slate-100/50" />
            </Card>
            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-6">
              <Skeleton className="h-40 w-full rounded-xl bg-slate-100/50" />
            </Card>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 h-[720px] flex flex-col justify-between">
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3 bg-slate-200/50 rounded-lg" />
            <Skeleton className="h-28 w-full bg-slate-100/50 rounded-2xl" />
            <Skeleton className="h-28 w-full bg-slate-100/50 rounded-2xl" />
          </div>
          <Skeleton className="h-12 w-full bg-slate-100/50 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
