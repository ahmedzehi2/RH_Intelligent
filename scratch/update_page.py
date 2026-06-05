import sys

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import { GraduationCap, Plus, Calendar, Pencil, Trash2, Users, X, UserPlus, Search } from "lucide-react"',
    'import { GraduationCap, Plus, Calendar, Pencil, Trash2, Users, X, UserPlus, Search, Eye, CalendarDays } from "lucide-react"'
)
content = content.replace(
    'import { formationApi, employeApi, type FormationParticipantRow, type FormationRow, type EmployeRow } from "@/lib/api"',
    'import { formationApi, employeApi, type FormationParticipantRow, type FormationRow, type EmployeRow, type JourProgramme } from "@/lib/api"'
)

# 2. States
content = content.replace(
    'const [loading, setLoading] = useState(false)',
    'const [heureDebut, setHeureDebut] = useState("")\n  const [heureFin, setHeureFin] = useState("")\n  const [programme, setProgramme] = useState<JourProgramme[]>([])\n  const [loading, setLoading] = useState(false)\n  const [viewFormation, setViewFormation] = useState<FormationRow | null>(null)'
)

# 3. resetForm
content = content.replace(
    'setDescription(""); setDuree(""); setNombrePlaces(""); setLieu("")',
    'setDescription(""); setDuree(""); setNombrePlaces(""); setLieu(""); setHeureDebut(""); setHeureFin(""); setProgramme([])'
)

# 4. Add Jour functions inside component
content = content.replace(
    'const resetForm = () => {',
    '''const addJour = () => {
    setProgramme(prev => [...prev, {
      jour: `Jour ${prev.length + 1}`,
      date: "",
      titre: "",
      details: "",
    }])
  }

  const removeJour = (index: number) =>
    setProgramme(prev => prev.filter((_, i) => i !== index))

  const updateJour = (index: number, field: keyof JourProgramme, value: string) =>
    setProgramme(prev => prev.map((j, i) => i === index ? { ...j, [field]: value } : j))

  const resetForm = () => {'''
)

# 5. Validation in handleAjouter & handleModifier
ajouter_validation = '''if (heureFin && heureDebut && heureFin <= heureDebut) {
      toast.error("L'heure de fin doit être après l'heure de début")
      return
    }
    for (const [i, jour] of programme.entries()) {
      if (!jour.date || !jour.titre) {
        toast.error(`Jour ${i + 1} : date et titre obligatoires`)
        return
      }
    }
    setLoading(true)'''
content = content.replace('setLoading(true)', ajouter_validation, 2) # replaces the first two (ajouter and modifier)

# 6. Payload updates in handleAjouter & handleModifier
payload_update = '''lieu: lieu || undefined,
        heure_debut: heureDebut || undefined,
        heure_fin: heureFin || undefined,
        programme_details: programme.length > 0 ? programme : undefined'''
content = content.replace('lieu: lieu || undefined', payload_update)

# 7. openEdit state updates
open_edit_update = '''setLieu(f.lieu || "")
    setHeureDebut(f.heure_debut || "")
    setHeureFin(f.heure_fin || "")
    setProgramme(f.programme_details || [])'''
content = content.replace('setLieu(f.lieu || "")', open_edit_update)

# 8. UI changes in Form (adding horaires and programme)
horaires_ui = '''<div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500">Heure début</label>
                    <input
                      type="time"
                      value={heureDebut}
                      onChange={e => setHeureDebut(e.target.value)}
                      className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500">Heure fin</label>
                    <input
                      type="time"
                      value={heureFin}
                      onChange={e => setHeureFin(e.target.value)}
                      className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition"
                    />
                  </div>
                </div>'''

programme_ui = '''<div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      📅 Programme détaillé
                    </label>
                    <button
                      type="button"
                      onClick={addJour}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition"
                    >
                      + Ajouter un jour
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {programme.map((jour, index) => (
                      <div
                        key={index}
                        className="relative bg-white/70 backdrop-blur-sm border border-indigo-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-300"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                            {jour.jour || `Jour ${index + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeJour(index)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50"
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                          <input
                            type="text"
                            placeholder="Intitulé (Jour 1)"
                            value={jour.jour}
                            onChange={e => updateJour(index, "jour", e.target.value)}
                            className="h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                          />
                          <input
                            type="date"
                            value={jour.date}
                            onChange={e => updateJour(index, "date", e.target.value)}
                            className="h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Titre de la journée"
                          value={jour.titre}
                          onChange={e => updateJour(index, "titre", e.target.value)}
                          className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition mb-2.5"
                        />
                        <textarea
                          rows={2}
                          placeholder="Détails du programme..."
                          value={jour.details || ""}
                          onChange={e => updateJour(index, "details", e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>'''

# Replace in add form
content = content.replace(
    '<div className="grid grid-cols-1 gap-3">\n                  <div className="space-y-2">\n                    <Label>Lieu</Label>\n                    <Input placeholder="Ex: Salle A" value={lieu} onChange={(e) => setLieu(e.target.value)} />\n                  </div>\n                </div>',
    '<div className="grid grid-cols-1 gap-3">\n                  <div className="space-y-2">\n                    <Label>Lieu</Label>\n                    <Input placeholder="Ex: Salle A" value={lieu} onChange={(e) => setLieu(e.target.value)} />\n                  </div>\n                </div>\n                ' + horaires_ui
)

