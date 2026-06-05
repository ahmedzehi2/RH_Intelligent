// frontend_web/hooks/useAIChat.ts

import { useState, useCallback } from "react"
import { ChatMessage } from "@/types/alertes"
import { toast } from "sonner"

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = useCallback(async (text?: string) => {
    const query = (text ?? chatInput).trim()
    if (!query || isSending) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date()
    }

    // Append user message immediately
    setMessages((prev) => [...prev, userMsg])
    if (!text) setChatInput("")
    setIsSending(true)

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      const data = await res.json()

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
            timestamp: new Date()
          }
        ])
      } else {
        toast.error(data.error || "Erreur de communication avec le copilote IA.")
      }
    } catch (err) {
      console.error("[useAIChat Error]", err)
      toast.error("Le service IA est temporairement indisponible. Veuillez réessayer.")
    } finally {
      setIsSending(false)
    }
  }, [messages, chatInput, isSending])

  const clearDiscussion = useCallback(() => {
    setMessages([])
    toast.success("Discussion réinitialisée.")
  }, [])

  return {
    messages,
    chatInput,
    setChatInput,
    isSending,
    handleSendMessage,
    clearDiscussion
  }
}
