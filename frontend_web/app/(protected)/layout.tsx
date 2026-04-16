"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { cn } from "@/lib/utils"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLogged, isHydrated } = useAuth()
  const [collapsed, setCollapsed] = React.useState(false)
  const router = useRouter()

  // REDIRECTION SI NON CONNECTÉ
  useEffect(() => {
    if (isHydrated && !isLogged) {
      router.replace("/")
    }
  }, [isHydrated, isLogged, router])

  // PENDANT L’HYDRATATION
  if (!isHydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isLogged) return null

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* SIDEBAR LEFT - Fixed position */}
      <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN CONTENT - Dynamic margin based on sidebar state */}
      <main 
        className={cn(
          "transition-all duration-300 min-h-screen flex flex-col min-w-0",
          collapsed ? "pl-[70px]" : "pl-[240px]"
        )}
      >
        {children}
      </main>
    </div>
  )
}
