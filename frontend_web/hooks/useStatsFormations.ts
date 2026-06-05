import useSWR from "swr"
import { swrFetcher } from "@/lib/api"

export function useStatsFormations(filters: any) {
  const params: Record<string, any> = {
    type_periode: filters.type_periode,
  }

  if (filters.departement_id) params.departement_id = filters.departement_id
  if (filters.type) params.type = filters.type
  
  if (['jour', 'mois', 'annee'].includes(filters.type_periode)) {
    if (filters.date) params.date = filters.date
  }
  
  if (filters.type_periode === 'periode') {
    if (filters.date_debut) params.date_debut = filters.date_debut
    if (filters.date_fin) params.date_fin = filters.date_fin
  }

  const query = new URLSearchParams(params).toString()
  const key = query ? `/stats/admin/formations?${query}` : null

  const { data, error, isLoading, mutate } = useSWR<any>(key, swrFetcher)

  return { 
    data, 
    loading: isLoading,
    error,
    mutate
  }
}
