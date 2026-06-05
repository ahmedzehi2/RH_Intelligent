// frontend_web/components/dashboard/AIRecommendationsPanel.tsx

"use client"

import React, { useState, useEffect } from "react"
import { Sparkles, Loader2, ClipboardList, Lightbulb, TrendingDown, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"

export function AIRecommendationsPanel() {
  const [recommendations, setRecommendations] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai-recommendations")
      const json = await res.json()
      if (json.ok) {
        setRecommendations(json.recommendations)
      }
    } catch (error) {
      console.error("Error generating recommendations:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Generate automatically on mount
    handleGenerate()
  }, [])

  return (
    <Card className="border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/80">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Recommandations Stratégiques IA
            </CardTitle>
            <p className="text-xs text-slate-500">Plan d'action et conseils d'optimisation RH</p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          variant="outline"
          className="text-xs font-semibold rounded-xl gap-1 bg-white hover:bg-slate-50 cursor-pointer border-slate-200"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          )}
          Rafraîchir
        </Button>
      </CardHeader>
      <CardContent className="pt-5 px-6 pb-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600">
              Génération des stratégies RH en cours d'analyse...
            </p>
          </div>
        ) : recommendations ? (
          <div className="prose prose-sm leading-relaxed text-slate-700 max-w-none [&>h3]:text-sm [&>h3]:font-black [&>h3]:text-slate-800 [&>h3]:mt-4 [&>h3]:mb-1.5 [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1.5 [&_strong]:text-slate-900 [&_strong]:font-bold [&>ol]:list-decimal [&>ol]:pl-4">
            <ReactMarkdown>{recommendations}</ReactMarkdown>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center">
            <ClipboardList className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Aucune recommandation disponible</p>
            <Button
              onClick={handleGenerate}
              className="mt-3 bg-indigo-600 text-white rounded-xl text-xs hover:bg-indigo-700 font-bold px-4 py-2 cursor-pointer"
            >
              Générer maintenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
