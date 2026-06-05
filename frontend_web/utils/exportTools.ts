import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export const exportExcelData = (data: any, tabName: string) => {
  if (!data) return
  const wb = XLSX.utils.book_new()
  if (tabName === 'demandes') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.kpi]), 'KPI')
    if (data.types) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.types), 'Types')
    if (data.top_demandeurs) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.top_demandeurs), 'Top Demandeurs')
    if (data.evolution) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.evolution), 'Evolution')
  } else if (tabName === 'formations') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.kpi]), 'KPI')
    if (data.par_dept) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.par_dept), 'Par Département')
    if (data.top_formations) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.top_formations), 'Top Formations')
    if (data.evolution) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.evolution), 'Evolution')
  }
  XLSX.writeFile(wb, `export-${tabName}-${new Date().toISOString().slice(0,10)}.xlsx`)
}

export const exportPDFData = (data: any, tabName: string) => {
  if (!data) return
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(`Rapport ${tabName.toUpperCase()}`, 14, 20)
  
  if (tabName === 'demandes') {
    autoTable(doc, { 
      startY: 30, 
      head: [['Indicateur', 'Valeur']], 
      body: [
        ['Demandes totales', String(data.kpi?.total || 0)],
        ['En attente', String(data.kpi?.pending || 0)],
        ['Approuvées', String(data.kpi?.approved || 0)],
        ['Refusées', String(data.kpi?.refused || 0)],
      ]
    })
    if (data.top_demandeurs && data.top_demandeurs.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Demandeur', 'Département', 'Nb Demandes']],
        body: data.top_demandeurs.map((d: any) => [`${d.nom} ${d.prenom}`, d.departement, d.nb_demandes])
      })
    }
  } else if (tabName === 'formations') {
    autoTable(doc, { 
      startY: 30, 
      head: [['Indicateur', 'Valeur']], 
      body: [
        ['Formations totales', String(data.kpi?.total || 0)],
        ['Employés formés', String(data.kpi?.nb_formes || 0)],
        ['Taux participation', `${data.kpi?.taux_participation || 0}%`],
        ['Score moyen', `${data.kpi?.score_moyen || 0}/5`],
      ]
    })
    if (data.top_formations && data.top_formations.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Titre', 'Type', 'Participants']],
        body: data.top_formations.map((f: any) => [f.titre, f.type, f.nb_participants])
      })
    }
  }
  doc.save(`export-${tabName}-${new Date().toISOString().slice(0,10)}.pdf`)
}
