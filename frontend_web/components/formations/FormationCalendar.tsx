"use client"

import React, { useState, useMemo } from "react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay
} from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight, CalendarDays, Calendar as CalendarIcon, CalendarRange, Clock, MapPin, Users } from "lucide-react"
import { FormationRow } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FormationCalendarProps {
  formations: FormationRow[]
  onEventClick: (formation: FormationRow) => void
}

const getFormationStatus = (f: FormationRow) => {
  if (!f.date_debut || !f.date_fin) {
    return { label: "Non planifiée", style: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", dot: "bg-gray-400" }
  }
  const now = new Date()
  const debut = new Date(f.date_debut)
  const fin = new Date(f.date_fin)
  fin.setHours(23, 59, 59)

  if (now < debut) return { label: "À venir", style: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100", dot: "bg-sky-500" }
  if (now >= debut && now <= fin) return { label: "En cours", style: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", dot: "bg-emerald-500" }
  return { label: "Terminée", style: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", dot: "bg-gray-400" }
}

export function FormationCalendar({ formations, onEventClick }: FormationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')

  // Helper to format dates correctly
  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addDays(currentDate, 1))
  }

  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subDays(currentDate, 1))
  }

  const today = () => setCurrentDate(new Date())

  // Process formations into a daily map for quick lookup
  const eventsByDay = useMemo(() => {
    const map = new Map<string, FormationRow[]>()

    formations.forEach(formation => {
      if (!formation.date_debut || !formation.date_fin) return

      let start = parseISO(formation.date_debut)
      const end = parseISO(formation.date_fin)

      // Safety check to avoid infinite loops if dates are bad
      let daysCount = 0
      while (start <= end && daysCount < 100) {
        const dayStr = format(start, 'yyyy-MM-dd')
        const existing = map.get(dayStr) || []
        map.set(dayStr, [...existing, formation])
        start = addDays(start, 1)
        daysCount++
      }
    })
    return map
  }, [formations])

  // Month View Render
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const rows = []
    let days = []
    let day = startDate
    let formattedDate = ""

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d")
        const cloneDay = day
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayEvents = eventsByDay.get(dayStr) || []
        const isCurrentMonth = isSameMonth(day, monthStart)
        const isToday = isSameDay(day, new Date())

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[120px] p-2 border-r border-b border-gray-100 relative transition-colors ${!isCurrentMonth ? "bg-gray-50/50 text-gray-400" : "bg-white"
              } ${isToday ? "bg-indigo-50/30" : ""}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span
                className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-indigo-600 text-white shadow-md" : "text-gray-700"
                  }`}
              >
                {formattedDate}
              </span>
              {dayEvents.length > 0 && (
                <span className="text-[10px] font-semibold text-gray-400">{dayEvents.length} form.</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              {dayEvents.slice(0, 3).map((event, idx) => {
                const status = getFormationStatus(event)
                return (
                  <TooltipProvider key={`${dayStr}-${event.formation_id}-${idx}`}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => onEventClick(event)}
                          className={`px-2 py-1.5 rounded-lg border text-xs cursor-pointer truncate transition-all duration-200 ${status.style}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                            <span className="font-semibold truncate">{event.titre}</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="w-64 p-3 bg-white/95 backdrop-blur-xl border-gray-100 shadow-xl rounded-xl">
                        <div className="space-y-2">
                          <p className="font-bold text-sm text-gray-900">{event.titre}</p>
                          <p className="text-xs text-gray-500 line-clamp-2">{event.description || 'Aucune description'}</p>
                          <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] text-gray-600">
                            <div className="flex items-center gap-1"><Clock className="size-3" /> {event.duree ? `${event.duree}h` : '-'}</div>
                            <div className="flex items-center gap-1"><MapPin className="size-3" /> <span className="truncate">{event.lieu || '-'}</span></div>
                            <div className="flex items-center gap-1 col-span-2"><Users className="size-3" /> {event.organisateur}</div>
                          </div>
                          <div className="pt-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${status.style}`}>{status.label}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
              {dayEvents.length > 3 && (
                <div className="text-[10px] text-gray-500 font-medium px-2 py-1 rounded bg-gray-50 text-center">
                  +{dayEvents.length - 3} autres
                </div>
              )}
            </div>
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      )
      days = []
    }

    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(dayName => (
            <div key={dayName} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {dayName}
            </div>
          ))}
        </div>
        <div>{rows}</div>
      </div>
    )
  }

  // Week View Render
  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
    const days = []

    for (let i = 0; i < 7; i++) {
      const day = addDays(startDate, i)
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayEvents = eventsByDay.get(dayStr) || []
      const isToday = isSameDay(day, new Date())

      days.push(
        <div key={dayStr} className="flex-1 min-w-0 border-r last:border-r-0 border-gray-100">
          <div className={`p-3 text-center border-b border-gray-100 ${isToday ? 'bg-indigo-50/50' : 'bg-gray-50/50'}`}>
            <p className="text-xs font-medium text-gray-500 uppercase">{format(day, 'EEE', { locale: fr })}</p>
            <p className={`text-lg font-bold mt-1 ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>{format(day, 'd')}</p>
          </div>
          <div className="p-2 space-y-2 h-[60vh] overflow-y-auto scrollbar-hide bg-white">
            {dayEvents.map((event, idx) => {
              const status = getFormationStatus(event)
              return (
                <div
                  key={`${dayStr}-${event.formation_id}-${idx}`}
                  onClick={() => onEventClick(event)}
                  className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all duration-200 ${status.style}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
                    <span className="text-xs font-bold truncate">{event.titre}</span>
                  </div>
                  {event.heure_debut && event.heure_fin && (
                    <div className="text-[10px] font-medium flex items-center gap-1 opacity-80">
                      <Clock className="size-3" />
                      {event.heure_debut} - {event.heure_fin}
                    </div>
                  )}
                </div>
              )
            })}
            {dayEvents.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <span className="text-xs text-gray-300">Aucune</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex bg-white">
        {days}
      </div>
    )
  }

  // Day View Render
  const renderDayView = () => {
    const dayStr = format(currentDate, 'yyyy-MM-dd')
    const dayEvents = eventsByDay.get(dayStr) || []

    return (
      <Card className="p-6 border-gray-100 shadow-sm bg-white/50 backdrop-blur-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6 capitalize flex items-center gap-2">
          <CalendarDays className="size-5 text-indigo-500" />
          {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </h3>

        {dayEvents.length === 0 ? (
          <div className="py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <CalendarIcon className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucune formation planifiée pour cette journée.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayEvents.map((event, idx) => {
              const status = getFormationStatus(event)
              return (
                <div
                  key={`${dayStr}-${event.formation_id}-${idx}`}
                  onClick={() => onEventClick(event)}
                  className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-all duration-200 ${status.style}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`} />
                      <h4 className="text-base font-bold">{event.titre}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/50 border border-white/20`}>{status.label}</span>
                    </div>
                    <p className="text-sm opacity-80 line-clamp-2 mb-3">{event.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium opacity-70">
                      <div className="flex items-center gap-1.5"><Users className="size-3.5" /> {event.organisateur}</div>
                      <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {event.lieu || 'Non spécifié'}</div>
                      <div className="flex items-center gap-1.5"><CalendarRange className="size-3.5" /> {event.type_formation}</div>
                    </div>
                  </div>
                  {(event.heure_debut || event.heure_fin) && (
                    <div className="sm:text-right shrink-0 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-black/5 sm:pl-4">
                      <div className="flex items-center sm:justify-end gap-1.5 text-sm font-bold">
                        <Clock className="size-4" />
                        {event.heure_debut || '--:--'} à {event.heure_fin || '--:--'}
                      </div>
                      {event.duree && <p className="text-xs opacity-70 mt-1">{event.duree} heures</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    )
  }

  // Header Title Formatting
  const getHeaderTitle = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: fr })
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      if (isSameMonth(start, end)) return `${format(start, 'd')} - ${format(end, 'd MMMM yyyy', { locale: fr })}`
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy', { locale: fr })}`
    }
    return format(currentDate, 'd MMMM yyyy', { locale: fr })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
            <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
              <ChevronLeft className="size-4 text-gray-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={today} className="h-8 px-3 text-xs font-semibold text-gray-600 rounded-lg hover:bg-white hover:shadow-sm mx-1">
              Aujourd'hui
            </Button>
            <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
              <ChevronRight className="size-4 text-gray-600" />
            </Button>
          </div>
          <h2 className="text-xl font-bold text-gray-900 capitalize min-w-[200px]">
            {getHeaderTitle()}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Status Legend */}
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> En cours</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-sky-500"></span> À venir</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Terminée</div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['month', 'week', 'day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === mode
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }`}
              >
                {mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid/Content */}
      <div className="transition-all duration-300">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  )
}
