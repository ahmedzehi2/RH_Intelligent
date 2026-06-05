import React from "react"

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="w-9 h-9 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-7 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-1 bg-gray-100 rounded-full mb-2" />
          <div className="h-3 bg-gray-100 rounded w-32" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <div className={`col-span-12 lg:col-span-${cols} bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse`}>
      <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-56 mb-4" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )
}

export function IAInsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse space-y-3">
        <div className="flex justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-6 bg-gray-100 rounded-full w-28" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="space-y-1 text-right">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-2.5 bg-gray-100 rounded w-10" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-40 mb-6" />
        <div className="flex gap-2 items-end h-32">
          {["h-1/4","h-3/4","h-2/4","h-full","h-2/3"].map((h,i) => (
            <div key={i} className={`flex-1 ${h} bg-gray-200 rounded-md`} />
          ))}
        </div>
      </div>
    </div>
  )
}
