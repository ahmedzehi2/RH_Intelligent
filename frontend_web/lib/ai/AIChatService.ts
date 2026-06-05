// frontend_web/lib/ai/AIChatService.ts

import { groqClient, GROQ_MODEL } from "./groq-client"

export const RH_SYSTEM_PROMPT = `Tu es Antigravity, un Copilot IA RH intelligent de niveau senior, intégré dans un système de gestion RH d'entreprise premium (ERP).
Ton rôle est d'aider les administrateurs RH à analyser les données réelles de l'entreprise, piloter l'assiduité, réduire l'absentéisme et prendre des décisions stratégiques basées sur des données fiables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONTEXTE DE TRAVAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tu as accès à des données de base de données en direct via un service analytique sécurisé SQL Server (employés, pointages, congés, missions, formations, retards). Tu dois toujours formuler tes analyses de manière objective, factuelle et directement exploitable par un directeur RH.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 DIRECTIVES DE COMPORTEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Ton & Style** :
   - Style managérial, analytique et extrêmement professionnel.
   - Réponses claires, structurées avec des listes à puces et des paragraphes aérés.
   - Utilise un vocabulaire axé sur le business ("impact opérationnel", "coaching managérial", "assiduité", "synergie d'équipe").
   - Sois synthétique et perspicace : va droit au but sans fioritures mais avec une profondeur analytique réelle.

2. **Traitement des données** :
   - Si les données de contexte montrent des anomalies (absences répétées, retards concentrés, dérives départementales), signale-les clairement et propose une recommandation.
   - Ne mentionne jamais de vocabulaire trop technique sur les modèles d'IA ou la base de données (pas de "SELECT", "joins", "SQL", "Random Forest"). Parle de "modèle prédictif d'assiduité", "statistiques d'équipe", "analyses de pointages".

3. **Génération d'e-mails RH** :
   - Si l'administrateur demande de générer un mail d'avertissement, utilise un ton adapté (Rappel bienveillant, Avertissement formel, ou Dernier Avertissement avant sanction) en français, et intègre les chiffres réels s'ils sont fournis.
`

export class AIChatService {
  /**
   * Processes an AI chat request by dynamically combining the system prompt, context, and history.
   */
  static async processChat(messages: { role: string; content: string }[], rhContext?: any) {
    try {
      // ── Construire le contexte RH dynamique ─────────────────────────
      let contextMessage = ""
      if (rhContext) {
        contextMessage = `
## Contexte RH en direct (Base de données SQL Server) :

📅 **Période analysée** : ${rhContext.periode?.debut} → ${rhContext.periode?.fin}
👥 **Nombre d'employés actifs** : ${rhContext.total_employes}

📈 **Statistiques Globales d'Assiduité** :
-🙋 Présents : ${rhContext.statistiques?.presents}
-❌ Absents : ${rhContext.statistiques?.absents}
-✅ À l'heure : ${rhContext.statistiques?.a_l_heure}
-⚠️ Retards : ${rhContext.statistiques?.retards}
-🚫 Absences Injustifiées : ${rhContext.statistiques?.absences_injust}
-⏱️ Durée de retard moyen : ${rhContext.statistiques?.retard_moy_min} min

🚨 **Alertes d'assiduité de la journée** :
${rhContext.alertes_jour?.slice(0, 5).map((a: any) => `- [${a.niveau}] ${a.message}`).join("\n") || "Aucune alerte critique aujourd'hui."}

🧠 **Insight Analytique IA** :
${rhContext.insight_ia || "Aucune anomalie critique détectée aujourd'hui."}

🏢 **Taux d'absence par département (Top 5)** :
${rhContext.stats_departements?.slice(0, 5).map((d: any) => `- ${d.departement} : ${d.taux_absence}% d'absences`).join("\n") || "Aucune donnée disponible."}
`
      }

      const completion = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: RH_SYSTEM_PROMPT + (contextMessage ? `\n\n${contextMessage}` : "")
          },
          ...messages.slice(-10).map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: String(m.content).slice(0, 2000)
          }))
        ]
      })

      return {
        reply: completion.choices[0]?.message?.content ?? "",
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens
        }
      }
    } catch (error) {
      console.error("[AIChatService] Error in chat completion:", error)
      throw error
    }
  }
}
