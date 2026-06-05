// frontend_web/lib/ai/AIRecommendationEngine.ts

import { groqClient, GROQ_MODEL } from "./groq-client"
import { AIAnalyticsService } from "../analytics/AIAnalyticsService"

export class AIRecommendationEngine {
  /**
   * Generates advanced recommendations based on current database analytics
   */
  static async generateRecommendations(): Promise<string> {
    try {
      // 1. Fetch live SQL Server data
      const analytics = await AIAnalyticsService.getFullAnalyticsSummary()

      // 2. Build system prompt
      const prompt = `
Tu es un consultant RH expert et stratégique. Tu reçois les statistiques d'assiduité réelles d'une entreprise et tu dois générer un rapport de recommandations d'optimisation RH premium.

Statistiques actuelles (Données de la base SQL Server) :
- Période : ${analytics.period}
- Absences totales : ${analytics.global.absences_totales} (${analytics.global.absences_injustifiees} injustifiées)
- Retards totaux : ${analytics.global.retards_totaux}
- Retard moyen : ${analytics.global.retard_moyen_minutes} minutes

Départements :
${analytics.departements.map(d => `- ${d.nom_departement} : Taux d'absence = ${d.absence_rate}%, Ponctualité = ${d.punctuality_rate}%`).join("\n")}

Employés les plus à risque :
${analytics.employes_a_risque.slice(0, 3).map(e => `- ${e.prenom} ${e.nom} (${e.nom_departement}) : Score de Risque = ${e.risk_score}/100, Absences = ${e.absences}, Retards = ${e.retards}`).join("\n")}

Modèles d'absence récurrents (Lundi/Vendredi) :
${analytics.comportements_anormaux.slice(0, 3).map(c => `- ${c.prenom} ${c.nom} (${c.nom_departement}) : ${c.monday_friday_absences} absences lundi/vendredi`).join("\n")}

Génère une analyse stratégique claire et structurée en français contenant :
1. 📉 Stratégies de réduction de l'absentéisme (plan d'action pour les départements ou employés les plus touchés)
2. ⏱️ Suggestions d'amélioration de la ponctualité (politiques de gestion des retards)
3. 🏢 Optimisation par département (recommandations spécifiques pour le département le moins performant)
4. 🤝 Recommandations d'engagement et de bien-être (pour remotiver les équipes)
5. ⚠️ Suggestions d'interventions RH concrètes (quels entretiens mener en priorité)

Sois concis, extrêmement professionnel et utilise un ton "Executive HR Advisor". Ne mentionne pas de jargon technique.
`

      const completion = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "Tu es un expert senior en conseil stratégique en Ressources Humaines."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })

      return completion.choices[0]?.message?.content ?? "Impossible de générer des recommandations actuellement."
    } catch (error) {
      console.error("[AIRecommendationEngine] Error:", error)
      return "Une erreur s'est produite lors de la génération des recommandations RH."
    }
  }
}
