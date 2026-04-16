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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const personalNav = [
  { title: "Mon Espace", href: "/employee/dashboard", icon: User },
  { title: "Mon Pointage", href: "/employee/pointage", icon: Clock },
  { title: "Mes Demandes", href: "/employee/demandes", icon: FileText },
  { title: "Mes Formations", href: "/employee/formations", icon: GraduationCap },
]

const adminNav = [
  { title: "Tableau de bord", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Gestion Employés", href: "/admin/employes", icon: Users },
  { title: "Gestion Pointage", href: "/admin/pointage", icon: Clock },
  { title: "Validations", href: "/admin/validations", icon: CheckSquare },
  { title: "Absences", href: "/admin/absences", icon: UserX },
  { title: "Gestion Formations", href: "/admin/formations", icon: GraduationCap },
  { title: "Statistiques", href: "/admin/stats", icon: BarChart3 },
  { title: "Alertes IA", href: "/admin/alertes", icon: Brain },
]

export function AppSidebar({
  collapsed,
  setCollapsed
}: {
  collapsed: boolean
  setCollapsed: (c: boolean | ((c: boolean) => boolean)) => void
}) {
  const pathname = usePathname()
  const { user, isAdmin, logout } = useAuth()

  const initials = user
    ? `${(user.prenom?.[0] || "").toUpperCase()}${(user.nom?.[0] || "").toUpperCase()}`
    : "?"

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-40 flex flex-col h-screen bg-[#0f172a] border-r border-slate-800",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-[70px]" : "w-[240px]"
      )}
    >
      {/* ── Toggle button ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={cn(
          "absolute -right-3 top-[72px] z-50",
          "w-6 h-6 rounded-full bg-[#0f172a] border border-slate-700 shadow-sm",
          "flex items-center justify-center",
          "text-slate-400 hover:text-blue-400 hover:border-blue-500",
          "transition-colors duration-150"
        )}
        aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />
        }
      </button>

      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center h-16 border-b border-slate-800 shrink-0",
        collapsed ? "justify-center px-3" : "px-4 gap-2.5"
      )}>
        <Link
          href={isAdmin ? "/admin/dashboard" : "/employee/dashboard"}
          className="flex items-center gap-2.5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0066CC]">
            <Image
              src="/images/inet-logo.png"
              alt="Inet"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-100">iNET RH</span>
              <span className="text-[11px] text-slate-500">Gestion Intelligente</span>
            </div>
          )}
        </Link>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {/* Espace Personnel */}
        <NavGroup
          label="Mon Espace"
          items={personalNav}
          collapsed={collapsed}
          isActive={isActive}
        />

        {/* Administration */}
        {isAdmin && (
          <>
            <div className="mx-2 border-t border-slate-800" />
            <NavGroup
              label="Administration"
              items={adminNav}
              collapsed={collapsed}
              isActive={isActive}
            />
          </>
        )}
      </div>

      {/* ── Footer utilisateur ── */}
      <div className={cn(
        "border-t border-slate-800 shrink-0",
        collapsed ? "p-3 flex justify-center" : "p-3"
      )}>
        {collapsed ? (
          /* Avatar seul en mode collapsed + tooltip */
          <div className="relative group">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center
                            text-slate-300 text-xs font-semibold cursor-default">
              {initials}
            </div>
            <div className="absolute left-full ml-3 bottom-0 z-50 whitespace-nowrap
                            bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg
                            opacity-0 group-hover:opacity-100 pointer-events-none
                            transition-opacity duration-150">
              {user?.prenom} {user?.nom}
              <span className="block text-gray-400">{user?.role}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-slate-800 text-slate-300 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-slate-200">
                {user?.prenom} {user?.nom}
              </span>
              <span className="truncate text-xs text-slate-500 capitalize">{user?.role}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="shrink-0 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-400/10
                         rounded-lg transition-colors"
              aria-label="Se déconnecter"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}

/* ─────────────────────────────────────────
   NavGroup — groupe de navigation
───────────────────────────────────────── */
interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

function NavGroup({
  label,
  items,
  collapsed,
  isActive,
}: {
  label: string
  items: NavItem[]
  collapsed: boolean
  isActive: (href: string) => boolean
}) {
  return (
    <div className="space-y-0.5">
      {/* Label groupe — masqué en collapsed */}
      {!collapsed && (
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
      )}

      {items.map(item => (
        <NavItem
          key={item.href}
          item={item}
          active={isActive(item.href)}
          collapsed={collapsed}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────
   NavItem — élément de navigation
───────────────────────────────────────── */
function NavItem({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl text-sm font-medium",
          "transition-all duration-150",
          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
          active
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
        )}
      >
        {/* Icône */}
        <Icon
          className={cn(
            "shrink-0",
            collapsed ? "w-5 h-5" : "w-4 h-4",
            active ? "text-white" : "text-slate-500 group-hover:text-slate-300"
          )}
        />

        {/* Texte — masqué en collapsed */}
        {!collapsed && (
          <span className="flex-1 truncate">{item.title}</span>
        )}

        {/* Point actif */}
        {active && !collapsed && (
          <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
        )}

        {/* Barre active gauche */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5
                           bg-blue-500 rounded-r-full" />
        )}
      </Link>

      {/* Tooltip — visible uniquement en mode collapsed */}
      {collapsed && (
        <div className={cn(
          "absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50",
          "bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap",
          "opacity-0 group-hover:opacity-100 pointer-events-none",
          "transition-opacity duration-150"
        )}>
          {item.title}
          {/* Flèche */}
          <span className="absolute right-full top-1/2 -translate-y-1/2
                           border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  )
}
