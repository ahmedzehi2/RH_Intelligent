"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import useSWR from "swr"
import { swrFetcher } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import { 
  Bot, 
  Send, 
  Trash2, 
  X, 
  MessageSquare, 
  AlertTriangle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

// Interface Message
interface ChatMessage {
  id:        string
  role:      "user" | "assistant"
  content:   string
  timestamp: Date
}

export function HRChatWidget() {
  const [isOpen, setIsOpen]       = useState(false)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Période 30 jours glissants pour le contexte
  const fin   = useMemo(() => new Date().toISOString().split("T")[0], [])
  const debut = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0], [])
  const qp    = useMemo(() => `date_debut=${debut}&date_fin=${fin}`, [debut, fin])

  // 2. Fetching SWR
  const { data: todayData }    = useSWR<any>("/rh/today-status", swrFetcher)
  const { data: presenceData } = useSWR<any>(`/stats/rh/presence-absence?${qp}`, swrFetcher)
  const { data: deptData }     = useSWR<any>(`/stats/rh/absences-dept?${qp}`, swrFetcher)

  // 3. Construction rhContext
  const rhContext = useMemo(() => {
    if (!todayData && !presenceData) return null
    
    // Calcul des statistiques départementales équivalent et robuste
    const stats_departements = deptData?.series?.map((dept: string) => {
      const rows = deptData?.data ?? []
      const total = rows.reduce((sum: number, row: any) => sum + (Number(row[dept]) || 0), 0)
      const taux = Math.round(total / Math.max(rows.length, 1))
      return {
        departement: dept,
        taux_absence: taux
      }
    }) ?? []

    return {
      periode: { debut, fin },
      total_employes: presenceData?.total_employees ?? 0,
      statistiques: {
        presents:        presenceData?.presents        ?? 0,
        absents:         presenceData?.absents         ?? 0,
        a_l_heure:       presenceData?.a_l_heure       ?? 0,
        retards:         presenceData?.retards         ?? 0,
        absences_injust: presenceData?.aucun_pointage  ?? 0,
        retard_moy_min:  presenceData?.retard_moyen_min ?? 0,
      },
      alertes_jour:       todayData?.alertes ?? [],
      insight_ia:         todayData?.insight_ia ?? "",
      stats_departements
    }
  }, [todayData, presenceData, deptData, debut, fin])

  // 4. Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  // 5. Suggestions
  const QUICK_SUGGESTIONS = [
    "Combien d'absences ce mois ?",
    "Quel département a le plus de retards ?",
    "Générer un résumé RH du jour",
    "Quels employés nécessitent une intervention ?",
    "Recommandations pour réduire l'absentéisme",
    "Comparer la ponctualité par département",
  ]

  // 6. Action d'envoi
  const sendMessage = async (overrideContent?: string) => {
    const textToSend = (overrideContent ?? input).trim()
    if (!textToSend || isLoading) return

    const userMsg: ChatMessage = {
      id:        crypto.randomUUID(),
      role:      "user",
      content:   textToSend,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    if (!overrideContent) {
      setInput("")
    }
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role:    m.role,
            content: m.content
          })),
          rhContext
        })
      })

      const data = await res.json()
      
      const assistantMsg: ChatMessage = {
        id:        crypto.randomUUID(),
        role:      "assistant",
        content:   data.reply ?? "Désolé, une erreur est survenue.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        id:        crypto.randomUUID(),
        role:      "assistant",
        content:   "Service IA temporairement indisponible. Veuillez réessayer.",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Vérification alerte critique aujourd'hui
  const hasCriticalAlerts = useMemo(() => {
    return todayData?.alertes?.some((a: any) => a.niveau === "Critique")
  }, [todayData])

  const clearHistory = () => {
    setMessages([])
  }

  return (
    <>
      {/* ── FLOAT BUTTON ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-2xl bg-indigo-600 text-white shadow-2xl hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer"
        aria-label="Ouvrir le chat HR Copilot"
      >
        {isOpen ? <X className="size-6 animate-in fade-in duration-200" /> : <Bot className="size-6 animate-in fade-in duration-200" />}
        
        {/* Badge critique */}
        {!isOpen && hasCriticalAlerts && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center animate-pulse">
            !
          </span>
        )}
      </button>

      {/* ── CHAT PANEL ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[560px] sm:w-[420px] bg-white rounded-3xl border border-slate-200/60 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl text-white flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  ARIA Assistant RH
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                </h3>
                <span className="text-[10px] text-white/70">En ligne</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-white/60 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Vider l'historique"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Area Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between py-2">
                <div className="flex flex-col items-center justify-center text-center mt-12 px-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                    <Bot className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Bienvenue chez ARIA Assistant RH</h4>
                  <p className="text-xs text-slate-500 max-w-[280px]">
                    Je suis connecté en direct aux statistiques d'assiduité, aux anomalies et aux départements. Que souhaitez-vous analyser ?
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-2 px-1">
                    Suggestions rapides
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(s)}
                        className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-600 cursor-pointer hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-left line-clamp-2 leading-relaxed"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-100">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-sm font-medium"
                            : "bg-white border border-slate-200/60 text-slate-700 rounded-bl-sm"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm leading-relaxed max-w-none text-slate-700 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>p]:mb-2 [&>h3]:font-bold [&>h3]:mt-3 [&>h3]:mb-1 [&_strong]:text-slate-900">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] text-slate-400 mt-1 px-1 ${
                        msg.role === "user" ? "text-right" : "text-left"
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2.5 justify-start">
                    <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-100">
                      <Bot className="w-4 h-4 animate-bounce" />
                    </div>
                    <div className="bg-white border border-slate-200/60 text-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center shadow-sm">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="border-t border-slate-100 p-3 bg-white flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Posez une question RH..."
              disabled={isLoading}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 text-white rounded-xl p-2.5 hover:bg-indigo-700 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center"
              title="Envoyer le message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
