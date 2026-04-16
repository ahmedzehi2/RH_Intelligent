"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Clock,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  LogOut,
  Brain,
  UserX,
  GraduationCap,
  User,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

// Navigation pour l'espace personnel (accessible a tous)
const personalNav = [
  { title: "Mon Espace", href: "/employee/dashboard", icon: User },
  { title: "Mon Pointage", href: "/employee/pointage", icon: Clock },
  { title: "Mes Demandes", href: "/employee/demandes", icon: FileText },
  { title: "Mes Formations", href: "/employee/formations", icon: GraduationCap },
]

// Navigation admin (gestion globale)
const adminNav = [
  { title: "Tableau de bord", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Gestion Employes", href: "/admin/employes", icon: Users },
  { title: "Gestion Pointage", href: "/admin/pointage", icon: Clock },
  { title: "Validations", href: "/admin/validations", icon: CheckSquare },
  { title: "Absences", href: "/admin/absences", icon: UserX },
  { title: "Gestion Formations", href: "/admin/formations", icon: GraduationCap },
  { title: "Statistiques", href: "/admin/stats", icon: BarChart3 },
  { title: "Alertes IA", href: "/admin/alertes", icon: Brain },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, isAdmin, logout } = useAuth()

  const initials = user ? `${(user.prenom?.[0] || "").toUpperCase()}${(user.nom?.[0] || "").toUpperCase()}` : "?"

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <Link href={isAdmin ? "/admin/dashboard" : "/employee/dashboard"} className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#0066CC]">
            <Image
              src="/images/inet-logo.png"
              alt="Inet"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">iNET RH</span>
            <span className="text-[11px] text-sidebar-foreground/50">Gestion Intelligente</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Espace Personnel - visible pour tous (Employes et Admins) */}
        <SidebarGroup>
          <SidebarGroupLabel>Mon Espace Personnel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Administration - visible uniquement pour les RH */}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.prenom} {user?.nom}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">{user?.role}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={logout}
            className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Se deconnecter"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
