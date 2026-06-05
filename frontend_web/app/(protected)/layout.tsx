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
    <div className="h-screen bg-gray-50/50 flex overflow-hidden">
      {/* SIDEBAR LEFT - Fixed position */}
      <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN CONTENT - Scrollable area with dynamic left padding for sidebar */}
      <main 
        className={cn(
          "flex-1 overflow-y-auto transition-all duration-300 min-w-0",
          collapsed ? "ml-[70px]" : "ml-[280px]"
        )}
      >
        {children}
      </main>
    </div>
  )
}
