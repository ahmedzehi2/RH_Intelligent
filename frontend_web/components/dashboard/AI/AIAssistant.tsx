"use client"

import React, { useState, useRef, useEffect } from "react"
import { Sparkles, Send, Loader2, Bot, User, RefreshCw, AlertCircle } from "lucide-react"
import { iaApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ReactMarkdown from "react-markdown"

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS (from user request)
// ─────────────────────────────────────────────────────────────────────────────

const buildPrompt = (userMessage: string, context: any) => `
You are a reliable AI assistant inside an HR dashboard.

━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- ONLY use the provided data
- DO NOT invent information
- If data is missing → reply EXACTLY: "Insufficient data"
- Keep answers short and clear
- Use simple business language
- Always structure the answer

━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT DATA
━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(context || {}, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━
📊 Insight:
(short explanation)

⚠️ Issues:
(list or "None")

✅ Actions:
(list or "None")

━━━━━━━━━━━━━━━━━━━━━━━
USER QUESTION
━━━━━━━━━━━━━━━━━━━━━━━
${userMessage}
`

const explainPrompt = (context: any) => `
You are an HR expert.

Analyze the following dashboard data and summarize the overall situation.

${JSON.stringify(context)}

Give:
- Overall health score
- Main problems
- Suggested actions
`

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  role: "assistant" | "user"
  content: string
  timestamp: string
}

export function AIAssistant({ context }: { context: any }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis votre assistant IA. Je peux analyser vos données RH en temps réel. Que souhaitez-vous savoir ?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim() || loading) return

    const userMsg: Message = {
      role: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      // Build the expert prompt with context
      const fullPrompt = buildPrompt(messageText, context)
      
      // Call IA API (sending data_rh as empty because context is already in the prompt)
      const res = await iaApi.chat(fullPrompt, {})
      
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.reponse,
            timestamp: new Date().toLocaleTimeString(),
          },
        ])
      } else {
        throw new Error(res.error || "Erreur de communication avec l'IA")
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Désolé, j'ai rencontré une erreur : ${err.message}. Assurez-vous qu'Ollama est bien démarré.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async () => {
    if (summarizing) return
    setSummarizing(true)
    
    try {
      const fullPrompt = explainPrompt(context)
      const res = await iaApi.analyser(fullPrompt, {})
      
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.reponse,
            timestamp: new Date().toLocaleTimeString(),
          },
        ])
      }
    } catch (err: any) {
      // ignore
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <Card className="h-[600px] flex flex-col shadow-xl border-indigo-100 rounded-3xl overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Assistant IA Stratégique</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-indigo-100 uppercase tracking-widest">En ligne • Expert RH</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleSummarize}
            disabled={summarizing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition-all border border-white/10 disabled:opacity-50"
          >
            {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Résumé Auto
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-gray-50/50">
        {/* Messages list */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth"
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm
                ${msg.role === "assistant" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-100"}`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`max-w-[85%] space-y-1 ${msg.role === "user" ? "items-end" : ""}`}>
                <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed
                  ${msg.role === "assistant" 
                    ? "bg-white text-gray-800 rounded-tl-none border border-gray-100" 
                    : "bg-indigo-600 text-white rounded-tr-none"}`}>
                  <div className="markdown-content prose prose-sm max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 px-1">{msg.timestamp}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Posez une question sur vos KPIs, alertes..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 transition-all active:scale-95 shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {["Analyser IT", "Risques départements", "Top retards"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSend(suggestion)}
                className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-[11px] font-medium text-gray-500 transition-colors border border-transparent hover:border-indigo-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
