from datetime import datetime, timedelta, date
import calendar

from backend.constants import HEURES_JOURNEE_THEORIQUE

from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.pointage_repo import PointageRepository
from backend.services.pointage_helpers import normalize_statut, normalize_sous_statut

CONGE_SOUS_STATUTS = frozenset([
    "CONGE_MALADIE",
    "CONGE_PAYE",
    "CONGE_SANS_SOLDE",
    "CONGE_MATERNITE",
    "CONGE_ANNUEL",
    "CONGE_EXCEPTIONNEL",
])


class PointageService:
    def __init__(self):
        self.repo = PointageRepository()
        self.employe_repo = EmployeRepository()

    # ----------------------------------------------------
    # Helpers
    # ----------------------------------------------------
    def determiner_statut_journee(self, employe_id: int, date_journee: date) -> str:
        date_str = date_journee.strftime("%Y-%m-%d")
        p = self.repo.get_by_date(employe_id, date_str)
        if not p: return "absent_injustifie"

        statut = p.get("statut")
        ss = p.get("sous_statut")
        if statut == "PRESENT":
            if ss == "RETARD" or (p.get("retard_minutes") or 0) > 0: return "retard"
            return "present"
        elif statut == "ABSENT":
            if p.get("demande_conge_id") or ss in CONGE_SOUS_STATUTS: return "conge"
            return "absent"
        return "absent_injustifie"

    def _get_all_employes(self):
        try:
            employes = self.employe_repo.get_all()
            return [emp for emp in employes if emp.get("statut") != "Inactif"]
        except Exception:
            return []

    def _get_absences_pour_date(self, date_str: str):
        from datetime import datetime
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return []
            
        # Ignorer le weekend (samedi=5, dimanche=6)
        if date_obj.weekday() >= 5:
            return []
            
        sql = """
        SELECT e.employe_id, e.nom, e.prenom, e.matricule, d.nom_departement,
               p.pointage_id, p.statut, p.sous_statut, p.demande_conge_id
        FROM dbo.Employe e
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        LEFT JOIN dbo.Pointage p ON e.employe_id = p.employe_id AND CAST(p.date_pointage AS DATE) = ?
        WHERE e.statut != 'Inactif'
        AND (
            p.pointage_id IS NULL
            OR p.statut = 'ABSENT'
        )
        """
        rows = self.repo.db.fetch_all(sql, [date_str])
        
        absents = []
        for r in rows:
            statut_label = "Absent (sans pointage)"
            motif = "Consultation (non pointé)"
            type_flag = "AUTO"

            if r.get("pointage_id") is not None:
                type_flag = "MANUAL"
                if r.get("demande_conge_id") or r.get("sous_statut") in ("CONGE_MALADIE", "CONGE_PAYE", "CONGE_SANS_SOLDE", "CONGE_MATERNITE", "CONGE_EXCEPTIONNEL", "CONGE_ANNUEL"):
                    statut_label = "Congé"
                    motif = "Congé enregistré"
                else:
                    statut_label = "Absent"
                    motif = "Absence enregistrée"

            absents.append({
                "absence_id": -r["employe_id"], # ID fictif pour clé React
                "employe_id": r["employe_id"],
                "nom": r.get("nom"),
                "prenom": r.get("prenom"),
                "matricule": r.get("matricule"),
                "departement": r.get("nom_departement"),
                "statut": statut_label,
                "type": type_flag,
                "motif": motif,
                "justifiee": False
            })
            
        return absents

    def _resolve_month_range(
        self,
        annee: int | None = None,
        mois: int | None = None,
        mois_str: str | None = None,
    ):
        if mois_str:
            try:
                date_debut = datetime.strptime(f"{mois_str}-01", "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError("Format du mois invalide. Utilisez YYYY-MM.") from exc
            return date_debut.year, date_debut.month, date_debut.strftime("%Y-%m-%d")

        if annee is None or mois is None:
            today = datetime.now()
            annee = today.year
            mois = today.month

        try:
            date_debut = datetime(annee, mois, 1)
        except ValueError as exc:
            raise ValueError("Annee ou mois invalide.") from exc

        return annee, mois, date_debut.strftime("%Y-%m-%d")

    def _get_heures_travail_mois(
        self,
        annee: int | None = None,
        mois: int | None = None,
        mois_str: str | None = None,
    ):
        annee, mois, date_debut = self._resolve_month_range(annee, mois, mois_str)
        employes = self._get_all_employes()
        stats_rows = self.repo.get_monthly_work_stats(date_debut)

        # Calculate expected hours
        _, num_days = calendar.monthrange(annee, mois)
        jours_ouvrables = 0
        for day in range(1, num_days + 1):
            if date(annee, mois, day).weekday() < 5:  # Monday to Friday (0 to 4)
                jours_ouvrables += 1
        
        heures_attendues = jours_ouvrables * HEURES_JOURNEE_THEORIQUE

        stats_par_emp = {
            row["employe_id"]: {
                "total_heures": float(row.get("total_heures") or 0),
                "jours_travailles": int(row.get("jours_travailles") or 0),
                "jours_retard": int(row.get("jours_retard") or 0),
            }
            for row in stats_rows
        }

        resultat = []
        for emp in employes:
            emp_id = emp["employe_id"]
            stats = stats_par_emp.get(
                emp_id, {"total_heures": 0.0, "jours_travailles": 0, "jours_retard": 0}
            )
            total_heures = round(stats["total_heures"], 2)
            jours_travailles = stats["jours_travailles"]
            jours_retard = stats["jours_retard"]
            heures_attendues = jours_ouvrables * HEURES_JOURNEE_THEORIQUE
            heures_manquantes = max(0, heures_attendues - total_heures)
            taux_heures = round((total_heures / heures_attendues * 100), 1) if heures_attendues > 0 else 0
            
            # Calcul de la ponctualité (basé sur jours_travailles)
            ponctualite_pct = round(((jours_travailles - jours_retard) / max(jours_travailles, 1)) * 100, 1) if jours_travailles > 0 else 0.0

            resultat.append(
                {
                    "employe_id": emp_id,
                    "nom": emp.get("nom"),
                    "prenom": emp.get("prenom"),
                    "matricule": emp.get("matricule"),
                    "departement": emp.get("nom_departement"),
                    "total_heures": total_heures,
                    "jours_travailles": jours_travailles,
                    "jours_retard": jours_retard,
                    "ponctualite_pct": ponctualite_pct,
                    "heures_attendues": heures_attendues,
                    "heures_manquantes": round(heures_manquantes, 2),
                    "taux_heures": taux_heures,
                    "moyenne_quotidienne": round(
                        total_heures / max(jours_travailles, 1), 2
                    ),
                }
            )

        return annee, mois, sorted(resultat, key=lambda x: x["total_heures"], reverse=True)

    def _get_presence_retard_mois(
        self,
        annee: int | None = None,
        mois: int | None = None,
        mois_str: str | None = None,
    ):
        annee, mois, date_debut = self._resolve_month_range(annee, mois, mois_str)
        stats = self.repo.get_monthly_presence_stats(date_debut)

        return {
            "annee": annee,
            "mois": mois,
            "date_debut": date_debut,
            "jours_present": int(stats.get("jours_present") or 0),
            "jours_retard": int(stats.get("jours_retard") or 0),
        }

    def _overlaps_day(self, start_value, end_value, date_str: str) -> bool:
        if start_value is None or end_value is None:
            return False
        start_str = str(start_value)[:10]
        end_str = str(end_value)[:10]
        return start_str <= date_str <= end_str

    def get_employee_month_calendar(self, emp_id: int, mois: str | None = None):
        annee, mois_num, date_debut = self._resolve_month_range(mois_str=mois)
        date_start = datetime.strptime(date_debut, "%Y-%m-%d").date()

        if mois_num == 12:
            next_month = datetime(annee + 1, 1, 1).date()
        else:
            next_month = datetime(annee, mois_num + 1, 1).date()

        pointages = self.repo.history(emp_id, limit=366, month_str=f"{annee}-{str(mois_num).zfill(2)}")
        pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}

        days = []
        current = date_start

        while current < next_month:
            date_str = current.strftime("%Y-%m-%d")
            weekday = current.weekday()
            p = pointage_by_date.get(date_str)

            if weekday == 6:
                statut = "Repos"
                sous_statut = None
            elif p:
                statut = p.get("statut") or "PRESENT"
                sous_statut = p.get("sous_statut")
            else:
                statut = "ABSENT"
                sous_statut = "AUCUN_POINTAGE"

            days.append({
                "date": date_str,
                "statut": statut,
                "sous_statut": sous_statut,
                "heure_entree": str(p.get("heure_entree"))[:5] if p and p.get("heure_entree") else None,
                "heure_sortie": str(p.get("heure_sortie"))[:5] if p and p.get("heure_sortie") else None,
                "duree_travail_formattee": p.get("duree_travail_formattee") if p else None,
                "retard_minutes": p.get("retard_minutes") if p else None,
                "demande_conge_id": p.get("demande_conge_id") if p else None,
                "demande_mission_id": p.get("demande_mission_id") if p else None,
                "demande_formation_id": p.get("demande_formation_id") if p else None,
            })
            current += timedelta(days=1)

        return {
            "ok": True,
            "employe_id": emp_id,
            "annee": annee,
            "mois": mois_num,
            "date_debut": date_start.strftime("%Y-%m-%d"),
            "date_fin": next_month.strftime("%Y-%m-%d"),
            "jours": days,
        }

    # ----------------------------------------------------
    # Employee endpoints
    # ----------------------------------------------------
    def get_employee_statistiques(self, emp_id: int, date_debut: str, date_fin: str):
        try:
            d0 = datetime.strptime(date_debut, "%Y-%m-%d").date()
            d1 = datetime.strptime(date_fin, "%Y-%m-%d").date()
            if (d1 - d0).days > 366:
                return []

            # Fetch pointages directement sur la plage (filtre SQL, pas Python)
            pointages = self.repo.history(emp_id, date_debut=date_debut, date_fin=date_fin)
            pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}

            days = []
            current = d0
            jour_noms = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

            while current <= d1:
                date_str = current.strftime("%Y-%m-%d")
                weekday = current.weekday()
                p = pointage_by_date.get(date_str)

                is_pres = 0
                is_ret = 0
                is_conge = 0
                is_mission = 0
                is_absent = 0

                if p:
                    statut = p.get("statut")
                    ss = p.get("sous_statut")
                    
                    if statut == "PRESENT":
                        is_pres = 1
                        if ss == "RETARD" or (p.get("retard_minutes") or 0) > 0:
                            is_ret = 1
                        if p.get("demande_mission_id") or p.get("demande_formation_id") or ss in ("MISSION", "FORMATION"):
                            is_mission = 1
                    elif statut == "ABSENT":
                        if p.get("demande_conge_id") or ss in CONGE_SOUS_STATUTS:
                            is_conge = 1
                        else:
                            is_absent = 1
                else:
                    # Pas de pointage
                    if weekday < 5 and current < datetime.now().date():
                        is_absent = 1

                jour_label = f"{jour_noms[weekday]} {current.strftime('%d')}"

                days.append({
                    "jour": jour_label,
                    "presence": is_pres,
                    "retard": is_ret,
                    "absence": is_absent,
                    "conge": is_conge,
                    "mission": is_mission,
                    "fullDate": date_str,
                    "hours": float(p.get("duree_travail") or 0) if p else 0,
                    "hoursFormatted": p.get("duree_travail_formattee") if p else None,
                    "rawStatut": p.get("statut") if p else None
                })
                current += timedelta(days=1)

            return {"ok": True, "statistiques": days}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def pointer_entree(self, emp_id: int):
        d = datetime.now().strftime("%Y-%m-%d")
        h = datetime.now().strftime("%H:%M:%S")

        row = self.repo.get_by_date(emp_id, d)
        if row:
            return {"ok": False, "error": "Entree deja enregistree."}

        pid = self.repo.insert_entree(emp_id, d, h)
        return {"ok": True, "pointage_id": pid, "date": d, "heure_entree": h}

    def pointer_debut_pause(self, emp_id: int):
        d = datetime.now().strftime("%Y-%m-%d")
        h = datetime.now().strftime("%H:%M:%S")

        row = self.repo.get_by_date(emp_id, d)
        if not row:
            return {"ok": False, "error": "Aucune entree trouvee."}

        if row["heure_entree_pause"]:
            return {"ok": False, "error": "Pause deja commencee."}

        self.repo.update_debut_pause(row["pointage_id"], h)
        return {"ok": True, "heure_entree_pause": h}

    def pointer_fin_pause(self, emp_id: int):
        d = datetime.now().strftime("%Y-%m-%d")
        h = datetime.now().strftime("%H:%M:%S")

        row = self.repo.get_by_date(emp_id, d)
        if not row:
            return {"ok": False, "error": "Aucune entree trouvee."}

        if not row["heure_entree_pause"]:
            return {"ok": False, "error": "La pause n'a pas encore commence."}

        if row["heure_sortie_pause"]:
            return {"ok": False, "error": "Fin de pause deja enregistree."}

        self.repo.update_fin_pause(row["pointage_id"], h)
        return {"ok": True, "heure_sortie_pause": h}

    def pointer_sortie(self, emp_id: int):
        d = datetime.now().strftime("%Y-%m-%d")
        h = datetime.now().strftime("%H:%M:%S")

        row = self.repo.get_by_date(emp_id, d)
        if not row:
            return {"ok": False, "error": "Aucune entree trouvee."}

        if row["heure_sortie"]:
            return {"ok": False, "error": "Sortie deja enregistree."}

        self.repo.update_sortie(row["pointage_id"], h)
        return {"ok": True, "heure_sortie": h}

    def historique(self, emp_id: int, limit=9999, month: str | None = None):
        rows = self.repo.history(emp_id, limit, month)
        return {"ok": True, "count": len(rows), "data": rows}

    # ----------------------------------------------------
    # Admin endpoints
    # ----------------------------------------------------
    def admin_all(
        self,
        filter_type: str = "tous",
        date_debut: str | None = None,
        date_fin: str | None = None,
    ):
        return {
            "ok": True,
            "pointages": self.repo.get_all(filter_type, date_debut, date_fin),
        }

    def get_semaine(self, date_debut: str, date_fin: str):
        try:
            rows = self.repo.get_by_semaine(date_debut, date_fin)
            return {"ok": True, "count": len(rows), "pointages": rows}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def get_planning(self, date_debut: str, date_fin: str):
        try:
            d0 = datetime.strptime(date_debut, "%Y-%m-%d").date()
            d1 = datetime.strptime(date_fin, "%Y-%m-%d").date()
            dates = []
            d = d0
            while d <= d1:
                dates.append(str(d))
                d += timedelta(days=1)

            employes = self.employe_repo.get_all()
            employes = [e for e in employes if e.get("statut") != "Inactif"]

            pointages_raw = self.repo.get_by_semaine(date_debut, date_fin)
            pointage_index: dict = {}
            for p in pointages_raw:
                emp_id = p["employe_id"]
                date_p = str(p["date_pointage"])[:10]
                pointage_index.setdefault(emp_id, {})[date_p] = p

            # Charger les congés, missions et formations qui chevauchent la période
            conges_raw = self.repo.get_conges_periode(date_debut, date_fin)
            missions_raw = self.repo.get_missions_periode(date_debut, date_fin)
            formations_raw = self.repo.get_formations_periode(date_debut, date_fin)

            # Indexer par (employe_id, date_str)
            conges_index = {}
            for c in conges_raw:
                emp_id = c["employe_id"]
                start_date = c["date_debut"]
                end_date = c["date_fin"]
                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date[:10], "%Y-%m-%d").date()
                if isinstance(end_date, str):
                    end_date = datetime.strptime(end_date[:10], "%Y-%m-%d").date()
                
                d_curr = max(start_date, d0)
                d_end = min(end_date, d1)
                while d_curr <= d_end:
                    conges_index[(emp_id, str(d_curr))] = c
                    d_curr += timedelta(days=1)

            missions_index = {}
            for m in missions_raw:
                emp_id = m["employe_id"]
                start_date = m["date_debut"]
                end_date = m["date_fin"]
                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date[:10], "%Y-%m-%d").date()
                if isinstance(end_date, str):
                    end_date = datetime.strptime(end_date[:10], "%Y-%m-%d").date()
                
                d_curr = max(start_date, d0)
                d_end = min(end_date, d1)
                while d_curr <= d_end:
                    missions_index[(emp_id, str(d_curr))] = m
                    d_curr += timedelta(days=1)

            formations_index = {}
            for f in formations_raw:
                emp_id = f["employe_id"]
                start_date = f["date_debut"]
                end_date = f["date_fin"]
                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date[:10], "%Y-%m-%d").date()
                if isinstance(end_date, str):
                    end_date = datetime.strptime(end_date[:10], "%Y-%m-%d").date()
                
                d_curr = max(start_date, d0)
                d_end = min(end_date, d1)
                while d_curr <= d_end:
                    formations_index[(emp_id, str(d_curr))] = f
                    d_curr += timedelta(days=1)

            planning = []
            for emp in employes:
                emp_id = emp["employe_id"]
                jours = []
                for date_str in dates:
                    p = pointage_index.get(emp_id, {}).get(date_str)
                    
                    c_linked = conges_index.get((emp_id, date_str))
                    m_linked = missions_index.get((emp_id, date_str))
                    f_linked = formations_index.get((emp_id, date_str))

                    if p:
                        def _t(v):
                            if v is None: return None
                            return str(v)[:5]

                        jours.append({
                            "date": date_str,
                            "statut": p.get("statut", "PRESENT"),
                            "pointage": {
                                "pointage_id": p.get("pointage_id"),
                                "heure_entree": _t(p.get("heure_entree")),
                                "heure_sortie": _t(p.get("heure_sortie")),
                                "heure_entree_pause": _t(p.get("heure_entree_pause")),
                                "heure_sortie_pause": _t(p.get("heure_sortie_pause")),
                                "duree_pause_formattee": p.get("duree_pause_formattee"),
                                "duree_travail_formattee": p.get("duree_travail_formattee"),
                                "retard_minutes": p.get("retard_minutes"),
                                "statut": p.get("statut"),
                                "sous_statut": p.get("sous_statut"),
                                "demande_conge_id": c_linked["conge_id"] if c_linked else p.get("demande_conge_id"),
                                "demande_mission_id": m_linked["mission_id"] if m_linked else p.get("demande_mission_id"),
                                "demande_formation_id": f_linked["formation_id"] if f_linked else p.get("demande_formation_id"),
                            }
                        })
                    else:
                        statut_simule = "ABSENT"
                        sous_statut_simule = "AUCUN_POINTAGE"
                        if c_linked:
                            statut_simule = "ABSENT"
                            sous_statut_simule = "CONGE"
                        elif m_linked:
                            statut_simule = "PRESENT"
                            sous_statut_simule = "MISSION"
                        elif f_linked:
                            statut_simule = "PRESENT"
                            sous_statut_simule = "FORMATION"

                        jours.append({
                            "date": date_str,
                            "statut": statut_simule,
                            "pointage": {
                                "statut": statut_simule,
                                "sous_statut": sous_statut_simule,
                                "demande_conge_id": c_linked["conge_id"] if c_linked else None,
                                "demande_mission_id": m_linked["mission_id"] if m_linked else None,
                                "demande_formation_id": f_linked["formation_id"] if f_linked else None,
                            }
                        })

                planning.append({
                    "employe_id": emp_id,
                    "nom": emp.get("nom"),
                    "prenom": emp.get("prenom"),
                    "matricule": emp.get("matricule"),
                    "departement": emp.get("nom_departement"),
                    "planning": jours,
                })

            return {
                "ok": True,
                "count": len(planning),
                "dates": dates,
                "planning": planning,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def admin_add(self, data: dict):
        pid = self.repo.admin_add(data)
        return {"ok": True, "pointage_id": pid}

    def admin_edit(self, data: dict):
        self.repo.admin_update(data)
        return {"ok": True}

    def admin_delete(self, pid: int):
        self.repo.admin_delete(pid)
        return {"ok": True}

    # ----------------------------------------------------
    # Admin absences and stats
    # ----------------------------------------------------
    def get_absences_today(self):
        today = datetime.now().strftime("%Y-%m-%d")
        absents = self._get_absences_pour_date(today)
        return {"ok": True, "date": today, "count": len(absents), "absents": absents}

    def get_absences_by_date(self, date_str: str):
        absents = self._get_absences_pour_date(date_str)
        return {"ok": True, "date": date_str, "count": len(absents), "absents": absents}

    def get_monthly_stats(
        self,
        annee: int | None = None,
        mois: int | None = None,
        mois_str: str | None = None,
    ):
        annee, mois, stats = self._get_heures_travail_mois(annee, mois, mois_str)
        return {
            "ok": True,
            "annee": annee,
            "mois": mois,
            "count": len(stats),
            "statistiques": stats,
        }

    def get_monthly_summary(
        self,
        annee: int | None = None,
        mois: int | None = None,
        mois_str: str | None = None,
    ):
        annee, mois, stats = self._get_heures_travail_mois(annee, mois, mois_str)

        total_heures = sum(s["total_heures"] for s in stats)
        total_jours = sum(s["jours_travailles"] for s in stats)
        avg_heures = round(total_heures / max(len(stats), 1), 2)

        return {
            "ok": True,
            "annee": annee,
            "mois": mois,
            "total_employes": len(stats),
            "total_heures_mois": round(total_heures, 2),
            "total_jours_travailles": total_jours,
            "moyenne_heures_par_emp": avg_heures,
            "statistiques": stats,
        }

    def get_presence_retard_stats(
        self,
        mois_str: str | None = None,
        annee: int | None = None,
        mois: int | None = None,
    ):
        stats = self._get_presence_retard_mois(annee=annee, mois=mois, mois_str=mois_str)
        return {"ok": True, **stats}

    def get_repartition_stats(self, employe_id: int, date_debut: str, date_fin: str):
        """Calcule la répartition des statuts de pointage en % sur la période."""
        try:
            d0 = datetime.strptime(date_debut, "%Y-%m-%d").date()
            d1 = datetime.strptime(date_fin, "%Y-%m-%d").date()

            # Compter les jours ouvrables dans la période (lundi-vendredi)
            total_ouvrables = 0
            current = d0
            while current <= d1:
                if current.weekday() < 5:  # 0=lundi ... 4=vendredi
                    total_ouvrables += 1
                current += timedelta(days=1)

            if total_ouvrables == 0:
                return {"ok": True, "repartition": []}

            # Récupérer les pointages de l'employé sur la période
            pointages = self.repo.history(employe_id, date_debut=date_debut, date_fin=date_fin)
            pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}

            count_presence = 0
            count_retard = 0
            count_absence = 0

            today = datetime.now().date()
            current = d0
            while current <= d1:
                if current.weekday() >= 5:  # Weekend
                    current += timedelta(days=1)
                    continue

                date_str = current.strftime("%Y-%m-%d")
                p = pointage_by_date.get(date_str)

                if p:
                    statut = p.get("statut")
                    ss = p.get("sous_statut")
                    if statut == "PRESENT":
                        if ss == "RETARD" or (p.get("retard_minutes") or 0) > 0:
                            count_retard += 1
                        else:
                            count_presence += 1
                    elif statut == "ABSENT":
                        # Only count as 'Absence' if not an approved leave
                        if not p.get("demande_conge_id") and ss not in CONGE_SOUS_STATUTS:
                            count_absence += 1
                elif current < today:
                    count_absence += 1

                current += timedelta(days=1)

            # Recalcul si total_ouvrables a changé
            denom = count_presence + count_retard + count_absence
            if denom == 0:
                return {"ok": True, "repartition": []}

            def pct(n):
                return round((n / denom) * 100, 1)

            repartition = [
                {"statut": "Présence", "valeur": pct(count_presence), "couleur": "#22c55e", "count": count_presence},
                {"statut": "Retard",   "valeur": pct(count_retard),   "couleur": "#f97316", "count": count_retard},
                {"statut": "Absence",  "valeur": pct(count_absence),  "couleur": "#ef4444", "count": count_absence},
            ]

            return {"ok": True, "repartition": repartition}

        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    # ----------------------------------------------------
    # Unified Dashboard Stats (Frontend Requirement)
    # ----------------------------------------------------
    def get_dashboard_unified_stats(self, employe_id: int, type_filtre: str, valeur: str):
        try:
            import calendar
            
            d0, d1 = None, None
            if type_filtre == "Jour":
                d0 = datetime.strptime(valeur, "%Y-%m-%d").date()
                d1 = d0
            elif type_filtre == "Mois":
                d0 = datetime.strptime(f"{valeur}-01", "%Y-%m-%d").date()
                _, last_day = calendar.monthrange(d0.year, d0.month)
                d1 = datetime.strptime(f"{valeur}-{last_day}", "%Y-%m-%d").date()
            elif type_filtre == "Année":
                y = int(valeur)
                d0 = datetime(y, 1, 1).date()
                d1 = datetime(y, 12, 31).date()
            elif type_filtre == "Période":
                dates = valeur.split(",")
                d0 = datetime.strptime(dates[0], "%Y-%m-%d").date()
                if len(dates) > 1 and dates[1]:
                    d1 = datetime.strptime(dates[1], "%Y-%m-%d").date()
                else:
                    d1 = d0

            date_debut = d0.strftime("%Y-%m-%d")
            date_fin = d1.strftime("%Y-%m-%d")

            pointages = self.repo.history(employe_id, date_debut=date_debut, date_fin=date_fin)
            pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}

            total_heures = 0.0
            jours_presents = 0
            jours_absents = 0
            retards = 0
            
            data_graphique = []
            current = d0
            today = datetime.now().date()
            total_ouvrables = 0 
            
            while current <= d1:
                date_str = current.strftime("%Y-%m-%d")
                weekday = current.weekday()
                p = pointage_by_date.get(date_str)

                is_pres = 0
                is_ret = 0
                is_abs = 0
                heures_jour = 0.0

                if p:
                    statut = p.get("statut")
                    ss = p.get("sous_statut")
                    heures_jour = float(p.get("duree_travail") or 0)
                    total_heures += heures_jour

                    if statut == "PRESENT":
                        is_pres = 1
                        jours_presents += 1
                        if ss == "RETARD" or (p.get("retard_minutes") or 0) > 0:
                            is_ret = 1
                            retards += 1
                    elif statut == "ABSENT":
                        # Only count as absence if it's not an approved leave (idempotent)
                        if not p.get("demande_conge_id") and ss not in CONGE_SOUS_STATUTS:
                            is_abs = 1
                            jours_absents += 1
                else:
                    # Pas de pointage
                    if weekday < 5 and current < today:
                        is_abs = 1
                        jours_absents += 1

                if current < today and weekday < 5:
                    # Note: We don't subtract leave/mission here because the user wants pointage as truth.
                    # If there's an approved leave, it will have a pointage record (ABSENT + linked ID).
                    # We might want to NOT count approved leave as "absence" in the KPI.
                    # But for now, we follow the logic: presence vs absence.
                    total_ouvrables += 1

                jour_label = f"{str(current.day).zfill(2)}/{str(current.month).zfill(2)}"
                mois_label = f"{str(current.month).zfill(2)}/{str(current.year)[2:]}"

                data_graphique.append({
                    "_grouper": mois_label if type_filtre == "Année" else jour_label,
                    "jour": mois_label if type_filtre == "Année" else jour_label, 
                    "presence": is_pres,
                    "retard": is_ret,
                    "absence": is_abs,
                    "heures": heures_jour
                })
                current += timedelta(days=1)
                
            if type_filtre == "Année":
                grouped_data = {}
                for d in data_graphique:
                    k = d["_grouper"]
                    if k not in grouped_data:
                        grouped_data[k] = {"jour": k, "presence": 0, "retard": 0, "absence": 0, "heures": 0.0}
                    grouped_data[k]["presence"] += d["presence"]
                    grouped_data[k]["retard"] += d["retard"]
                    grouped_data[k]["absence"] += d["absence"]
                    grouped_data[k]["heures"] = round(grouped_data[k]["heures"] + d["heures"], 1)
                data_graphique = list(grouped_data.values())
            else:
                for d in data_graphique:
                    d.pop("_grouper", None)

            total_jours = jours_presents + jours_absents
            if total_jours > 0:
                taux = min(round((jours_presents / total_jours) * 100, 1), 100.0)
            else: 
                taux = 100.0

            return {
                "ok": True,
                "total_heures": float(f"{total_heures:.1f}"),
                "jours_presents": jours_presents,
                "jours_absents": jours_absents,
                "retards": retards,
                "taux_presence": taux,
                "data_graphique": data_graphique
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
