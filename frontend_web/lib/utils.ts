import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Détecte toutes les variantes possibles de "Présent"
// venant du backend (FR/EN, accents, majuscules, espaces)
export function isPresent(status: string | null | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase().trim().normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")  // supprime accents
  return s === "present" || s === "p" || s === "pres"
}

// Debug helper — appeler temporairement pour vérifier la valeur brute
export function debugStatus(status: string | null | undefined, context: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[STATUS DEBUG] context=${context} | raw="${status}" | isPresent=${isPresent(status)}`)
  }
}

// Retourne les classes Tailwind selon le statut
// NE MODIFIER QUE LA LIGNE "présent" — les autres restent intactes
export function getStatusStyle(status: string | null | undefined): string {
  if (isPresent(status)) {
    return "bg-green-500 text-white"        // ← SEUL changement autorisé
  }
  // Tout le reste : NE PAS MODIFIER
  const s = (status ?? "").toLowerCase().trim()
  if (s.includes("absent"))  return "bg-red-100 text-red-700"
  if (s.includes("retard"))  return "bg-orange-100 text-orange-700"
  if (s.includes("conge") || s.includes("congé")) return "bg-blue-100 text-blue-700"
  return "bg-gray-100 text-gray-600"        // fallback — ne pas modifier
}

// Même chose pour le calendrier (cellule entière)
export function getCalendarCellStyle(status: string | null | undefined): string {
  if (isPresent(status)) {
    return "bg-green-500 text-white ring-1 ring-green-600"
  }
  return ""  // laisser le style existant pour tout le reste
}

// ─── Conversion minutes → affichage heures ───────────────────────

/**
 * Convertit un nombre de minutes en format lisible "Xh YYmin"
 * @param totalMinutes  Valeur brute en minutes venant du backend
 * @returns             "7h 44min" | "2h 00min" | "0h 00min" | "—"
 *
 * Exemples :
 *   formatMinutes(464)  → "7h 44min"
 *   formatMinutes(120)  → "2h 00min"
 *   formatMinutes(90)   → "1h 30min"
 *   formatMinutes(0)    → "0h 00min"
 *   formatMinutes(null) → "—"
 */
export function formatMinutes(
  totalMinutes: number | null | undefined
): string {
  if (totalMinutes === null || totalMinutes === undefined) return "—"
  if (isNaN(Number(totalMinutes))) return "—"

  const total = Math.round(Number(totalMinutes))
  if (total < 0) return "—"

  const heures  = Math.floor(total / 60)
  const minutes = total % 60

  return `${heures}h ${String(minutes).padStart(2, "0")}min`
}

/**
 * Même chose mais format court pour les espaces réduits : "7h44"
 */
export function formatMinutesCourt(
  totalMinutes: number | null | undefined
): string {
  if (totalMinutes === null || totalMinutes === undefined) return "—"
  if (isNaN(Number(totalMinutes))) return "—"

  const total   = Math.round(Number(totalMinutes))
  const heures  = Math.floor(total / 60)
  const minutes = total % 60

  return minutes === 0
    ? `${heures}h`
    : `${heures}h${String(minutes).padStart(2, "0")}`
}

/**
 * Convertit minutes en heures décimales (pour les graphiques)
 * @returns  7.73  pour 464 minutes
 */
export function minutesToHeures(
  totalMinutes: number | null | undefined
): number {
  if (!totalMinutes) return 0
  return Math.round((Number(totalMinutes) / 60) * 10) / 10
}

/**
 * Debug : affiche dans la console la valeur brute et la conversion
 * Appeler temporairement pour vérifier les valeurs du backend
 */
export function debugMinutes(
  value: number | null | undefined,
  context: string
): void {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[MINUTES DEBUG] context="${context}"`,
      `| raw=${value}`,
      `| formatMinutes=${formatMinutes(value)}`,
      `| heures=${minutesToHeures(value)}`
    )
  }
}