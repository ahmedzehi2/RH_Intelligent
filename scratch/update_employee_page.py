import sys

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\employee\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import { GraduationCap, Calendar, Clock, MapPin, Building, CheckCircle, XCircle, Users } from "lucide-react"',
    'import { GraduationCap, Calendar, Clock, MapPin, Building, CheckCircle, XCircle, Users, Eye, CalendarDays } from "lucide-react"'
)

# 2. State
content = content.replace(
    'const [inscribing, setInscribing] = useState<number | null>(null)',
    'const [inscribing, setInscribing] = useState<number | null>(null)\n  const [viewFormation, setViewFormation] = useState<FormationRow | null>(null)'
)

# 3. Add button "Voir détails" to the available formations cards
old_available_footer = '''                      <CardFooter className="pt-3">
                        {isInscrit ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4" />
                            {isLoading ? "..." : "Se desinscrire"}
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleInscrire(formation)}
                            disabled={isLoading || isFull}
                          >
                            <CheckCircle className="size-4" />
                            {isLoading ? "Inscription..." : isFull ? "Complet" : "S'inscrire"}
                          </Button>
                        )}
                      </CardFooter>'''

new_available_footer = '''                      <CardFooter className="pt-3 flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          onClick={() => setViewFormation(formation)}
                        >
                          <Eye className="size-4 mr-2" />
                          Voir détails
                        </Button>
                        {isInscrit ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4 mr-2" />
                            {isLoading ? "..." : "Se désinscrire"}
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleInscrire(formation)}
                            disabled={isLoading || isFull}
                          >
                            <CheckCircle className="size-4 mr-2" />
                            {isLoading ? "Inscription..." : isFull ? "Complet" : "S'inscrire"}
                          </Button>
                        )}
                      </CardFooter>'''

content = content.replace(old_available_footer, new_available_footer)

# 4. Add button "Voir détails" to my formations cards
old_my_footer = '''                      <CardFooter className="pt-3">
                        {status.label !== "Terminee" && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4" />
                            {isLoading ? "..." : "Se desinscrire"}
                          </Button>
                        )}
                        {status.label === "Terminee" && (
                          <Badge variant="secondary" className="w-full justify-center py-2">
                            <CheckCircle className="size-4" />
                            Formation completee
                          </Badge>
                        )}
                      </CardFooter>'''

new_my_footer = '''                      <CardFooter className="pt-3 flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          onClick={() => setViewFormation(formation)}
                        >
                          <Eye className="size-4 mr-2" />
                          Voir détails
                        </Button>
                        {status.label !== "Terminee" && (
                          <Button
                            variant="outline"
                            className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4 mr-2" />
                            {isLoading ? "..." : "Se désinscrire"}
                          </Button>
                        )}
                        {status.label === "Terminee" && (
                          <Badge variant="secondary" className="w-full justify-center py-2 bg-gray-100">
                            <CheckCircle className="size-4 mr-2" />
                            Formation complétée
                          </Badge>
                        )}
                      </CardFooter>'''

content = content.replace(old_my_footer, new_my_footer)

# 5. Add Modal to the bottom
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
            Détails de la formation
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
            {formatDate(viewFormation.date_debut)} → {formatDate(viewFormation.date_fin)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Organisateur</p>
          <p className="font-semibold text-gray-800">{viewFormation.organisateur || "—"}</p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Lieu</p>
          <p className="font-semibold text-gray-800">{viewFormation.lieu || "—"}</p>
        </div>
      </div>

      <div className="px-6 py-4 bg-white border-b border-gray-100 text-sm">
        <p className="text-gray-700 leading-relaxed">
          {viewFormation.description || "Aucune description fournie pour cette formation."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50/30">
        {viewFormation.programme_details?.length ? (
          <div className="space-y-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              📅 Programme détaillé ({viewFormation.programme_details.length} jours)
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
                    <div className="flex flex-col items-end gap-1">
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
                  </div>
                  {jour.details && (
                    <p className="text-xs text-gray-500 leading-relaxed mt-2">
                      {jour.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-300">
            <CalendarDays className="size-10" />
            <p className="text-sm font-medium text-gray-400">Aucun programme détaillé disponible</p>
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
)}'''

content = content.replace('</>\n  )\n}\n', modal_ui + '\n    </>\n  )\n}\n')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
