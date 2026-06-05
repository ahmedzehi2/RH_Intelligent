// frontend_web/lib/ai/AIEmailGenerator.ts

import { groqClient, GROQ_MODEL } from "./groq-client"
import { executeSafeQuery } from "../db/db-client"

export interface GeneratedEmailResponse {
  subject: string
  body: string
  severity: "Rappel" | "Avertissement" | "Dernier Avertissement"
  corrective_advice: string
  employee_name: string
  employee_email: string
}

export class AIEmailGenerator {
  /**
   * Generates a personalized warning email for an employee based on their attendance metrics
   */
  static async generateWarningEmail(
    employeId: number, 
    severity: "Rappel" | "Avertissement" | "Dernier Avertissement"
  ): Promise<GeneratedEmailResponse> {
    try {
      // 1. Fetch employee details
      const empQuery = `
        SELECT e.nom, e.prenom, e.adresse_mail, e.poste, d.nom_departement
        FROM dbo.Employe e
        JOIN dbo.Departement d ON e.departement_id = d.departement_id
        WHERE e.employe_id = ?
      `
      const emps = await executeSafeQuery(empQuery, [employeId])
      if (emps.length === 0) {
        throw new Error("Employé non trouvé.")
      }
      const emp = emps[0]

      // 2. Fetch employee attendance stats (last 30 days)
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN statut = 'Absent' THEN 1 END) as absences,
          COUNT(CASE WHEN statut = 'Absent' AND sous_statut = 'Injustifié' THEN 1 END) as unjust_absences,
          COUNT(CASE WHEN retard_minutes > 0 THEN 1 END) as retards,
          COALESCE(SUM(retard_minutes), 0) as total_delay_mins
        FROM dbo.Pointage
        WHERE employe_id = ? AND date_pointage >= DATEADD(day, -30, GETDATE())
      `
      const statsRows = await executeSafeQuery(statsQuery, [employeId])
      const stats = statsRows[0] || { absences: 0, unjust_absences: 0, retards: 0, total_delay_mins: 0 }

      // 3. Prompt construction
      const prompt = `
Tu es un responsable des Ressources Humaines senior. Tu dois générer un e-mail professionnel d'alerte/avertissement d'assiduité en français destiné à l'employé suivant.

Informations de l'employé :
- Nom : ${emp.prenom} ${emp.nom}
- Poste : ${emp.poste}
- Département : ${emp.nom_departement}
- Adresse email : ${emp.adresse_mail || "non renseignée"}

Statistiques d'assiduité sur les 30 derniers jours :
- Nombre d'absences : ${stats.absences}
- Nombre d'absences injustifiées : ${stats.unjust_absences}
- Nombre de retards : ${stats.retards}
- Minutes cumulées de retard : ${stats.total_delay_mins} minutes

Niveau de sévérité requis : ${severity}

Directives de rédaction :
- Ton : Formel, respectueux mais ferme et rigoureux.
- Langue : Français de niveau professionnel ("vous").
- S'adapter parfaitement à la sévérité :
  * Rappel : Préventif, bienveillant, rappelle les horaires de l'entreprise.
  * Avertissement : Formel, exprime une préoccupation claire concernant l'impact opérationnel, fait référence à la politique interne.
  * Dernier Avertissement : Très formel, solennel, évoque explicitement les risques de sanctions disciplinaires si aucun changement n'est constaté immédiatement.
- Intégrer précisément les chiffres réels dans le corps du texte pour étayer l'avertissement.
- Proposer un conseil correctif adapté (ex: réorganiser les transports ou planifier un entretien d'échange).

Retourne UNIQUEMENT un objet JSON valide correspondant au format suivant (sans bloc de code Markdown, juste le JSON brut) :
{
  "subject": "Objet de l'e-mail",
  "body": "Corps de l'e-mail au format texte brut propre avec des retours à la ligne (\\n)",
  "corrective_advice": "Conseil correctif ou recommandation managériale à l'attention du manager RH pour mener le rendez-vous physique (1 à 2 phrases)."
}
`

      const completion = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1000,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Tu es un assistant IA spécialisé dans la rédaction de correspondances administratives RH premium. Tu retournes exclusivement du JSON propre."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })

      const rawContent = completion.choices[0]?.message?.content ?? "{}"
      
      // Clean JSON if the LLM output it inside markdown codeblocks anyway
      let cleanJson = rawContent.trim()
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.substring(7, cleanJson.length - 3).trim()
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.substring(3, cleanJson.length - 3).trim()
      }

      const result = JSON.parse(cleanJson)

      return {
        subject: result.subject || `Alerte d'assiduité - ${severity}`,
        body: result.body || "Veuillez contacter le service RH concernant votre assiduité.",
        severity,
        corrective_advice: result.corrective_advice || "Planifier un entretien formel.",
        employee_name: `${emp.prenom} ${emp.nom}`,
        employee_email: emp.adresse_mail || ""
      }
    } catch (error) {
      console.error("[AIEmailGenerator] Error:", error)
      throw error
    }
  }
}
