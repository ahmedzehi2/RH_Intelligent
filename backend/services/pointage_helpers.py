from datetime import datetime, time
from typing import Optional, Dict

REFERENCE_ENTREE = time(8, 15, 0)  # début de journée officielle


def parse_time(value: Optional[str]) -> Optional[time]:
    if not value:
        return None
    if isinstance(value, time):
        return value
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    return None


def diff_minutes(start: Optional[time], end: Optional[time]) -> Optional[int]:
    if start is None or end is None:
        return None
    delta = datetime.combine(datetime.today(), end) - datetime.combine(datetime.today(), start)
    return int(delta.total_seconds() / 60) if delta.total_seconds() >= 0 else None


def compute_retard_minutes(heure_entree: Optional[str]) -> int:
    he = parse_time(heure_entree)
    if he is None:
        return 0
    diff = diff_minutes(REFERENCE_ENTREE, he)
    return max(diff or 0, 0)


def has_pointage(data: Dict) -> bool:
    return bool(data.get("heure_entree") or data.get("heure_sortie") or data.get("heure_entree_pause") or data.get("heure_sortie_pause"))


def compute_sous_statut(retard_minutes: int, has_pointage_data: bool) -> str:
    if not has_pointage_data:
        return "AUCUN_POINTAGE"
    return "RETARD" if retard_minutes > 0 else "A_L_HEURE"


def compute_statut(retard_minutes: int, has_pointage_data: bool) -> str:
    return "PRESENT" if has_pointage_data else "ABSENT"


def compute_pointage_fields(data: Dict) -> Dict:
    result = dict(data)

    heure_entree = result.get("heure_entree")
    heure_sortie = result.get("heure_sortie")
    heure_entree_pause = result.get("heure_entree_pause")
    heure_sortie_pause = result.get("heure_sortie_pause")

    # Durée de pause en minutes
    duree_pause = diff_minutes(parse_time(heure_entree_pause), parse_time(heure_sortie_pause))
    result["duree_pause"] = duree_pause
    result["is_pause_complete"] = 1 if (heure_entree_pause and heure_sortie_pause) else 0

    # Durée de travail en minutes (type INT désormais)
    total_minutes = diff_minutes(parse_time(heure_entree), parse_time(heure_sortie))
    if total_minutes is not None:
        result["duree_travail"] = total_minutes - (duree_pause or 0)
    else:
        result["duree_travail"] = None

    # Retard et statut
    retard_minutes = compute_retard_minutes(heure_entree)
    result["retard_minutes"] = retard_minutes

    pointage_exists = has_pointage(result)
    const_statut = result.get("statut")
    const_sous_statut = result.get("sous_statut")
    const_statut_is_explicit = "statut" in data and const_statut not in (None, "")
    const_sous_statut_is_explicit = "sous_statut" in data and const_sous_statut not in (None, "")

    if (const_statut_is_explicit):
        result["statut"] = normalize_statut(const_statut, const_sous_statut)
    else:
        result["statut"] = compute_statut(retard_minutes, pointage_exists)

    if (const_sous_statut_is_explicit):
        result["sous_statut"] = normalize_sous_statut(const_sous_statut)
    else:
        result["sous_statut"] = compute_sous_statut(retard_minutes, pointage_exists)

    return result


def normalize_statut(statut: Optional[str], sous_statut: Optional[str] = None) -> str:
    if not statut:
        return "ABSENT"
    statut_norm = statut.strip().upper()
    if statut_norm in {"PRESENT", "ABSENT"}:
        return statut_norm
    if statut_norm in {"A_L_HEURE", "A L HEURE", "A_LHEURE", "ALHEURE", "PRESENT"}:
        return "PRESENT"
    if statut_norm in {"RETARD", "EN RETARD", "EN_RETARD"}:
        return "PRESENT"
    if statut_norm in {"ABSENT", "ABSENCE", "ABSENT_INJUSTIFIE"}:
        return "ABSENT"
    if sous_statut:
        st = sous_statut.strip().upper()
        if st == "RETARD":
            return "PRESENT"
        if st == "A_L_HEURE":
            return "PRESENT"
    return "ABSENT"


def normalize_sous_statut(sous_statut: Optional[str]) -> str:
    if not sous_statut:
        return "AUCUN_POINTAGE"
    st = sous_statut.strip().upper().replace(" ", "_")
    if st in {"A_L_HEURE", "A_LHEURE", "A L HEURE"}:
        return "A_L_HEURE"
    if st in {"RETARD", "EN_RETARD", "EN RETARD"}:
        return "RETARD"
    if st in {"AUCUN_POINTAGE", "SANS_POINTAGE", "ABSENT"}:
        return "AUCUN_POINTAGE"
    return st