content = content.replace(
    '<div className="space-y-2">\n                  <Label>Type *</Label>\n                  <Input placeholder="Ex: Technique, Soft skills" value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />\n                </div>\n                <Button type="submit" className="w-full" disabled={loading}>\n                  {loading ? "Ajout..." : "Ajouter"}\n                </Button>',
    '<div className="space-y-2">\n                  <Label>Type *</Label>\n                  <Input placeholder="Ex: Technique, Soft skills" value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />\n                </div>\n                ' + programme_ui + '\n                <Button type="submit" className="w-full" disabled={loading}>\n                  {loading ? "Ajout..." : "Ajouter"}\n                </Button>'
)

# Replace in edit form
content = content.replace(
    '<div className="grid grid-cols-1 gap-3">\n              <div className="space-y-2">\n                <Label>Lieu</Label>\n                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />\n              </div>\n            </div>',
    '<div className="grid grid-cols-1 gap-3">\n              <div className="space-y-2">\n                <Label>Lieu</Label>\n                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />\n              </div>\n            </div>\n            ' + horaires_ui
)

content = content.replace(
    '<div className="space-y-2">\n              <Label>Type</Label>\n              <Input value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />\n            </div>\n            <DialogFooter>',
    '<div className="space-y-2">\n              <Label>Type</Label>\n              <Input value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />\n            </div>\n            ' + programme_ui + '\n            <DialogFooter>'
)

# 9. Table headers and rows
content = content.replace(
    '<TableHead>Type</TableHead>\n                      <TableHead>Places</TableHead>',
    '<TableHead>Type</TableHead>\n                      <TableHead>Horaires</TableHead>\n                      <TableHead>Places</TableHead>'
)

badge = '''<TableCell><Badge variant="outline">{f.type_formation || "-"}
{(f.programme_details?.length ?? 0) > 1 && (
  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
    Multi-jours
  </span>
)}
</Badge></TableCell>
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                            {f.heure_debut && f.heure_fin ? `${f.heure_debut} → ${f.heure_fin}` : "—"}
                          </TableCell>'''

content = content.replace('<TableCell><Badge variant="outline">{f.type_formation || "-"}</Badge></TableCell>', badge)


# 10. Eye button
eye_btn = '''<Button variant="ghost" size="icon-sm" onClick={() => setViewFormation(f)} title="Consulter" className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                                <Eye className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => openParticipants(f)}'''

content = content.replace('<Button variant="ghost" size="icon-sm" onClick={() => openParticipants(f)}', eye_btn)

# 11. Modal consultation
modal_ui = '''{viewFormation && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
       onClick={() => setViewFormation(null)}>
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">
            Formation
          </p>
          <h2 className="text-lg font-bold text-white">{viewFormation.titre}</h2>
          {viewFormation.heure_debut && viewFormation.heure_fin && (
            <p className="text-sm text-indigo-200 mt-1">
              🕐 {viewFormation.heure_debut} → {viewFormation.heure_fin}
            </p>
          )}
        </div>
        <button
          onClick={() => setViewFormation(null)}
          className="text-indigo-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors mt-0.5"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100 text-xs">
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Dates</p>
          <p className="font-semibold text-gray-800">
            {viewFormation.date_debut} → {viewFormation.date_fin}
          </p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Type</p>
          <p className="font-semibold text-gray-800">{viewFormation.type_formation || "—"}</p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Programme</p>
          <p className="font-semibold text-gray-800">
            {viewFormation.programme_details?.length
              ? `${viewFormation.programme_details.length} jour(s)`
              : "Non défini"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {viewFormation.programme_details?.length ? (
          <div className="space-y-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Programme détaillé
            </p>
            {viewFormation.programme_details.map((jour, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                    {index + 1}
                  </div>
                  {index < viewFormation.programme_details!.length - 1 && (
                    <div className="w-0.5 bg-indigo-200 flex-1 my-1.5 min-h-[20px]" />
                  )}
                </div>
                <div className={`flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-3 hover:border-indigo-200 hover:shadow-md transition-all duration-200 ${index < viewFormation.programme_details!.length - 1 ? "mb-0" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {jour.jour}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 mt-1.5">
                        {jour.titre}
                      </h3>
                    </div>
                    {jour.date && (
                      <span className="text-[11px] text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                        📅 {jour.date}
                      </span>
                    )}
                  </div>
                  {jour.details && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {jour.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-300">
            <CalendarDays className="size-10" />
            <p className="text-sm font-medium">Aucun programme défini</p>
            <p className="text-xs">Modifiez la formation pour ajouter un programme</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => setViewFormation(null)}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
)}
    </>'''

content = content.replace('</>\n  )\n}\n', modal_ui + '\n  )\n}\n')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
