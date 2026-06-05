import React from "react";
import { z } from "zod";
import { ATTENDANCE_REGISTRY, getAttendanceState, StatusConfig, SubStatusKey } from "@/lib/status-config";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, LucideIcon } from "lucide-react";

// ─── VALIDATION SCHEMA ───────────────────────────────────────────────────────

/**
 * Schéma Zod pour la validation du formulaire de pointage.
 * Centralise la logique de validation pour Add et Edit.
 */
export const pointageSchema = z.object({
  employe_id: z.string().min(1, "L'employé est requis"),
  date_pointage: z.string().min(1, "La date est requise"),
  statut: z.enum(["PRESENT", "ABSENT"]),
  sous_statut: z.string().optional(),
  heure_entree: z.string().optional(),
  heure_sortie: z.string().optional(),
  heure_entree_pause: z.string().optional(),
  heure_sortie_pause: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.statut === "PRESENT") {
    // Pour PRESENT, on vérifie si le sous-statut nécessite des heures
    const cfg = ATTENDANCE_REGISTRY[data.sous_statut as SubStatusKey];
    if (cfg?.rules.requiresHours && !data.heure_entree) return false;
  }
  return true;
}, {
  message: "L'heure d'entrée est requise pour ce statut",
  path: ["heure_entree"],
});

export type PointageFormData = z.infer<typeof pointageSchema>;

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────

/**
 * Badge de statut dynamique basé sur la configuration.
 */
export const AttendanceBadge = ({ state, showIcon = true }: { state: StatusConfig | null, showIcon?: boolean }) => {
  if (!state) return <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200">REPOS</Badge>;

  const Icon = state.icon;

  return (
    <Badge
      className={`flex items-center gap-1 shadow-sm px-2 py-0.5 border-none ${state.color.badge} text-white`}
    >
      {showIcon && <Icon className="size-3" />}
      <span className="uppercase tracking-wider font-bold text-[10px]">
        {state.label}
      </span>
    </Badge>
  );
};

/**
 * Cellule de calendrier premium avec effets de survol et verre.
 */
export const AttendanceCalendarCell = ({
  statut,
  sousStatut,
  isWeekend,
  horaires,
  duration,
  isHovered,
  onClick,
  missionInfo,
  formationInfo
}: {
  statut: string,
  sousStatut: string,
  isWeekend: boolean,
  horaires?: { entree?: string, sortie?: string },
  duration?: string,
  isHovered: boolean,
  onClick: () => void,
  missionInfo?: any,
  formationInfo?: any
}) => {
  const state = getAttendanceState(statut, sousStatut, isWeekend);

  if (isWeekend || !state) {
    return (
      <div className="w-full h-full min-h-[110px] p-2 bg-slate-50/50 flex flex-col items-center justify-center gap-1 opacity-40">
        <span className="text-xl">😴</span>
        <span className="text-[10px] font-bold text-slate-400">REPOS</span>
      </div>
    );
  }

  const Icon = state.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onClick}
            className={`
              relative w-full h-full min-h-[110px] p-2 border rounded-xl 
              transition-all duration-200 cursor-pointer overflow-hidden
              ${state.color.bg} ${state.color.border}
              ${isHovered ? 'shadow-lg -translate-y-1 ring-2 ring-offset-1 ring-indigo-200' : 'shadow-sm'}
            `}
          >
            {/* Header: Badge Statut Principal + Mini-Badge Mission/Formation */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className={`text-[9px] font-black px-1.5 py-0.5 rounded inline-block uppercase tracking-tighter shadow-sm ${state.color.badge} text-white`}>
                {state.mainStatus}
              </div>
              {missionInfo && (
                <div className="text-[9px] font-black text-sky-700 bg-sky-50 px-1 py-0.5 rounded border border-sky-200 uppercase tracking-tighter shrink-0 shadow-sm animate-in fade-in zoom-in-75 duration-200">
                  🔵 Mission
                </div>
              )}
              {formationInfo && (
                <div className="text-[9px] font-black text-violet-700 bg-violet-50 px-1 py-0.5 rounded border border-violet-200 uppercase tracking-tighter shrink-0 shadow-sm animate-in fade-in zoom-in-75 duration-200">
                  🟣 Form.
                </div>
              )}
            </div>

            {/* Content: Sous-Statut label & Icon */}
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`p-1 rounded-lg bg-white/60 shadow-sm ${state.color.text}`}>
                <Icon className="size-3.5" />
              </div>
              <span className={`text-[11px] font-black uppercase tracking-tight truncate ${state.color.text}`}>
                {state.label}
              </span>
            </div>

            {/* Horaires Section */}
            {state.rules.requiresHours && horaires?.entree && (
              <div className="flex flex-col gap-1 border-t border-black/5 pt-2 mt-1">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600">
                  <span className="opacity-70">Horaires</span>
                  <span>{horaires.entree.slice(0, 5)} → {horaires.sortie?.slice(0, 5) || "–"}</span>
                </div>
                {duration && (
                  <div className="flex justify-between items-center bg-white/40 px-1 rounded">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Total</span>
                    <span className="text-[11px] font-black text-slate-900">{duration}</span>
                  </div>
                )}
              </div>
            )}

            {/* Hover Edit Hint */}
            {isHovered && (
              <div className="absolute top-2 right-2 p-1 bg-white/80 rounded-full shadow-sm text-slate-500 animate-in fade-in zoom-in-75">
                <Pencil className="size-3" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-xs p-1 space-y-1">
            <p className="font-bold">{state.label}</p>
            <p className="opacity-70">{state.mainStatus === 'PRESENT' ? 'Journée travaillée' : 'Journée d\'absence'}</p>
            {missionInfo && (
              <div className="border-t border-slate-200/60 pt-1 mt-1">
                <p className="font-bold text-sky-600">🔵 Mission: {missionInfo.type_mission || "Mission"}</p>
                {missionInfo.lieu_mission && <p className="text-[10px] text-slate-500">Lieu: {missionInfo.lieu_mission}</p>}
              </div>
            )}
            {formationInfo && (
              <div className="border-t border-slate-200/60 pt-1 mt-1">
                <p className="font-bold text-violet-600">🟣 Formation: {formationInfo.titre || "Formation"}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Carte KPI Premium pour le tableau de bord.
 */
export const AttendanceKPICard = ({ title, value, icon: Icon, color, description }: {
  title: string,
  value: number | string,
  icon: LucideIcon,
  color: string,
  description?: string
}) => {
  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 group">
      <CardContent className="p-4 relative">
        {/* Glow effect */}
        <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-20 ${color}`} />

        <div className="flex justify-between items-start mb-2">
          <div className={`p-2 rounded-xl ${color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
            <Icon className="size-5" />
          </div>
          <span className="text-3xl font-black tracking-tighter text-slate-900">{value}</span>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
          {description && <p className="text-[10px] text-slate-400 font-medium italic mt-0.5">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
};
