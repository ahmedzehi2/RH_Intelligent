"use client"

import React from "react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"

export function AppHeader({ title, badge, children }: { title: string; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 justify-between items-center border-b bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm px-6">
      <div className="flex items-center gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {badge}
      </div>

      <div className="flex items-center gap-3">
        {children}
      </div>
    </header>
  )
}

