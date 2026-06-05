import { useQuery } from "@tanstack/react-query"
import { statsApi } from "@/lib/api"

export function useStatsBI(filters: any) {
  // Remap filters to match the new endpoints
  const params: Record<string, any> = {
    type_periode: filters.type_periode,
  }

  if (filters.departement_id) params.departement_id = filters.departement_id
  if (filters.sous_departement_id) params.sous_departement_id = filters.sous_departement_id
  
  if (['jour', 'mois', 'annee'].includes(filters.type_periode)) {
    if (filters.date) params.date = filters.date
  }
  
  if (filters.type_periode === 'periode') {
    if (filters.date_debut) params.date_debut = filters.date_debut
    if (filters.date_fin) params.date_fin = filters.date_fin
  }

  const queryKey = ["statsBI", params]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // statsApi.dashboardBi returns { ok: true, ...data }
      const res = await statsApi.dashboardBi(params)
      // Since res already throws an error if !ok in lib/api.ts, we can just return res
      return res
    },
    // Keep it enabled only if we have necessary filter conditions, but usually we always do.
  })

  return { 
    data: query.data, 
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    mutate: query.refetch, // alias for backwards compatibility
  }
}
