import sys

file_path = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\stats\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define the duplicated block exactly as it appears
duplicated_block = """      {/* Section IA Insights & Heatmap */}
      {rawData?.ia && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">🤖 IA Insights</h3>
              <p className="text-xs text-gray-400">Analyse comportementale automatique</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium
              ${rawData.ia.score_global > 70 ? 'bg-red-100 text-red-700' :
                rawData.ia.score_global > 40 ? 'bg-orange-100 text-orange-700' :
                                            'bg-green-100 text-green-700'}`}>
              Score global : {rawData.ia.score_global}/100
            </span>
          </div>

          {/* Top 5 employés à risque */}
          <div className="space-y-2 mb-4">
            {rawData.ia.employes_risque?.map((emp: any) => (
              <div key={emp.id}
                   className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0
                  ${emp.color === 'red'    ? 'bg-red-500' :
                    emp.color === 'orange' ? 'bg-orange-400' : 'bg-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {emp.nom} {emp.prenom}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {emp.patterns?.[0] ?? emp.dept}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold
                    ${emp.color === 'red'    ? 'text-red-600' :
                      emp.color === 'orange' ? 'text-orange-500' : 'text-green-600'}`}>
                    {emp.label}
                  </p>
                  <p className="text-xs text-gray-400">{emp.score}/100</p>
                </div>
              </div>
            ))}
            {(!rawData.ia.employes_risque || rawData.ia.employes_risque.length === 0) && (
              <p className="text-xs text-gray-400 text-center py-2">Aucun profil à risque n'émerge ce mois-ci.</p>
            )}
          </div>

          {/* Alertes automatiques */}
          {rawData.ia.alertes?.length > 0 && (
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              {rawData.ia.alertes.slice(0, 3).map((a: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                  ${a.niveau === 'danger'  ? 'bg-red-50 text-red-700' :
                    a.niveau === 'warning' ? 'bg-orange-50 text-orange-700' :
                                             'bg-green-50 text-green-700'}`}>
                  <span className="shrink-0 mt-0.5">
                    {a.niveau === 'danger' ? '🔴' : a.niveau === 'warning' ? '🟠' : '🟢'}
                  </span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          {(!rawData.ia.alertes || rawData.ia.alertes.length === 0) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs">
              <span>🟢</span>
              <span>Aucune anomalie détectée — équipe stable</span>
            </div>
          )}
        </div>

        {/* Heatmap absences BONUS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">📅 Répartition des Absences</h3>
          <p className="text-xs text-gray-400 mb-6">Distribution par jour de la semaine</p>
          
          <div className="flex gap-2 items-end flex-1 mt-auto pb-2">
            {rawData.ia.heatmap?.map((d: any) => {
              const maxTaux = Math.max(...rawData.ia.heatmap.map((h: any) => h.taux), 1);
              const pct = d.taux / maxTaux;
              const h = Math.max(pct * 100, 4);
              const bg = d.taux > 30 ? 'bg-red-400' : d.taux > 15 ? 'bg-orange-300' : 'bg-indigo-300';
              
              return (
                <div key={d.jour} className="flex-1 flex flex-col justify-end text-center group cursor-help relative">
                  <div 
                    className={`w-full ${bg} rounded-md transition-all duration-300`}
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs text-gray-500 mt-2 font-medium">{d.jour}</span>
                  
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.taux}% ({d.count} abs.)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}"""

# Replace all occurrences of the block with a simple component call
replacement_call = "      <IAInsightsPanel iaData={rawData?.ia} />"
new_content = content.replace(duplicated_block, replacement_call)

# Now, we need to inject the IAInsightsPanel definition right before StatsPage component
component_definition = """
// ─── IA Insights Panel ─────────────────────────────────────────────────────
function IAInsightsPanel({ iaData }: { iaData: any }) {
  if (!iaData) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">🤖 IA Insights</h3>
            <p className="text-xs text-gray-400">Analyse comportementale automatique</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium
            ${iaData.score_global > 70 ? 'bg-red-100 text-red-700' :
              iaData.score_global > 40 ? 'bg-orange-100 text-orange-700' :
                                          'bg-green-100 text-green-700'}`}>
            Score global : {iaData.score_global}/100
          </span>
        </div>

        {/* Top 5 employés à risque */}
        <div className="space-y-2 mb-4">
          {iaData.employes_risque?.map((emp: any) => (
            <div key={emp.id}
                 className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <span className={`w-2 h-2 rounded-full shrink-0
                ${emp.color === 'red'    ? 'bg-red-500' :
                  emp.color === 'orange' ? 'bg-orange-400' : 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {emp.nom} {emp.prenom}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {emp.patterns?.[0] ?? emp.dept}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold
                  ${emp.color === 'red'    ? 'text-red-600' :
                    emp.color === 'orange' ? 'text-orange-500' : 'text-green-600'}`}>
                  {emp.label}
                </p>
                <p className="text-xs text-gray-400">{emp.score}/100</p>
              </div>
            </div>
          ))}
          {(!iaData.employes_risque || iaData.employes_risque.length === 0) && (
            <p className="text-xs text-gray-400 text-center py-2">Aucun profil à risque n'émerge ce mois-ci.</p>
          )}
        </div>

        {/* Alertes automatiques */}
        {iaData.alertes?.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            {iaData.alertes.slice(0, 3).map((a: any, i: number) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                ${a.niveau === 'danger'  ? 'bg-red-50 text-red-700' :
                  a.niveau === 'warning' ? 'bg-orange-50 text-orange-700' :
                                           'bg-green-50 text-green-700'}`}>
                <span className="shrink-0 mt-0.5">
                  {a.niveau === 'danger' ? '🔴' : a.niveau === 'warning' ? '🟠' : '🟢'}
                </span>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {(!iaData.alertes || iaData.alertes.length === 0) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs">
            <span>🟢</span>
            <span>Aucune anomalie détectée — équipe stable</span>
          </div>
        )}
      </div>

      {/* Heatmap absences BONUS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">📅 Répartition des Absences</h3>
        <p className="text-xs text-gray-400 mb-6">Distribution par jour de la semaine</p>
        
        <div className="flex gap-2 items-end flex-1 mt-auto pb-2">
          {iaData.heatmap?.map((d: any) => {
            const maxTaux = Math.max(...iaData.heatmap.map((h: any) => h.taux), 1);
            const pct = d.taux / maxTaux;
            const h = Math.max(pct * 100, 4);
            const bg = d.taux > 30 ? 'bg-red-400' : d.taux > 15 ? 'bg-orange-300' : 'bg-indigo-300';
            
            return (
              <div key={d.jour} className="flex-1 flex flex-col justify-end text-center group cursor-help relative">
                <div 
                  className={`w-full ${bg} rounded-md transition-all duration-300`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-xs text-gray-500 mt-2 font-medium">{d.jour}</span>
                
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {d.taux}% ({d.count} abs.)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
"""

new_content = new_content.replace("// ─── Main Component ────────────────────────────────────────────────────────", component_definition)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done replacing.")
