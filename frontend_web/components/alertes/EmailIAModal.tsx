// frontend_web/components/alertes/EmailIAModal.tsx

import React from "react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Loader2, Send, Copy } from "lucide-react"
import { HighRiskEmployee } from "@/types/alertes"
import { toast } from "sonner"

interface EmailIAModalProps {
  emailModalEmp: HighRiskEmployee | null
  setEmailModalEmp: (emp: HighRiskEmployee | null) => void
  emailSeverity: "Rappel" | "Avertissement" | "Dernier Avertissement"
  handleSeverityChange: (sev: "Rappel" | "Avertissement" | "Dernier Avertissement") => Promise<void>
  isGeneratingEmail: boolean
  isSendingEmail: boolean
  emailPreview: {
    subject: string
    body: string
    employee_email: string
  } | null
  setEmailPreview: (val: any) => void
  handleSendEmail: () => Promise<void>
}

export function EmailIAModal({
  emailModalEmp,
  setEmailModalEmp,
  emailSeverity,
  handleSeverityChange,
  isGeneratingEmail,
  isSendingEmail,
  emailPreview,
  setEmailPreview,
  handleSendEmail
}: EmailIAModalProps) {
  if (!emailModalEmp) return null

  const handleCopyEmail = () => {
    if (!emailPreview) return
    const textToCopy = `Objet: ${emailPreview.subject}\n\n${emailPreview.body}`
    navigator.clipboard.writeText(textToCopy)
    toast.success("E-mail copié dans le presse-papiers !")
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-[620px] bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              <Mail className="w-5 h-5 text-indigo-600" />
              Mise en demeure / Rappel IA
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Rappel d'assiduité destiné à <strong>{emailModalEmp.nom}</strong>
            </p>
          </div>
          <button
            onClick={() => setEmailModalEmp(null)}
            className="size-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs cursor-pointer"
          >
            ✕
          </button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Niveau de severite */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Niveau de Sévérité
            </label>
            <div className="flex gap-2">
              {(["Rappel", "Avertissement", "Dernier Avertissement"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => handleSeverityChange(sev)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    emailSeverity === sev
                      ? sev === "Rappel"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
                        : sev === "Avertissement"
                        ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
                        : "bg-rose-50 border-rose-200 text-rose-700 shadow-sm"
                      : "bg-white border-slate-100 hover:border-slate-200 text-slate-500"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Loader */}
          {isGeneratingEmail ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs font-bold text-slate-500">
                Rédaction IA du courrier en cours...
              </span>
            </div>
          ) : emailPreview ? (
            <div className="space-y-3.5">
              {/* Subject Line */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs flex items-center">
                <span className="font-bold text-slate-400 w-16 flex-shrink-0">Objet :</span>
                <input
                  type="text"
                  value={emailPreview.subject}
                  onChange={(e) => setEmailPreview({ ...emailPreview, subject: e.target.value })}
                  className="w-full bg-transparent border-none font-bold text-slate-700 outline-none"
                />
              </div>

              {/* Recipient */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs flex items-center">
                <span className="font-bold text-slate-400 w-16 flex-shrink-0">Dest. :</span>
                <span className="font-bold text-slate-600 truncate">{emailPreview.employee_email || "Non renseigné"}</span>
              </div>

              {/* Body Textarea */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Message (Modifiable)
                </label>
                <textarea
                  value={emailPreview.body}
                  onChange={(e) => setEmailPreview({ ...emailPreview, body: e.target.value })}
                  rows={8}
                  className="w-full border border-slate-200 rounded-2xl p-4 text-xs leading-relaxed text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-150"
                />
              </div>

              {/* Actions buttons inside Modal */}
              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  onClick={handleCopyEmail}
                  variant="outline"
                  className="rounded-2xl py-5 font-bold text-xs border-slate-200 hover:bg-slate-50 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copier
                </Button>
                <Button
                  onClick={() => handleSeverityChange(emailSeverity)}
                  variant="outline"
                  className="rounded-2xl py-5 font-bold text-xs border-slate-200 hover:bg-slate-50 cursor-pointer shadow-sm"
                >
                  Régénérer
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-5 font-bold text-xs gap-2 cursor-pointer shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer le courrier
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-rose-500 font-bold text-xs">
              Erreur de génération. Veuillez modifier la sévérité ou réessayer.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
