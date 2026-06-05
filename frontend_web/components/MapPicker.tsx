"use client"

/**
 * MapPicker — composant Leaflet pour sélectionner un lieu sur une carte.
 * Utilise react-leaflet + Nominatim (OpenStreetMap) pour le géocodage inverse.
 * Aucune clé API requise.
 */

import { useEffect, useRef, useState } from "react"
import { MapPin, Loader2, Maximize2, Minimize2 } from "lucide-react"

export interface GeoLocation {
  lat: number
  lng: number
  adresse: string
}

interface MapPickerProps {
  value?: GeoLocation | null
  onChange: (loc: GeoLocation) => void
}

export default function MapPicker({ value, onChange }: MapPickerProps) {
  const mapRef       = useRef<any>(null)
  const markerRef    = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Centre par défaut : Tunisie (34.0, 9.0)
  const DEFAULT_LAT = 34.0
  const DEFAULT_LNG = 9.0
  const DEFAULT_ZOOM = 6

  useEffect(() => {
    if (!containerRef.current) return

    // Import dynamique (SSR safe)
    import("leaflet").then(L => {
      // Sécurité : éviter double init si useEffect a tourné 2 fois (Strict Mode)
      if (mapRef.current) return

      // Fix icône par défaut Leaflet (Next.js)
      const icon = L.icon({
        iconUrl:    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize:   [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      })

      const initLat = value?.lat ?? DEFAULT_LAT
      const initLng = value?.lng ?? DEFAULT_LNG

      const map = L.map(containerRef.current!, {
        center: [initLat, initLng],
        zoom: value?.lat ? 13 : DEFAULT_ZOOM,
        zoomControl: true,
      })

      // Tiles OSM en Français
      L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map)

      // Marker initial si value fourni
      if (value?.lat && value?.lng) {
        const m = L.marker([value.lat, value.lng], { icon, draggable: true }).addTo(map)
        markerRef.current = m
        bindDragEnd(m)
      }

      // Click sur la carte → placer / déplacer le marker
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          const m = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
          markerRef.current = m
          bindDragEnd(m)
        }

        await reverseGeocode(lat, lng)
      })

      mapRef.current = map
      setInitialized(true)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
        setInitialized(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gérer le redimensionnement de la carte quand le conteneur change
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize()
      }, 300) // Petit délai pour laisser le CSS s'appliquer
    }
  }, [isExpanded])

  function bindDragEnd(marker: any) {
    marker.on("dragend", async () => {
      const { lat, lng } = marker.getLatLng()
      await reverseGeocode(lat, lng)
    })
  }

  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
        { headers: { "Accept-Language": "fr" } }
      )
      const data = await res.json()
      const adresse = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      onChange({ lat, lng, adresse })

      // Popup sur le marker
      if (markerRef.current) {
        markerRef.current
          .bindPopup(`<b>${adresse.split(",")[0]}</b><br/>${adresse.split(",").slice(1, 3).join(",")}`)
          .openPopup()
      }
    } catch {
      onChange({ lat, lng, adresse: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-all duration-300 ${
      isExpanded ? "fixed inset-4 z-[9999] h-[calc(100vh-32px)]" : "h-64"
    }`}>
      {/* Bouton Agrandir / Réduire */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        className="absolute top-2 left-12 z-[999] bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm hover:bg-white transition-colors border border-gray-100"
        title={isExpanded ? "Réduire" : "Agrandir la carte"}
      >
        {isExpanded ? <Minimize2 className="size-4 text-gray-700" /> : <Maximize2 className="size-4 text-gray-700" />}
      </button>

      {/* Indicateur de géocodage */}
      {geocoding && (
        <div className="absolute top-2 right-2 z-[999] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-xs font-medium text-gray-700">
          <Loader2 className="size-3 animate-spin text-primary" />
          Recherche de l&apos;adresse...
        </div>
      )}

      {/* Info : adresse sélectionnée */}
      {value?.adresse && !geocoding && (
        <div className="absolute bottom-4 left-4 right-4 z-[999] bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-3 text-sm text-gray-700 border border-gray-100 max-w-lg mx-auto">
          <MapPin className="size-4 text-primary mt-0.5 shrink-0" />
          <span className="line-clamp-2">{value.adresse}</span>
        </div>
      )}

      {/* Hint initial */}
      {!value?.adresse && !geocoding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none flex flex-col items-center gap-2 text-center opacity-60">
          <MapPin className="size-8 text-primary" />
          <p className="text-xs font-medium text-gray-600 bg-white/90 px-3 py-1 rounded-full">
            Cliquez sur la carte pour sélectionner un lieu
          </p>
        </div>
      )}

      {/* Conteneur de la carte */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Overlay de fond si agrandi */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] -z-10 cursor-pointer" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}
