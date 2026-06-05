import sys

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = '{/* Edit Dialog */}'
start_index = content.find(start_str)

if start_index == -1:
    print("Could not find start string")
    sys.exit(1)

# Find the next </Dialog>
end_index = content.find('</Dialog>', start_index) + len('</Dialog>')

new_block = '''{/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la formation</DialogTitle>
            <DialogDescription>Modifiez les informations de la formation</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleModifier} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={titre} onChange={(e) => setTitre(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Debut</Label>
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duree (heures)</Label>
                <Input type="number" value={duree} onChange={(e) => setDuree(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre de places</Label>
                <Input type="number" value={nombrePlaces} onChange={(e) => setNombrePlaces(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="space-y-2">
              <Label>Organisateur</Label>
              <Input value={organisateur} onChange={(e) => setOrganisateur(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />
            </div>
            <div className="space-y-3">
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={loading}>{loading ? "..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>'''

new_content = content[:start_index] + new_block + content[end_index:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
