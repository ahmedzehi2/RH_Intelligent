import sys

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update addJour
content = content.replace(
'''    setProgramme(prev => [...prev, {
      jour: `Jour ${prev.length + 1}`,
      date: "",
      titre: "",
      details: "",
    }])''',
'''    setProgramme(prev => [...prev, {
      jour: `Jour ${prev.length + 1}`,
      date: "",
      heure_debut: "",
      heure_fin: "",
      titre: "",
      details: "",
    }])'''
)

# 2. Update the inputs in the programme.map loop (it appears twice, once for Add, once for Edit)
# Actually, since the JSX block for "Programme détaillé" is identical in both forms, we can replace both instances.
old_jour_inputs = '''                        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
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
                        </div>'''

new_jour_inputs = '''                        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
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
                        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-400">De</span>
                            <input
                              type="time"
                              value={jour.heure_debut || ""}
                              onChange={e => updateJour(index, "heure_debut", e.target.value)}
                              className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-400">À</span>
                            <input
                              type="time"
                              value={jour.heure_fin || ""}
                              onChange={e => updateJour(index, "heure_fin", e.target.value)}
                              className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                            />
                          </div>
                        </div>'''

content = content.replace(old_jour_inputs, new_jour_inputs)

# 3. Update the modal view
old_modal_jour = '''                    {jour.date && (
                      <span className="text-[11px] text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                        📅 {jour.date}
                      </span>
                    )}
                  </div>'''

new_modal_jour = '''                    <div className="flex flex-col items-end gap-1">
                      {jour.date && (
                        <span className="text-[11px] text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                          📅 {jour.date}
                        </span>
                      )}
                      {jour.heure_debut && jour.heure_fin && (
                        <span className="text-[11px] text-indigo-500 font-semibold whitespace-nowrap bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          🕘 {jour.heure_debut} → {jour.heure_fin}
                        </span>
                      )}
                    </div>
                  </div>'''

content = content.replace(old_modal_jour, new_modal_jour)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
