"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"

// شوف مليح: هذوما الاستيرادات الصحيحة
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLogged, isHydrated } = useAuth()
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
    <SidebarProvider>
      {/* SIDEBAR LEFT */}
      <AppSidebar />

      {/* MAIN CONTENT */}
      <SidebarInset>
        {/* IMPORTANT ⚠️:
            AppHeader يجب أن يكون داخل كل صفحة (page.tsx)
            وليس هنا! */}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
