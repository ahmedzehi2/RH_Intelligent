import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// =========================================================
// FONCTION AMÉLIORÉE : Tri chronologique (Événements et Posts)
// =========================================================
export const sortEventsAndPostsChronologically = (data: {
  events: any[];
  interview_posts: any[];
}) => {
  const { events, interview_posts } = data;

  // 1. Créer un tableau d'objets combinés
  const combined: Array<{
    type: "event" | "post";
    date: Date;
    item: any;
  }> = [
      ...(events || []).map((e: any) => ({
        type: "event" as const,
        date: new Date(e.date),
        item: e,
      })),
      ...(interview_posts || []).map((p: any) => ({
        type: "post" as const,
        date: new Date(p.publish_date),
        item: p,
      })),
    ];

  // 2. Trier par date croissante
  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 3. Extraire les éléments triés
  const sortedEvents = combined
    .filter((item) => item.type === "event")
    .map((item) => item.item);

  const sortedPosts = combined
    .filter((item) => item.type === "post")
    .map((item) => item.item);

  return {
    sortedEvents,
    sortedPosts,
  };
};

// =========================================================
// FONCTION AMÉLIORÉE : Statut des événements
// =========================================================
export const getEventStatus = (startDateStr: string, endDateStr?: string) => {
  const now = new Date();
  const startDate = new Date(startDateStr);
  const endDate = endDateStr ? new Date(endDateStr) : null;

  // Événement terminé
  if (endDate && now > endDate) {
    return "finished";
  }

  // Événement en cours
  if (now >= startDate && (!endDate || now <= endDate)) {
    return "ongoing";
  }

  // Événement à venir
  return "upcoming";
};

// =========================================================
// FONCTION AMÉLIORÉE : Formater les dates
// =========================================================
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// =========================================================
// FONCTION AMÉLIORÉE : Compter les jours restants
// =========================================================
export const getDaysRemaining = (dateString: string) => {
  const today = new Date();
  const eventDate = new Date(dateString);
  const diffInTime = eventDate.getTime() - today.getTime();
  const diffInDays = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
  return diffInDays;
};