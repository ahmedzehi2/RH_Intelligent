import sys
import re

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old block to replace
# We need to capture the exact block from line 569 to 687 approximately
# But since the file has changed, it's better to use a regex or a very specific string match

old_block_pattern = r'\{\/\* Edit Dialog \*\/\}\s*<Dialog open=\{editDialog\} onOpenChange=\{setEditDialog\}>.*?<\/Dialog>'

# The new block content
new_block = '''{/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent 
          className="w-[95vw] max-w-6xl h-[92vh] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
        >
          <form onSubmit={handleModifier} className="flex flex-col h-full overflow-hidden bg-white">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 backdrop-blur-xl border-b bg-white/90 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-sky-50 p-2.5 rounded-2xl">
                  <Pencil className="size-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Modifier la formation</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {editFormation && (
                      <Badge variant={getFormationStatus(editFormation).variant}>
                        {getFormationStatus(editFormation).label}
                      </Badge>
                    )}
                    {programme.length > 1 && (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">
                        Multi-jours ({programme.length})
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => setEditDialog(false)}
                className="rounded-full hover:bg-gray-100"
              >
                <X className="size-5 text-gray-500" />
              </Button>
            </div>

            {/* Body Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="lg:grid lg:grid-cols-3 gap-8">
                {/* Colonne gauche (2 cols) - Infos principales */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Titre de la formation</Label>
                      <Input 
                        placeholder="Ex: Masterclass React Avancé" 
                        value={titre} 
                        onChange={(e) => setTitre(e.target.value)} 
                        required 
                        className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Description détaillée</Label>
                      <Textarea 
                        placeholder="Objectifs, prérequis, etc." 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        rows={4} 
                        className="rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Date de début</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                          <Input 
                            type="date" 
                            value={dateDebut} 
                            onChange={(e) => setDateDebut(e.target.value)} 
                            required 
                            className="h-11 pl-10 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Date de fin</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                          <Input 
                            type="date" 
                            value={dateFin} 
                            onChange={(e) => setDateFin(e.target.value)} 
                            required 
                            className="h-11 pl-10 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Heure de début (Global)</Label>
                        <Input 
                          type="time" 
                          value={heureDebut} 
                          onChange={e => setHeureDebut(e.target.value)} 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Heure de fin (Global)</Label>
                        <Input 
                          type="time" 
                          value={heureFin} 
                          onChange={e => setHeureFin(e.target.value)} 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Lieu / Plateforme</Label>
                        <Input 
                          placeholder="Ex: Salle de conférence B ou Zoom" 
                          value={lieu} 
                          onChange={(e) => setLieu(e.target.value)} 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Organisateur</Label>
                        <Input 
                          placeholder="Ex: Département RH" 
                          value={organisateur} 
                          onChange={(e) => setOrganisateur(e.target.value)} 
                          required 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Durée (h)</Label>
                        <Input 
                          type="number" 
                          placeholder="16" 
                          value={duree} 
                          onChange={(e) => setDuree(e.target.value)} 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Places</Label>
                        <Input 
                          type="number" 
                          placeholder="20" 
                          value={nombrePlaces} 
                          onChange={(e) => setNombrePlaces(e.target.value)} 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Type</Label>
                        <Input 
                          placeholder="Technique" 
                          value={typeFormation} 
                          onChange={(e) => setTypeFormation(e.target.value)} 
                          required 
                          className="h-11 rounded-xl border-gray-200 focus:border-sky-400 focus:ring-sky-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colonne droite (1 col) - Programme détaillé */}
                <div className="space-y-4 lg:sticky lg:top-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      📅 Programme détaillé
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addJour}
                      className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                    >
                      <Plus className="size-3.5 mr-1.5" />
                      Ajouter un jour
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 scrollbar-hide lg:max-h-[60vh]">
                    {programme.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-100 rounded-2xl p-8 text-center bg-gray-50/50">
                        <CalendarDays className="size-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-xs text-gray-400">Aucun programme défini pour le moment</p>
                      </div>
                    ) : (
                      programme.map((jour, index) => (
                        <Card 
                          key={index}
                          className="rounded-2xl border-indigo-100 bg-white shadow-sm hover:shadow-md transition-all animate-in slide-in-from-right-4 duration-300"
                        >
                          <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-tight">
                                {jour.jour || `Jour ${index + 1}`}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeJour(index)}
                                className="size-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Libellé</Label>
                                <Input
                                  placeholder="Jour 1"
                                  value={jour.jour}
                                  onChange={e => updateJour(index, "jour", e.target.value)}
                                  className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Date</Label>
                                <Input
                                  type="date"
                                  value={jour.date}
                                  onChange={e => updateJour(index, "date", e.target.value)}
                                  className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/50"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Début</Label>
                                <Input
                                  type="time"
                                  value={jour.heure_debut || ""}
                                  onChange={e => updateJour(index, "heure_debut", e.target.value)}
                                  className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Fin</Label>
                                <Input
                                  type="time"
                                  value={jour.heure_fin || ""}
                                  onChange={e => updateJour(index, "heure_fin", e.target.value)}
                                  className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/50"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Sujet / Titre</Label>
                              <Input
                                placeholder="Titre de la session"
                                value={jour.titre}
                                onChange={e => updateJour(index, "titre", e.target.value)}
                                className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/50"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-medium text-gray-500 uppercase ml-1">Détails</Label>
                              <Textarea
                                placeholder="Détails du programme..."
                                value={jour.details || ""}
                                onChange={e => updateJour(index, "details", e.target.value)}
                                className="text-xs rounded-lg border-gray-200 bg-gray-50/50 min-h-[60px] resize-none"
                              />
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Sticky */}
            <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t px-6 py-4 flex items-center justify-between gap-4">
              <p className="text-[10px] text-gray-400 italic hidden sm:block">
                Dernière modification : {editFormation?.date_modification ? new Date(editFormation.date_modification).toLocaleDateString() : 'Jamais'}
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialog(false)}
                  className="flex-1 sm:flex-none rounded-xl border-gray-200 h-11 px-6 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 sm:flex-none rounded-xl bg-sky-600 text-white h-11 px-8 hover:bg-sky-700 shadow-lg shadow-sky-200 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement...
                    </div>
                  ) : (
                    "Enregistrer les modifications"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>'''

# Apply replacement
# Regex is risky if there are multiple Dialogs or complex nesting.
# I'll use a more direct replacement if possible.

# Let's find the exact start and end strings
start_str = '{/* Edit Dialog */}'
end_str = '</Dialog>'
# We need the first </Dialog> after {/* Edit Dialog */}

# Actually, the file has multiple Dialogs.
# I'll look for the block that matches 'editDialog'

start_index = content.find('{/* Edit Dialog */}')
if start_index != -1:
    # Find the matching </Dialog>
    # Since there might be nested tags (though unlikely for Dialog), I'll just find the next </Dialog>
    end_index = content.find('</Dialog>', start_index) + len('</Dialog>')
    new_content = content[:start_index] + new_block + content[end_index:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("Could not find Edit Dialog block")
    sys.exit(1)
