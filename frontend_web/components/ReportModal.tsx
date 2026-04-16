import { X } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export default function ReportModal({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Rapport RH — ' + data.meta.periode, 14, 20)

    autoTable(doc, {
      startY: 30,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Taux absentéisme', data.kpi.taux_absenteisme + '%'],
        ['Taux de retard',   data.kpi.taux_retard + '%'],
        ['Heures travaillées', data.kpi.heures_total + 'h'],
        ['Congés consommés', data.kpi.conges + ' jours'],
      ]
    })
    
    // Add additional sections to PDF
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Département', 'Employés', 'Taux Présence']],
      body: data.par_dept.map((d: any) => [d.nom, d.nb_emp, d.taux + '%'])
    })

    doc.save(`rapport-rh-${data.meta.periode}.pdf`)
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.kpi]), 'KPI')
    
    // Unroll nested arrays for excel
    const flatDepts = data.par_dept.map((d: any) => ({
      ID: d.id,
      Nom: d.nom,
      Employes: d.nb_emp,
      Taux_Presence: d.taux
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatDepts), 'Départements')
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.top_insights), 'Insights')
    XLSX.writeFile(wb, `rapport-rh-${data.meta.periode}.xlsx`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[800px] max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Rapport RH Consolidé</h2>
            <p className="text-sm text-gray-500 mt-1">
              Période : {data.meta.periode} — Effectif couvert : {data.meta.nb_employes} employés
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
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.kpi.taux_absenteisme}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Taux de retard</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.kpi.taux_retard}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Heures moy. / jour</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.kpi.heures_moy_employe}h</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Congés consommés</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.kpi.conges} j</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3 border-b pb-1">Insights Automatiques</h3>
            <div className="space-y-2">
              {data.top_insights.length === 0 && <p className="text-sm text-gray-500">Aucun insight majeur sur cette période.</p>}
              {data.top_insights.map((insight: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-700 bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                  <span className="text-lg">{insight.icon}</span>
                  <span className="leading-relaxed">{insight.message}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
