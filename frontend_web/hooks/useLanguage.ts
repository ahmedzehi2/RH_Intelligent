"use client"

import { useContext } from "react"
import LanguageContext from "@/context/language-context"

export default function useLanguage() {
  return useContext(LanguageContext)
}
