import os
import re

file_path = "frontend_web/app/(protected)/admin/stats/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
if "useStatsDemandes" not in content:
    content = content.replace(
        'import { useStatsBI } from "@/hooks/useStatsBI"',
        'import { useStatsBI } from "@/hooks/useStatsBI"\nimport { useStatsDemandes } from "@/hooks/useStatsDemandes"\nimport { useStatsFormations } from "@/hooks/useStatsFormations"\nimport { exportExcelData, exportPDFData } from "@/utils/exportTools"'
    )

# 2. Hooks call in StatsPage
if "const { data: demandesData" not in content:
    content = content.replace(
        'const { data: rawData, loading } = useStatsBI(filters)',
        'const { data: rawData, loading } = useStatsBI(filters)\n  const { data: demandesData, loading: demandesLoading } = useStatsDemandes(filters)\n  const { data: formationsData, loading: formationsLoading } = useStatsFormations(filters)'
    )

# 3. Add Tab4 and Tab5 before the Render section
TAB4_5_CODE = """
  // ══════════════════════════════════════════════════════════════════════
  // TAB 4 — Demandes RH
  // ══════════════════════════════════════════════════════════════════════
  const Tab4 = (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={() => exportExcelData(demandesData, 'demandes')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md text-xs font-semibold hover:bg-emerald-100 transition">↓ Excel</button>
        <button onClick={() => exportPDFData(demandesData, 'demandes')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-semibold hover:bg-red-100 transition">↓ PDF</button>
      </div>
      
      {/* Filters (Mockup for UI as global filters apply but we add specifics here if needed) */}
      <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none"
                value={filters.type || ""} onChange={e => setFilters((f:any) => ({...f, type: e.target.value}))}>
          <option value="">Tous les types de congés</option>
          <option value="Congé">Congé</option>
          <option value="Autorisation">Autorisation</option>
          <option value="Maladie">Maladie</option>
          <option value="Autre">Autre</option>
        </select>
        <input type="text" placeholder="Rechercher employé..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none" 
               onChange={e => {
                  /* Logic for employee search can be added later if needed */
               }} />
      </div>

      {demandesLoading ? (
        <div className="h-40 flex items-center justify-center text-gray-400">Chargement...</div>
      ) : !demandesData ? (
        <div className="h-40 flex items-center justify-center text-gray-400">Aucune donnée disponible</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Demandes totales" value={String(demandesData?.kpi?.total || 0)} subtitle="Toutes demandes" icon="📄" iconColor="bg-blue-50" />
            <KpiCard title="En attente" value={String(demandesData?.kpi?.pending || 0)} subtitle="En cours" icon="⏳" iconColor="bg-orange-50" />
            <KpiCard title="Approuvées" value={String(demandesData?.kpi?.approved || 0)} subtitle="Validées" icon="✅" iconColor="bg-green-50" />
            <KpiCard title="Refusées" value={String(demandesData?.kpi?.refused || 0)} subtitle="Rejetées" icon="❌" iconColor="bg-red-50" />
          </div>

          {demandesData?.alertes?.length ? <AlertBanner alertes={demandesData.alertes} /> : null}

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Évolution des demandes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {(demandesData?.evolution?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={demandesData.evolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="total" stroke="#6366f1" strokeWidth={2} name="Total" dot={false} activeDot={{ r: 4 }} />
                        <Line dataKey="approuve" stroke="#10b981" strokeWidth={2} name="Approuvées" dot={false} activeDot={{ r: 4 }} />
                        <Line dataKey="refuse" stroke="#ef4444" strokeWidth={2} name="Refusées" dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Répartition par type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {(demandesData?.types?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={demandesData.types} dataKey="value" nameKey="type" outerRadius={95} innerRadius={50}
                            label={({type, percent}) => `${type} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {demandesData.types.map((entry: any, i: number) => {
                            const colors = {"Congé": "#6366f1", "Autorisation": "#f59e0b", "Maladie": "#ef4444", "Autre": "#94a3b8"};
                            return <Cell key={i} fill={(colors as any)[entry.type] || "#cbd5e1"} />;
                          })}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 5 Demandeurs</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                {!demandesData?.top_demandeurs?.length ? (
                  <p className="text-xs text-gray-400 text-center py-4">Aucune donnée</p>
                ) : demandesData.top_demandeurs.map((e: any, i: number) => (
                  <div key={e.id || i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                                  'bg-orange-50 text-orange-600'}`}>{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{e.nom} {e.prenom}</span>
                    <span className="text-xs text-gray-400">{e.departement}</span>
                    <span className="text-sm font-semibold text-indigo-600">{e.nb_demandes} dem.</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // TAB 5 — Formations & Compétences
  // ══════════════════════════════════════════════════════════════════════
  const Tab5 = (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={() => exportExcelData(formationsData, 'formations')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md text-xs font-semibold hover:bg-emerald-100 transition">↓ Excel</button>
        <button onClick={() => exportPDFData(formationsData, 'formations')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-semibold hover:bg-red-100 transition">↓ PDF</button>
      </div>

      <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none"
                value={filters.type || ""} onChange={e => setFilters((f:any) => ({...f, type: e.target.value}))}>
          <option value="">Tous les types</option>
          {formationsData?.meta?.types?.map((t: string) => (
             <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none"
                value={filters.departement_id || ""} onChange={e => setFilters((f:any) => ({...f, departement_id: e.target.value}))}>
          <option value="">Tous les départements</option>
          {/* Note: we inherit global uniqueMainDepts from the page context */}
          {uniqueMainDepts.map((d: any) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
      </div>

      {formationsLoading ? (
        <div className="h-40 flex items-center justify-center text-gray-400">Chargement...</div>
      ) : !formationsData ? (
        <div className="h-40 flex items-center justify-center text-gray-400">Aucune donnée disponible</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Formations totales" value={String(formationsData?.kpi?.total || 0)} subtitle="Dispensées" icon="🎓" iconColor="bg-indigo-50" />
            <KpiCard title="Employés formés" value={String(formationsData?.kpi?.nb_formes || 0)} subtitle="Effectif touché" icon="👨‍🎓" iconColor="bg-blue-50" />
            <KpiCard title="Taux participation" value={`${formationsData?.kpi?.taux_participation || 0}%`} subtitle="Inscrits / Places" icon="📈" iconColor="bg-green-50" />
            <KpiCard title="Score moyen" value={`${formationsData?.kpi?.score_moyen || 0}/5`} subtitle="Satisfaction" icon="⭐" iconColor="bg-yellow-50" />
          </div>

          {formationsData?.alertes?.length ? <AlertBanner alertes={formationsData.alertes} /> : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Participation par département</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {(formationsData?.par_dept?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formationsData.par_dept} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis dataKey="departement" type="category" width={100} tick={{ fontSize: 10, fill: "#6b7280" }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="participants" fill="#6366f1" radius={[0,4,4,0]}>
                          <Cell />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Évolution formations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {(formationsData?.evolution?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formationsData.evolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="nb_formations" stroke="#6366f1" strokeWidth={2} name="Formations" dot={false} activeDot={{ r: 4 }} />
                        <Line dataKey="nb_participants" stroke="#10b981" strokeWidth={2} name="Participants" dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-semibold">Top Formations</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-2">
                  {!formationsData?.top_formations?.length ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucune donnée</p>
                  ) : formationsData.top_formations.map((f: any, i: number) => (
                    <div key={f.id || i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{f.titre}</p>
                        <p className="text-xs text-gray-400">{f.type} · {f.duree}h</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-600">{f.nb_participants} part.</p>
                        <p className="text-xs text-yellow-500">★ {f.score_moyen}/5</p>
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>
        </>
      )}
    </div>
  )
"""

if "TAB 4 — Demandes RH" not in content:
    content = content.replace(
        '// ══════════════════════════════════════════════════════════════════════\n  // RENDER',
        TAB4_5_CODE + '\n  // ══════════════════════════════════════════════════════════════════════\n  // RENDER'
    )

# 4. Add TabsTrigger and TabsContent
if 'value="demandes"' not in content:
    content = content.replace(
        '<TabsTrigger value="personnel" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">\n                  Composition Personnel\n                </TabsTrigger>',
        '<TabsTrigger value="personnel" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">\n                  Composition Personnel\n                </TabsTrigger>\n                <TabsTrigger value="demandes" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">\n                  Demandes RH\n                </TabsTrigger>\n                <TabsTrigger value="formations" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">\n                  Formations & Compétences\n                </TabsTrigger>'
    )
    
    content = content.replace(
        '<TabsContent value="personnel">{Tab3}</TabsContent>',
        '<TabsContent value="personnel">{Tab3}</TabsContent>\n              <TabsContent value="demandes">{Tab4}</TabsContent>\n              <TabsContent value="formations">{Tab5}</TabsContent>'
    )

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Page successfully updated!")
