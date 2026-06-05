"use client"

/**
 * MapView — carte en lecture seule pour l'admin.
 * Affiche un marker sur les coordonnées d'une mission.
 */

import { useEffect, useRef } from "react"
import { MapPin } from "lucide-react"

interface MapViewProps {
  lat: number
  lng: number
  adresse?: string | null
  zoom?: number
}

export default function MapView({ lat, lng, adresse, zoom = 13 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    import("leaflet").then(L => {
      // Sécurité anti-double-init
      if (mapRef.current) return

      const icon = L.icon({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize:  [25, 41],
        iconAnchor: [12, 41],
      })

      const map = L.map(containerRef.current!, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: false,
      })

      // Tiles OSM en Français
      L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map)

      const marker = L.marker([lat, lng], { icon }).addTo(map)
      if (adresse) {
        marker
          .bindPopup(`<b>${adresse.split(",")[0]}</b><br/>${adresse.split(",").slice(1, 3).join(",")}`)
          .openPopup()
      }

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, adresse, zoom])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {adresse && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-600">
          <MapPin className="size-3.5 text-primary shrink-0" />
          <span className="truncate">{adresse}</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-44" />
    </div>
  )
}
