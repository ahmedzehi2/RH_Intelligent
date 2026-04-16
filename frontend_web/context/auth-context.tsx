"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

export type UserRole = "EMPLOYEE" | "RH"

export type UserProfile = {
  user_id: number
  employe_id: number | null
  username: string
  role: UserRole
  nom?: string
  prenom?: string
  email?: string
}

type AuthContextType = {
  user: UserProfile | null
  isLogged: boolean
  isAdmin: boolean
  isHydrated: boolean
  login: (u: UserProfile) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLogged: false,
  isAdmin: false,
  isHydrated: false,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()

  // Hydrate from localStorage AFTER mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rh_user")
      if (raw) {
        setUser(JSON.parse(raw) as UserProfile)
      }
    } catch {
      // ignore parse errors
    }
    setIsHydrated(true)
  }, [])

  const login = useCallback((u: UserProfile) => {
    setUser(u)
    try {
      localStorage.setItem("rh_user", JSON.stringify(u))
    } catch {
      // storage full or unavailable
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try {
      localStorage.removeItem("rh_user")
    } catch {
      // ignore
    }
    router.replace("/")
  }, [router])

  const isAdmin = user?.role === "RH"

  return (
    <AuthContext.Provider value={{ user, isLogged: !!user, isAdmin, isHydrated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
