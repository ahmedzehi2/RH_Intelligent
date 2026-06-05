import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PALETTE COULEURS DU RAPPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type RGB = [number, number, number]

const C: Record<string, RGB> = {
  primary:    [49, 46, 129],    // indigo-900  #312e81
  accent:     [99, 102, 241],   // indigo-500  #6366f1
  light:      [238, 242, 255],  // indigo-50   #eef2ff
  success:    [16, 185, 129],   // emerald-500 #10b981
  successBg:  [236, 253, 245],  // emerald-50  #ecfdf5
  warning:    [245, 158, 11],   // amber-500   #f59e0b
  warningBg:  [255, 251, 235],  // amber-50    #fffbeb
  danger:     [239, 68, 68],    // rose-500    #ef4444
  dangerBg:   [255, 241, 242],  // rose-50
  gray:       [71, 85, 105],    // slate-600
  grayLight:  [241, 245, 249],  // slate-100
  border:     [226, 232, 240],  // slate-200
  white:      [255, 255, 255],
  dark:       [15, 23, 42],     // slate-900
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFACES TYPESCRIPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RHReportData {
  presence: {
    total_employees:    number
    presents:           number
    absents:            number
    a_l_heure:          number
    retards:            number
    aucun_pointage:     number
    en_conge:           number
    taux_presence_pct:  number
    taux_ponctualite_pct: number
    retard_moyen_min:   number
    duree_moyenne_min:  number
    periode:            { debut: string; fin: string }
  }

  demandes: {
    total:      number
    acceptees:  number
    refusees:   number
    en_attente: number
  }

  absencesDept: Array<{
    departement:  string
    taux_absence: number
    total:        number
  }>

  formations: Array<{
    nom:          string
    participants: number
    date?:        string
  }>

  ponctualite: {
    a_l_heure:      number
    retards:        number
    retard_moy_min: number
  }
}

export interface RHReportOptions {
  entreprise:  string
  utilisateur: string
  logoBase64?: string
  periode?:    string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function fmtDate(d: string): string {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric"
    })
  } catch (_) {
    return d
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FONCTION PRINCIPALE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateRHReport(
  data: RHReportData,
  options: RHReportOptions
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const PAGE_W = 210, PAGE_H = 297
  const MARGIN = 15

  // ══════════════════════════════════════════════════
  // PAGE 1 — PAGE DE GARDE
  // ══════════════════════════════════════════════════

  doc.setFillColor(...C.primary)
  doc.rect(0, 0, PAGE_W, PAGE_H, "F")

  doc.setFillColor(...C.accent)
  doc.rect(120, 220, 90, 80, "F")

  doc.setFillColor(99, 102, 241, 0.3)
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, 60, 60, "F")

  if (options.logoBase64) {
    try {
      doc.addImage(options.logoBase64, "PNG", PAGE_W/2 - 20, 35, 40, 20)
    } catch (_) {}
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(...C.white)
  doc.text(options.entreprise.toUpperCase(), PAGE_W / 2, 75, { align: "center" })

  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.8)
  doc.line(MARGIN + 30, 82, PAGE_W - MARGIN - 30, 82)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(32)
  doc.setTextColor(255, 255, 255)
  doc.text("RAPPORT", PAGE_W / 2, 110, { align: "center" })

  doc.setFontSize(26)
  doc.setTextColor(165, 180, 252)
  doc.text("RESSOURCES HUMAINES", PAGE_W / 2, 122, { align: "center" })

  const periodeLabel = options.periode
    ?? `${fmtDate(data.presence.periode.debut)} – ${fmtDate(data.presence.periode.fin)}`

  doc.setFillColor(255, 255, 255, 0.1)
  doc.setFillColor(79, 70, 229)
  doc.roundedRect(MARGIN + 25, 140, PAGE_W - 2*(MARGIN+25), 16, 3, 3, "F")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`Période analysée : ${periodeLabel}`, PAGE_W / 2, 150, { align: "center" })

  const coverStats = [
    { label: "Effectif", value: String(data.presence.total_employees) },
    { label: "Présence", value: fmtPct(data.presence.taux_presence_pct) },
    { label: "Retards",  value: String(data.presence.retards) },
    { label: "Formations", value: String(data.formations.length) },
  ]
  const cardW  = 38, cardH = 22, cardY = 170
  const totalW = coverStats.length * cardW + (coverStats.length - 1) * 5
  let cardX    = (PAGE_W - totalW) / 2

  coverStats.forEach(({ label, value }) => {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...C.primary)
    doc.text(value, cardX + cardW / 2, cardY + 11, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(label.toUpperCase(), cardX + cardW / 2, cardY + 18, { align: "center" })

    cardX += cardW + 5
  })

  doc.setDrawColor(255, 255, 255, 0.3)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(MARGIN + 20, 212, PAGE_W - MARGIN - 20, 212)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric"
  })
  doc.text(`Généré le : ${today}`, PAGE_W / 2, 225, { align: "center" })
  doc.text(`Par : ${options.utilisateur}`, PAGE_W / 2, 233, { align: "center" })

  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text("DOCUMENT CONFIDENTIEL — USAGE INTERNE", PAGE_W / 2, 268, { align: "center" })

  // ══════════════════════════════════════════════════
  // PAGE 2 — RÉSUMÉ EXÉCUTIF
  // ══════════════════════════════════════════════════
  doc.addPage()
  let y = addPageHeader(doc, options.entreprise, options.logoBase64)

  y = sectionHeader(doc, "Résumé Exécutif", y, "📊")
  y += 5

  const taux = data.presence.taux_presence_pct
  const perfLabel = taux >= 95 ? "🟢 EXCELLENT" : taux >= 85 ? "🟡 CORRECT" : "🔴 CRITIQUE"
  const perfColor: RGB = taux >= 95 ? C.success : taux >= 85 ? C.warning : C.danger
  const perfBg: RGB    = taux >= 95 ? C.successBg : taux >= 85 ? C.warningBg : C.dangerBg

  doc.setFillColor(...perfBg)
  doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, 14, 3, 3, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...perfColor)
  doc.text(`Performance globale : ${perfLabel}  —  Taux de présence : ${fmtPct(taux)}`,
    PAGE_W / 2, y + 9, { align: "center" })
  y += 20

  const kpis = [
    { label: "Effectif Total",        value: String(data.presence.total_employees),         color: C.accent },
    { label: "Présents",              value: String(data.presence.presents),                color: C.success },
    { label: "Absents",               value: String(data.presence.absents),                 color: C.danger },
    { label: "Taux Présence",         value: fmtPct(data.presence.taux_presence_pct),       color: C.success },
    { label: "À l'heure",             value: String(data.presence.a_l_heure),               color: C.success },
    { label: "Retards",               value: String(data.presence.retards),                 color: C.warning },
    { label: "Taux Ponctualité",      value: fmtPct(data.presence.taux_ponctualite_pct),    color: C.accent },
    { label: "Sans Pointage",         value: String(data.presence.aucun_pointage),          color: C.danger },
    { label: "En Congé",              value: String(data.presence.en_conge),                color: [14, 165, 233] as RGB },
    { label: "Durée Moy. Travaillée", value: fmtMinutes(data.presence.duree_moyenne_min),   color: C.gray },
  ]

  const kpiW = (PAGE_W - 2 * MARGIN - 4 * 4) / 5
  const kpiH = 22
  let kx = MARGIN, ky = y

  kpis.forEach(({ label, value, color }, i) => {
    if (i === 5) { kx = MARGIN; ky += kpiH + 5 }

    doc.setFillColor(...C.grayLight)
    doc.roundedRect(kx, ky, kpiW, kpiH, 2, 2, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...color)
    doc.text(value, kx + kpiW / 2, ky + 10, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...C.gray)
    doc.text(label.toUpperCase(), kx + kpiW / 2, ky + 17, { align: "center" })

    kx += kpiW + 4
  })

  y = ky + kpiH + 15

  const commentExec = `Durant la période analysée (${periodeLabel}), ${options.entreprise} compte ${data.presence.total_employees} collaborateurs. ` +
    `Le taux de présence global s'établit à ${fmtPct(taux)}, avec ${data.presence.retards} retards enregistrés ` +
    `et ${data.presence.aucun_pointage} absences sans pointage. ` +
    `La durée moyenne travaillée est de ${fmtMinutes(data.presence.duree_moyenne_min)}.`

  doc.setFillColor(...C.light)
  const commentLines = doc.splitTextToSize(commentExec, PAGE_W - 2 * MARGIN - 12)
  const commentH = commentLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, commentH, 3, 3, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...C.primary)
  doc.text(commentLines, MARGIN + 6, y + 7)
  y += commentH + 5

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 3 — ANALYSE DE LA PRÉSENCE
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Analyse de la Présence", y, "👥")
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Indicateur", "Valeur", "Détail"]],
    body: [
      ["Effectif total",        String(data.presence.total_employees),          "Ensemble des collaborateurs actifs"],
      ["Présents",              String(data.presence.presents),                 `${fmtPct((data.presence.presents / Math.max(data.presence.total_employees, 1)) * 100)} de l'effectif`],
      ["Absents",               String(data.presence.absents),                  `${fmtPct((data.presence.absents / Math.max(data.presence.total_employees, 1)) * 100)} de l'effectif`],
      ["Taux de présence",      fmtPct(data.presence.taux_presence_pct),        taux >= 95 ? "Excellent" : taux >= 85 ? "Correct" : "À améliorer"],
      ["À l'heure",             String(data.presence.a_l_heure),                fmtPct((data.presence.a_l_heure / Math.max(data.presence.total_employees, 1)) * 100)],
      ["Retards détectés",      String(data.presence.retards),                  `Retard moyen : ${fmtMinutes(data.presence.retard_moyen_min)}`],
      ["Sans pointage",         String(data.presence.aucun_pointage),           "Absences non justifiées"],
      ["En congé validé",       String(data.presence.en_conge),                 "Congés approuvés"],
      ["Durée moy. travaillée", fmtMinutes(data.presence.duree_moyenne_min),    "Par employé présent"],
      ["Taux de ponctualité",   fmtPct(data.presence.taux_ponctualite_pct),     "Employés sans retard / présents"],
    ],
    styles:           { fontSize: 9, cellPadding: 4 },
    headStyles:       { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.accent },
      2: { textColor: C.gray, fontSize: 8 },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 10

  const commentPresence = `Durant cette période, le taux de présence global est de ${fmtPct(taux)}, ` +
    `avec ${data.presence.retards} retards constatés (retard moyen : ${fmtMinutes(data.presence.retard_moyen_min)}) ` +
    `et ${data.presence.aucun_pointage} absences sans pointage enregistrées.`

  const presLines = doc.splitTextToSize(commentPresence, PAGE_W - 2 * MARGIN - 12)
  doc.setFillColor(...C.light)
  doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, presLines.length * 5 + 10, 3, 3, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...C.primary)
  doc.text(presLines, MARGIN + 6, y + 7)

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 4 — ANALYSE DES DEMANDES RH
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Analyse des Demandes RH", y, "📋")
  y += 5

  const tauxAcceptation = data.demandes.total > 0
    ? (data.demandes.acceptees / data.demandes.total) * 100
    : 0

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Type de demande", "Nombre", "Proportion"]],
    body: [
      ["Total des demandes", String(data.demandes.total), "100%"],
      ["Acceptées",          String(data.demandes.acceptees),  fmtPct((data.demandes.acceptees  / Math.max(data.demandes.total, 1)) * 100)],
      ["Refusées",           String(data.demandes.refusees),   fmtPct((data.demandes.refusees   / Math.max(data.demandes.total, 1)) * 100)],
      ["En attente",         String(data.demandes.en_attente), fmtPct((data.demandes.en_attente / Math.max(data.demandes.total, 1)) * 100)],
      ["Taux d'acceptation", `${tauxAcceptation.toFixed(1)}%`, tauxAcceptation >= 70 ? "Satisfaisant" : "À améliorer"],
    ],
    styles:          { fontSize: 9, cellPadding: 4 },
    headStyles:      { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.accent },
      2: { halign: "center", textColor: C.gray },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 10

  const commentDemandes = `Sur un total de ${data.demandes.total} demandes soumises, ${data.demandes.acceptees} ont été acceptées ` +
    `(taux d'acceptation : ${fmtPct(tauxAcceptation)}), ${data.demandes.refusees} refusées et ` +
    `${data.demandes.en_attente} sont toujours en cours de traitement.`

  const demandesLines = doc.splitTextToSize(commentDemandes, PAGE_W - 2*MARGIN - 12)
  doc.setFillColor(...C.light)
  doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, demandesLines.length * 5 + 10, 3, 3, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...C.primary)
  doc.text(demandesLines, MARGIN + 6, y + 7)

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 5 — ABSENCES PAR DÉPARTEMENT
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Absences par Département", y, "🏢")
  y += 5

  const sortedDepts = [...data.absencesDept].sort((a, b) => b.taux_absence - a.taux_absence)
  const top3Absent  = sortedDepts.slice(0, 3)
  const top3Present = [...sortedDepts].reverse().slice(0, 3)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Département", "Taux d'absence", "Total absences", "Statut"]],
    body: sortedDepts.map((d, i) => [
      d.departement,
      fmtPct(d.taux_absence),
      String(d.total),
      i < 3 ? "⚠️ Élevé" : d.taux_absence < 5 ? "✓ Faible" : "Normal",
    ]),
    styles:          { fontSize: 9, cellPadding: 4 },
    headStyles:      { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.danger },
      2: { halign: "center", textColor: C.gray },
      3: { halign: "center" },
    },
    didParseCell: (hookData: any) => {
      if (hookData.column.index === 3 && hookData.section === "body") {
        const v = hookData.cell.raw as string
        if (v.includes("Élevé"))  hookData.cell.styles.textColor = C.danger
        if (v.includes("Faible")) hookData.cell.styles.textColor = C.success
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY + 8

  if (top3Absent.length > 0) {
    const concluDept = `Les 3 départements les plus touchés sont : ${top3Absent.map(d => `${d.departement} (${fmtPct(d.taux_absence)})`).join(", ")}. ` +
      `Les 3 départements avec le moins d'absences sont : ${top3Present.map(d => `${d.departement} (${fmtPct(d.taux_absence)})`).join(", ")}.`

    const deptLines = doc.splitTextToSize(concluDept, PAGE_W - 2*MARGIN - 12)
    doc.setFillColor(...C.warningBg)
    doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, deptLines.length * 5 + 10, 3, 3, "F")
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text(deptLines, MARGIN + 6, y + 7)
  }

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 6 — FORMATIONS + PONCTUALITÉ
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Analyse des Formations", y, "🎓")
  y += 5

  const sortedFormations = [...data.formations].sort((a, b) => b.participants - a.participants)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Formation", "Participants", "Date", "Popularité"]],
    body: sortedFormations.map((f, i) => [
      f.nom,
      String(f.participants),
      f.date ? fmtDate(f.date) : "—",
      i === 0 ? "⭐ La plus suivie" : i === sortedFormations.length - 1 ? "📉 La moins suivie" : "Normal",
    ]),
    styles:          { fontSize: 9, cellPadding: 4 },
    headStyles:      { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.accent },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 15

  y = sectionHeader(doc, "Analyse de la Ponctualité", y, "⏰")
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Indicateur", "Valeur", "Interprétation"]],
    body: [
      ["Employés à l'heure",  String(data.ponctualite.a_l_heure),          fmtPct((data.ponctualite.a_l_heure / Math.max(data.presence.presents, 1)) * 100)],
      ["Employés en retard",  String(data.ponctualite.retards),             fmtPct((data.ponctualite.retards   / Math.max(data.presence.presents, 1)) * 100)],
      ["Retard moyen",        fmtMinutes(data.ponctualite.retard_moy_min),  data.ponctualite.retard_moy_min < 10 ? "Acceptable" : data.ponctualite.retard_moy_min < 20 ? "Modéré" : "Élevé"],
    ],
    styles:          { fontSize: 9, cellPadding: 4 },
    headStyles:      { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.accent },
      2: { textColor: C.gray },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  const retardMoy = data.ponctualite.retard_moy_min
  const interpPonctualite = retardMoy < 10
    ? `Le retard moyen de ${fmtMinutes(retardMoy)} est acceptable et reflète un niveau de ponctualité satisfaisant.`
    : retardMoy < 20
    ? `Le retard moyen de ${fmtMinutes(retardMoy)} est modéré. Des mesures de sensibilisation sont recommandées.`
    : `Le retard moyen de ${fmtMinutes(retardMoy)} est préoccupant. Un plan d'action RH est nécessaire.`

  const ponctLines = doc.splitTextToSize(interpPonctualite, PAGE_W - 2*MARGIN - 12)
  doc.setFillColor(...C.light)
  doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, ponctLines.length * 5 + 10, 3, 3, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...C.primary)
  doc.text(ponctLines, MARGIN + 6, y + 7)

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 7 — RECOMMANDATIONS RH
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Recommandations RH", y, "💡")
  y += 8

  const recommandations: Array<{ titre: string; detail: string; urgence: "Haute" | "Moyenne" | "Faible" }> = []

  if (data.presence.taux_presence_pct < 85) {
    recommandations.push({
      titre:   "Renforcer le suivi des présences",
      detail:  `Le taux de présence de ${fmtPct(taux)} est critique. Mettre en place un système de suivi quotidien et des entretiens individuels avec les collaborateurs fréquemment absents.`,
      urgence: "Haute",
    })
  }
  if (data.presence.retards > data.presence.total_employees * 0.15) {
    recommandations.push({
      titre:   "Mettre en place des rappels automatiques",
      detail:  `${data.presence.retards} retards ont été enregistrés. Implémenter des notifications automatiques et revoir les horaires de prise de poste.`,
      urgence: data.presence.retards > data.presence.total_employees * 0.25 ? "Haute" : "Moyenne",
    })
  }
  if (data.presence.aucun_pointage > data.presence.total_employees * 0.1) {
    recommandations.push({
      titre:   "Sensibiliser aux outils de pointage",
      detail:  `${data.presence.aucun_pointage} employés n'ont pas pointé. Organiser des sessions de formation sur l'utilisation du système de pointage.`,
      urgence: "Moyenne",
    })
  }
  if (data.formations.length === 0 || data.formations.reduce((s, f) => s + f.participants, 0) < data.presence.total_employees * 0.3) {
    recommandations.push({
      titre:   "Encourager la participation aux formations",
      detail:  "Le taux de participation aux formations est faible. Proposer des formations adaptées aux besoins des collaborateurs et intégrer les formations au plan de développement RH.",
      urgence: "Faible",
    })
  }
  if (tauxAcceptation < 70 && data.demandes.total > 0) {
    recommandations.push({
      titre:   "Améliorer le traitement des demandes RH",
      detail:  `Le taux d'acceptation de ${fmtPct(tauxAcceptation)} est insuffisant. Revoir les procédures de traitement des demandes et communiquer clairement les critères d'acceptation.`,
      urgence: "Moyenne",
    })
  }
  if (recommandations.length === 0) {
    recommandations.push({
      titre:   "Maintenir le niveau de performance",
      detail:  "Les indicateurs RH sont satisfaisants. Maintenir les bonnes pratiques et continuer à suivre l'évolution mensuelle des indicateurs.",
      urgence: "Faible",
    })
  }

  recommandations.forEach((rec, i) => {
    const urgColor: RGB = rec.urgence === "Haute" ? C.danger : rec.urgence === "Moyenne" ? C.warning : C.success
    const urgBg: RGB    = rec.urgence === "Haute" ? C.dangerBg : rec.urgence === "Moyenne" ? C.warningBg : C.successBg

    doc.setFillColor(...urgBg)
    doc.setDrawColor(...urgColor)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, 6, 1, 1, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...urgColor)
    doc.text(`${i + 1}. ${rec.titre}  [${rec.urgence}]`, MARGIN + 4, y + 4)
    y += 8

    const recLines = doc.splitTextToSize(rec.detail, PAGE_W - 2*MARGIN - 12)
    doc.setFillColor(...C.grayLight)
    doc.roundedRect(MARGIN + 4, y, PAGE_W - 2*MARGIN - 8, recLines.length * 5 + 8, 2, 2, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.dark)
    doc.text(recLines, MARGIN + 10, y + 6)
    y += recLines.length * 5 + 14
  })

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // PAGE 8 — SYNTHÈSE FINALE
  // ══════════════════════════════════════════════════
  doc.addPage()
  y = addPageHeader(doc, options.entreprise, options.logoBase64)
  y = sectionHeader(doc, "Synthèse Finale", y, "📈")
  y += 8

  const synthKpis = [
    { label: "Taux de présence",    value: fmtPct(data.presence.taux_presence_pct),   color: taux >= 95 ? C.success : taux >= 85 ? C.warning : C.danger },
    { label: "Taux de ponctualité", value: fmtPct(data.presence.taux_ponctualite_pct), color: C.accent },
    { label: "Total demandes",      value: String(data.demandes.total),                color: C.primary },
    { label: "Total formations",    value: String(data.formations.length),             color: [14, 165, 233] as RGB },
  ]

  const skW = (PAGE_W - 2*MARGIN - 3*6) / 4
  let skX = MARGIN

  synthKpis.forEach(({ label, value, color }) => {
    doc.setFillColor(...C.grayLight)
    doc.roundedRect(skX, y, skW, 28, 3, 3, "F")

    doc.setFillColor(...color)
    doc.roundedRect(skX, y, skW, 3, 1, 1, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...color)
    doc.text(value, skX + skW / 2, y + 16, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(label.toUpperCase(), skX + skW / 2, y + 23, { align: "center" })

    skX += skW + 6
  })

  y += 38

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Indicateur", "Valeur", "Évaluation"]],
    body: [
      ["Taux de présence",            fmtPct(data.presence.taux_presence_pct),   taux >= 95 ? "🟢 Excellent" : taux >= 85 ? "🟡 Correct" : "🔴 Critique"],
      ["Taux de ponctualité",         fmtPct(data.presence.taux_ponctualite_pct), "—"],
      ["Total demandes traitées",     String(data.demandes.total),               "—"],
      ["Taux d'acceptation demandes", fmtPct(tauxAcceptation),                   tauxAcceptation >= 70 ? "🟢 Bon" : "🔴 À améliorer"],
      ["Total formations proposées",  String(data.formations.length),            "—"],
      ["Retard moyen",                fmtMinutes(data.presence.retard_moyen_min), retardMoy < 15 ? "🟢 Acceptable" : "🔴 Élevé"],
      ["Durée moy. travaillée",       fmtMinutes(data.presence.duree_moyenne_min), "—"],
    ],
    styles:          { fontSize: 9, cellPadding: 4 },
    headStyles:      { fillColor: C.primary, textColor: [255,255,255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: C.grayLight },
    columnStyles: {
      0: { fontStyle: "bold", textColor: C.dark },
      1: { halign: "center", fontStyle: "bold", textColor: C.accent },
      2: { halign: "center" },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 12

  const conclusionGene = taux >= 95
    ? `Les indicateurs RH de ${options.entreprise} pour la période ${periodeLabel} sont excellents. ` +
      `L'entreprise maintient un niveau de performance remarquable avec un taux de présence de ${fmtPct(taux)}.`
    : taux >= 85
    ? `Les indicateurs RH de ${options.entreprise} pour la période ${periodeLabel} sont globalement corrects. ` +
      `Quelques axes d'amélioration ont été identifiés pour optimiser la gestion des absences et des retards.`
    : `Les indicateurs RH de ${options.entreprise} pour la période ${periodeLabel} révèlent des difficultés importantes. ` +
      `Un plan d'action RH urgent est recommandé pour améliorer le taux de présence (${fmtPct(taux)}).`

  const concluLines = doc.splitTextToSize(conclusionGene, PAGE_W - 2*MARGIN - 16)
  doc.setFillColor(...C.light)
  doc.roundedRect(MARGIN, y, PAGE_W - 2*MARGIN, concluLines.length * 5 + 14, 4, 4, "F")
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN, y + concluLines.length * 5 + 14)
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9.5)
  doc.setTextColor(...C.primary)
  doc.text(concluLines, MARGIN + 8, y + 9)

  y += concluLines.length * 5 + 25
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.gray)
  doc.text(`Rapport généré automatiquement par le système RH iNET`, MARGIN, y)
  doc.text(`Le ${today} par ${options.utilisateur}`, MARGIN, y + 6)

  addFooter(doc, options.entreprise, options.utilisateur)

  // ══════════════════════════════════════════════════
  // IMPLÉMENTATION DES HELPERS LOCAUX
  // ══════════════════════════════════════════════════

  function addPageHeader(doc: jsPDF, entreprise: string, logo?: string): number {
    doc.setFillColor(...C.primary)
    doc.rect(0, 0, PAGE_W, 22, "F")

    if (logo) {
      try { doc.addImage(logo, "PNG", MARGIN, 3, 15, 10) } catch (_) {}
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(entreprise.toUpperCase(), logo ? MARGIN + 18 : MARGIN, 10)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Rapport RH — ${periodeLabel}`, logo ? MARGIN + 18 : MARGIN, 16)

    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, PAGE_W - MARGIN, 12, { align: "right" })

    return 32
  }

  function addFooter(doc: jsPDF, entreprise: string, utilisateur: string): void {
    const pageCount = (doc.internal as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      if (i === 1) continue

      doc.setFillColor(...C.grayLight)
      doc.rect(0, PAGE_H - 14, PAGE_W, 14, "F")
      doc.setDrawColor(...C.border)
      doc.setLineWidth(0.3)
      doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(...C.gray)
      doc.text(`© ${new Date().getFullYear()} ${entreprise} — Confidentiel`, MARGIN, PAGE_H - 6)
      doc.text(`Généré par ${utilisateur} · ${today}`, PAGE_W / 2, PAGE_H - 6, { align: "center" })
      doc.text(`Page ${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" })
    }
  }

  function sectionHeader(doc: jsPDF, title: string, y: number, icon?: string): number {
    doc.setFillColor(...C.accent)
    doc.rect(MARGIN, y, 3, 10, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...C.primary)
    doc.text(`${icon ? icon + "  " : ""}${title}`, MARGIN + 8, y + 7.5)

    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, y + 12, PAGE_W - MARGIN, y + 12)

    return y + 16
  }

  // ══════════════════════════════════════════════════
  // EXPORT
  // ══════════════════════════════════════════════════
  const filename = `rapport-rh-${options.entreprise.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`
  doc.save(filename)
}
