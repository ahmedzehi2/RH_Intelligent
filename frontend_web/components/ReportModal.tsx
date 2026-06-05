import { X } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { formatMinutes } from "@/lib/utils"

export default function ReportModal({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null

  const depts = data.par_dept || data.presenceDepts || []
  const insights = data.top_insights || data.alertes || []
  const kpi = data.kpi || {}

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Rapport RH — ' + (data.meta?.periode || ''), 14, 20)

    autoTable(doc, {
      startY: 30,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Taux absentéisme', (kpi.taux_absenteisme || 0) + '%'],
        ['Taux de retard',   (kpi.taux_retard || 0) + '%'],
        ['Heures travaillées', formatMinutes(kpi.heures_total || 0)],
        ['Congés consommés', (kpi.conges || 0) + ' jours'],
      ]
    })
    
    // Add additional sections to PDF
    if (depts.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Département', 'Employés', 'Taux Présence']],
        body: depts.map((d: any) => [d.nom || 'N/A', d.nb_emp || 0, (d.taux || 0) + '%'])
      })
    }

    doc.save(`rapport-rh-${data.meta?.periode || 'export'}.pdf`)
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([kpi]), 'KPI')
    
    // Unroll nested arrays for excel
    const flatDepts = depts.map((d: any) => ({
      ID: d.id,
      Nom: d.nom,
      Employes: d.nb_emp,
      Taux_Presence: d.taux
    }))
    if (flatDepts.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatDepts), 'Départements')
    }
    
    if (insights.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(insights), 'Insights')
    }
    XLSX.writeFile(wb, `rapport-rh-${data.meta?.periode || 'export'}.xlsx`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[800px] max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Rapport RH Consolidé</h2>
            <p className="text-sm text-gray-500 mt-1">
              Période : {data.meta?.periode || 'N/A'} — Effectif couvert : {data.meta?.nb_employes || 0} employés
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportPDF}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
              ↓ Télécharger PDF
            </button>
            <button onClick={exportExcel}
                    className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors">
              ↓ Exporter Excel
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3 border-b pb-1">Indicateurs clés de performance</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Taux d'absentéisme</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.taux_absenteisme || 0}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Taux de retard</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.taux_retard || 0}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Heures moy. / jour</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatMinutes(kpi.heures_moy_employe || kpi.heures_moy_jour || 0)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Congés consommés</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.conges || 0} j</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3 border-b pb-1">Insights Automatiques</h3>
            <div className="space-y-2">
              {insights.length === 0 && <p className="text-sm text-gray-500">Aucun insight majeur sur cette période.</p>}
              {insights.map((insight: any, i: number) => {
                const icon = insight.icon || (insight.niveau === "danger" ? "🔴" : insight.niveau === "warning" ? "🟠" : "🟢")
                return (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700 bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                    <span className="text-lg">{icon}</span>
                    <span className="leading-relaxed">{insight.message}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
