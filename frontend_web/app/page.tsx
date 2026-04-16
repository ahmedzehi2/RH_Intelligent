"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Lock, Mail, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useAuth, type UserProfile } from "@/context/auth-context"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ApiUser = {
  user_id?: number
  id?: number
  employe_id?: number | null
  username: string
  role: "EMPLOYEE" | "RH"
  nom?: string
  prenom?: string
  email?: string
  adresse_mail?: string
}

function normalizeUser(apiUser: ApiUser): UserProfile {
  let role: "EMPLOYEE" | "RH" = "EMPLOYEE"
  if (apiUser.role === "RH") {
    role = "RH"
  }
  return {
    user_id: apiUser.user_id ?? apiUser.id ?? 0,
    employe_id: typeof apiUser.employe_id === "number" ? apiUser.employe_id : null,
    username: apiUser.username,
    role,
    nom: apiUser.nom,
    prenom: apiUser.prenom,
    email: apiUser.email ?? apiUser.adresse_mail,
  }
}

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error("Veuillez remplir tous les champs")
      return
    }
    setLoading(true)

    try {
      const data = await authApi.login(email, password)

      if (!data?.ok) {
        toast.error(data?.error || "Identifiants incorrects")
        return
      }

      const profile = normalizeUser(data.user as unknown as ApiUser)
      login(profile)
      toast.success(`Bienvenue ${profile.prenom || ""} ${profile.nom || ""} !`)

      if (profile.role === "EMPLOYEE") {
        router.replace("/employee/dashboard")
      } else {
        router.replace("/admin/dashboard")
      }
    } catch {
      toast.error("Impossible de se connecter au serveur. Verifiez que le backend FastAPI est lance.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh">
      {/* Left Panel - Blue Background */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center bg-[#0066CC] lg:flex">
        {/* Wave decoration */}
        <div className="absolute inset-y-0 right-0 w-24">
          <svg
            viewBox="0 0 100 800"
            preserveAspectRatio="none"
            className="h-full w-full"
            fill="white"
          >
            <path d="M100,0 L100,800 L0,800 C30,700 10,600 40,500 C70,400 20,300 50,200 C80,100 30,50 60,0 Z" />
          </svg>
        </div>
        
        {/* Content */}
        <div className="z-10 flex flex-col items-center gap-6 px-12 text-center">
          <p className="text-2xl font-light text-white/90">Bienvenue sur</p>
          
          <Image
            src="/images/inet-logo.png"   
            alt="Inet"
            width={200}
            height={100}
            className="drop-shadow-lg"
            style={{ width: "200 ", height: "100" }}
            priority
          />
          
          <h1 className="text-4xl font-bold text-white">RH Intelligente</h1>
        </div>

      </div>

      {/* Right Panel - White Background with Form */}
      <div className="flex w-full flex-col items-center justify-center bg-white p-8 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
          <Image
            src="/images/inet-logo.png"
            alt="Inet"
            width={100}
            height={100}
            style={{ width: "auto", height: "auto" }}
            priority
          />
          <h1 className="text-2xl font-bold text-gray-900">RH Intelligente</h1>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Connexion</h2>
            <p className="mt-2 text-sm text-gray-500">Entrez vos identifiants pour acceder a votre espace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">Email ou identifiant</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="text"
                  placeholder="prenom.nom@inet.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-gray-200 bg-gray-50 pl-11 text-gray-900 placeholder:text-gray-400 focus:border-[#0066CC] focus:bg-white focus:ring-[#0066CC]"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-200 bg-gray-50 pl-11 pr-11 text-gray-900 placeholder:text-gray-400 focus:border-[#0066CC] focus:bg-white focus:ring-[#0066CC]"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="h-12 w-full bg-[#0066CC] text-base font-semibold hover:bg-[#0055AA]" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Connexion...
                </span>
              ) : (
                "Se connecter"
              )}
            </Button>

            <p className="mt-6 text-center text-sm text-gray-500">
              Contactez votre administrateur RH si vous avez oublie vos identifiants.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
