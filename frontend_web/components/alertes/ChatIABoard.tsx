// frontend_web/components/alertes/ChatIABoard.tsx

import React from "react"
import ReactMarkdown from "react-markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, Trash2, Send, Loader2, ChevronRight } from "lucide-react"
import { ChatMessage } from "@/types/alertes"

interface ChatIABoardProps {
  messages: ChatMessage[]
  chatInput: string
  setChatInput: (val: string) => void
  isSending: boolean
  handleSendMessage: (text?: string) => Promise<void>
  clearDiscussion: () => void
  chatEndRef: React.RefObject<HTMLDivElement | null>
}

const SUGGESTIONS = [
  { label: "Employés les plus absents", q: "Qui sont les employés les plus absents de ces 30 derniers jours ?" },
  { label: "Analyse des retards", q: "Fais une analyse des retards récents par département." },
  { label: "Départements critiques", q: "Quels départements affichent le plus fort taux d'anomalies ?" },
  { label: "Employés sans pointage", q: "Quels employés n'ont aucun pointage cette semaine ?" },
  { label: "Résumé RH global", q: "Donne-moi une synthèse claire et rapide de la situation RH actuelle." },
  { label: "Conseils RH IA", q: "Quelles mesures managériales suggères-tu pour corriger l'absentéisme ?" }
]

export function ChatIABoard({
  messages,
  chatInput,
  setChatInput,
  isSending,
  handleSendMessage,
  clearDiscussion,
  chatEndRef
}: ChatIABoardProps) {
  return (
    <div className="xl:sticky xl:top-6 h-[calc(100vh-100px)] min-h-[720px] bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm flex flex-col">
      {/* HEADER CHAT IA */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Brain className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 tracking-tight">Copilote IA RH</h3>
            <span className="text-[9px] font-bold text-slate-400">llama-3.3-70b-versatile</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 text-[8px] font-black rounded-full px-2 py-0.5">
            Connecté
          </Badge>
          {messages.length > 0 && (
            <button
              onClick={clearDiscussion}
              className="size-6 hover:bg-slate-200 rounded-md flex items-center justify-center text-slate-550 cursor-pointer"
              title="Vider la discussion"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            </button>
          )}
        </div>
      </div>

      {/* DISCUSSION CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center px-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3 shadow-inner border border-indigo-100/50">
              <Brain className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-black text-slate-800">Assistant Décisionnel RH</h4>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed font-semibold">
              Je suis connecté directement aux pointages réels, aux indicateurs de retard et aux dossiers des employés. 
            </p>

            {/* Suggestions interactive chips */}
            <div className="mt-6 flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(item.q)}
                  className="w-full bg-white border border-slate-200/80 rounded-xl p-2.5 text-[9px] font-bold text-slate-600 text-left hover:border-indigo-200 hover:bg-indigo-50/40 transition-all cursor-pointer shadow-sm flex items-center justify-between"
                >
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-6.5 h-6.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-sm font-semibold"
                      : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none shadow-sm prose prose-sm max-w-none font-normal"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-start gap-2">
                <div className="w-6.5 h-6.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0 animate-bounce">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <div className="bg-slate-50 border border-slate-250 rounded-2xl rounded-tl-none px-3.5 py-2.5 shadow-sm text-[10px] text-slate-550 font-bold flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  IA en réflexion...
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT BAR STICKY BOTTOM */}
      <div className="p-3.5 border-t border-slate-100 bg-white flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100/50 transition-all"
        >
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            rows={1}
            placeholder="Posez votre question RH..."
            className="flex-1 bg-transparent border-none text-[11px] text-slate-700 placeholder-slate-400 outline-none resize-none min-h-[20px] max-h-[70px]"
          />
          <Button
            type="submit"
            disabled={!chatInput.trim() || isSending}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg size-7 p-0 flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}
