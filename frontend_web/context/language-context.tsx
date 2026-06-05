"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import fr from "@/locales/fr.json"
import en from "@/locales/en.json"

type Lang = "fr" | "en"

type LanguageContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  mounted: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: (k) => k,
  mounted: false,
})

const DICT: Record<Lang, Record<string, any>> = { fr, en }

function lookup(dict: Record<string, any>, key: string) {
  if (dict && typeof dict === 'object' && Object.prototype.hasOwnProperty.call(dict, key)) {
    return typeof dict[key] === 'string' ? dict[key] : null
  }

  const parts = key.split('.')
  let cur: any = dict
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null
    cur = cur[p]
  }
  return typeof cur === 'string' ? cur : null
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("rh_lang")
      if (stored === "en" || stored === "fr") setLangState(stored)
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("rh_lang", lang)
    } catch {}
  }, [lang])

  const setLang = (l: Lang) => setLangState(l)

  const t = (key: string) => {
    const val = lookup(DICT[lang], key)
    if (typeof val === "string") return val
    return key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, mounted }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguageContext() {
  return useContext(LanguageContext)
}

export default LanguageContext
