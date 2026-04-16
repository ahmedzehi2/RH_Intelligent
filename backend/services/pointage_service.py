from datetime import datetime, timedelta

from backend.repositories.conge_repo import CongeRepository
from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.mission_repo import MissionRepository
from backend.repositories.pointage_repo import PointageRepository
from backend.repositories.formation_repo import FormationRepository


class PointageService:
    def __init__(self):
        self.repo = PointageRepository()
        self.employe_repo = EmployeRepository()
        self.conge_repo = CongeRepository()
        self.mission_repo = MissionRepository()
        try:
            self.formation_repo = FormationRepository()
        except Exception:
            self.formation_repo = None

    # ----------------------------------------------------
    # Helpers
    # ----------------------------------------------------
    def _get_all_employes(self):
        try:
            employes = self.employe_repo.get_all()
            return [emp for emp in employes if emp.get("statut") != "Inactif"]
        except Exception:
            return []

    def _get_absences_pour_date(self, date_str: str):
        from datetime import date as date_type

        pointages = self.repo.get_all()
        employes = self._get_all_employes()
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

        emp_ids_presentes = set(
            p["employe_id"]
            for p in pointages
            if (
                isinstance(p.get("date_pointage"), date_type)
                and p.get("date_pointage") == target_date
            )
            or (
                isinstance(p.get("date_pointage"), str)
                and p.get("date_pointage") == date_str
            )
        )

        absents = []
        for emp in employes:
            if emp["employe_id"] not in emp_ids_presentes:
                absents.append(
                    {
                        "employe_id": emp["employe_id"],
                        "nom": emp.get("nom"),
                        "prenom": emp.get("prenom"),
                        "matricule": emp.get("matricule"),
                        "departement": emp.get("nom_departement"),
                        "statut": "Absent",
                    }
                )

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

        stats_par_emp = {
            row["employe_id"]: {
                "total_heures": float(row.get("total_heures") or 0),
                "jours_travailles": int(row.get("jours_travailles") or 0),
            }
            for row in stats_rows
        }

        resultat = []
        for emp in employes:
            emp_id = emp["employe_id"]
            stats = stats_par_emp.get(
                emp_id, {"total_heures": 0.0, "jours_travailles": 0}
            )
            total_heures = round(stats["total_heures"], 2)
            jours_travailles = stats["jours_travailles"]

            resultat.append(
                {
                    "employe_id": emp_id,
                    "nom": emp.get("nom"),
                    "prenom": emp.get("prenom"),
                    "matricule": emp.get("matricule"),
                    "departement": emp.get("nom_departement"),
                    "total_heures": total_heures,
                    "jours_travailles": jours_travailles,
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
        conges = [
            c
            for c in self.conge_repo.get_by_employe(emp_id)
            if c.get("statut") in ("Valide", "Demande")
        ]
        missions = [
            m
            for m in self.mission_repo.get_by_employe(emp_id)
            if m.get("statut") in ("Valide", "Demande")
        ]

        pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}
        conges = [
            c
            for c in self.conge_repo.get_by_employe(emp_id)
            if c.get("statut") in ("Valide", "Demande")
        ]
        missions = [
            m
            for m in self.mission_repo.get_by_employe(emp_id)
            if m.get("statut") in ("Valide", "Demande")
        ]

        # Formations inscrites pour cet employe
        formations = []
        if self.formation_repo:
            try:
                formations = [
                    f for f in self.formation_repo.get_by_employe(emp_id)
                    if f.get("date_debut") and f.get("date_fin")
                ]
            except Exception:
                formations = []

        days = []
        current = date_start

        while current < next_month:
            date_str = current.strftime("%Y-%m-%d")
            weekday = current.weekday()
            pointage = pointage_by_date.get(date_str)

            mission = next(
                (m for m in missions if self._overlaps_day(m.get("date_debut"), m.get("date_fin"), date_str)),
                None,
            )
            conge = next(
                (c for c in conges if self._overlaps_day(c.get("date_debut"), c.get("date_fin"), date_str)),
                None,
            )
            formation = next(
                (f for f in formations if self._overlaps_day(f.get("date_debut"), f.get("date_fin"), date_str)),
                None,
            )

            if weekday == 6:
                statut = "Repos"
            elif pointage:
                statut = pointage.get("statut") or "Present"
            elif mission:
                statut = "Mission"
            elif formation:
                statut = "Formation"
            elif conge:
                statut = "Conge"
            else:
                statut = "Absent"

            days.append(
                {
                    "date": date_str,
                    "statut": statut,
                    "heure_entree": str(pointage.get("heure_entree"))[:5] if pointage and pointage.get("heure_entree") else None,
                    "heure_sortie": str(pointage.get("heure_sortie"))[:5] if pointage and pointage.get("heure_sortie") else None,
                    "duree_travail": pointage.get("duree_travail") if pointage else None,
                    "retard_minutes": pointage.get("retard_minutes") if pointage else None,
                    "type_conge": conge.get("type_conge") if conge else None,
                    "type_mission": mission.get("type_mission") if mission else None,
                    "type_formation": formation.get("titre") if formation else None,
                }
            )
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

            conges = [c for c in self.conge_repo.get_by_employe(emp_id) if c.get("statut") in ("Valide", "Demande")]
            missions = [m for m in self.mission_repo.get_by_employe(emp_id) if m.get("statut") in ("Valide", "Demande")]
            formations = []
            if self.formation_repo:
                try:
                    formations = [f for f in self.formation_repo.get_by_employe(emp_id) if f.get("date_debut")]
                except Exception:
                    pass

            pointage_by_date = {str(p.get("date_pointage"))[:10]: p for p in pointages}

            days = []
            current = d0

            jour_noms = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

            while current <= d1:
                date_str = current.strftime("%Y-%m-%d")
                weekday = current.weekday()

                pointage = pointage_by_date.get(date_str)
                mission = next((m for m in missions if self._overlaps_day(m.get("date_debut"), m.get("date_fin"), date_str)), None)
                conge = next((c for c in conges if self._overlaps_day(c.get("date_debut"), c.get("date_fin"), date_str)), None)
                formation = next((f for f in formations if self._overlaps_day(f.get("date_debut"), f.get("date_fin"), date_str)), None)

                # Présence : statut Present OU En retard OU heure_entree renseignée
                is_pres = 1 if pointage and (
                    pointage.get("statut") in ("Present", "En retard")
                    or (pointage.get("retard_minutes") or 0) > 0
                    or pointage.get("heure_entree")
                ) else 0
                is_ret = 1 if pointage and (pointage.get("retard_minutes") or 0) > 0 else 0
                is_conge = 1 if conge else 0
                is_mission = 1 if mission or formation else 0
                is_absent = 0

                if not is_pres and not is_conge and not is_mission and weekday not in (5, 6) and current < datetime.now().date():
                    if pointage and pointage.get("statut") == "Absent":
                        is_absent = 1
                    elif not pointage:
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
                    "hours": float(pointage.get("duree_travail") or 0) if pointage else 0,
                    "rawStatut": pointage.get("statut") if pointage else None
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

            conges_raw = self.repo.get_conges_periode(date_debut, date_fin)
            conge_index: dict = {}
            for c in conges_raw:
                emp_id = c["employe_id"]
                cd = str(c["date_debut"])[:10]
                cf = str(c["date_fin"])[:10]
                conge_index.setdefault(emp_id, []).append(
                    (cd, cf, c.get("type_conge", "Conge"))
                )

            def _is_conge(emp_id: int, date_str: str) -> tuple:
                for cd, cf, tc in conge_index.get(emp_id, []):
                    if cd <= date_str <= cf:
                        return True, tc
                return False, None

            # Formations pour la periode
            formation_index: dict = {}
            if self.formation_repo:
                try:
                    formations_raw = self.repo.get_formations_periode(date_debut, date_fin)
                    for f in formations_raw:
                        emp_id = f["employe_id"]
                        fd = str(f["date_debut"])[:10]
                        ff = str(f["date_fin"])[:10]
                        formation_index.setdefault(emp_id, []).append(
                            (fd, ff, f.get("titre", "Formation"))
                        )
                except Exception:
                    pass

            def _is_formation(emp_id: int, date_str: str) -> tuple:
                for fd, ff, titre in formation_index.get(emp_id, []):
                    if fd <= date_str <= ff:
                        return True, titre
                return False, None

            planning = []
            for emp in employes:
                emp_id = emp["employe_id"]
                jours = []
                for date_str in dates:
                    p = pointage_index.get(emp_id, {}).get(date_str)
                    if p:
                        def _t(v):
                            if v is None:
                                return None
                            return str(v)[:5]

                        jours.append(
                            {
                                "date": date_str,
                                "statut": p.get("statut", "Present"),
                                "pointage": {
                                    "pointage_id": p.get("pointage_id"),
                                    "heure_entree": _t(p.get("heure_entree")),
                                    "heure_sortie": _t(p.get("heure_sortie")),
                                    "heure_entree_pause": _t(
                                        p.get("heure_entree_pause")
                                    ),
                                    "heure_sortie_pause": _t(
                                        p.get("heure_sortie_pause")
                                    ),
                                    "duree_pause": p.get("duree_pause"),
                                    "duree_travail": p.get("duree_travail"),
                                    "retard_minutes": p.get("retard_minutes"),
                                },
                            }
                        )
                    else:
                        on_conge, type_conge = _is_conge(emp_id, date_str)
                        on_formation, titre_formation = _is_formation(emp_id, date_str)
                        if on_conge:
                            jours.append(
                                {
                                    "date": date_str,
                                    "statut": "Conge",
                                    "type_conge": type_conge,
                                }
                            )
                        elif on_formation:
                            jours.append(
                                {
                                    "date": date_str,
                                    "statut": "Formation",
                                    "type_formation": titre_formation,
                                }
                            )
                        else:
                            jours.append({"date": date_str, "statut": "Absent"})

                planning.append(
                    {
                        "employe_id": emp_id,
                        "nom": emp.get("nom"),
                        "prenom": emp.get("prenom"),
                        "matricule": emp.get("matricule"),
                        "departement": emp.get("nom_departement"),
                        "planning": jours,
                    }
                )

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

            # Congés et missions pour exclure les absences "légitimes"
            conges = [c for c in self.conge_repo.get_by_employe(employe_id) if c.get("statut") in ("Valide", "Demande")]
            missions = [m for m in self.mission_repo.get_by_employe(employe_id) if m.get("statut") in ("Valide", "Demande")]
            formations = []
            if self.formation_repo:
                try:
                    formations = [f for f in self.formation_repo.get_by_employe(employe_id) if f.get("date_debut")]
                except Exception:
                    pass

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
                pointage = pointage_by_date.get(date_str)

                mission = next((m for m in missions if self._overlaps_day(m.get("date_debut"), m.get("date_fin"), date_str)), None)
                conge = next((c for c in conges if self._overlaps_day(c.get("date_debut"), c.get("date_fin"), date_str)), None)
                formation = next((f for f in formations if self._overlaps_day(f.get("date_debut"), f.get("date_fin"), date_str)), None)

                if pointage:
                    is_retard = (pointage.get("retard_minutes") or 0) > 0
                    if is_retard:
                        count_retard += 1
                    else:
                        count_presence += 1
                elif conge or mission or formation:
                    # Congé/Mission/Formation = ne compte pas comme absence
                    total_ouvrables -= 1
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
            conges = [c for c in self.conge_repo.get_by_employe(employe_id) if c.get("statut") in ("Valide", "Demande")]
            missions = [m for m in self.mission_repo.get_by_employe(employe_id) if m.get("statut") in ("Valide", "Demande")]
            formations = []
            if getattr(self, 'formation_repo', None):
                try:
                    formations = [f for f in self.formation_repo.get_by_employe(employe_id) if f.get("date_debut")]
                except Exception:
                    pass

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
                
                pointage = pointage_by_date.get(date_str)
                mission = next((m for m in missions if self._overlaps_day(m.get("date_debut"), m.get("date_fin"), date_str)), None)
                conge = next((c for c in conges if self._overlaps_day(c.get("date_debut"), c.get("date_fin"), date_str)), None)
                formation = next((f for f in formations if self._overlaps_day(f.get("date_debut"), f.get("date_fin"), date_str)), None)

                is_pres = 0
                is_ret = 0
                is_abs = 0
                
                heures_jour = 0.0
                if pointage:
                    heures_jour = float(pointage.get("duree_travail") or 0)
                    total_heures += heures_jour
                    
                    is_ret = 1 if (pointage.get("retard_minutes") or 0) > 0 else 0
                    if is_ret:
                        retards += 1
                        
                    is_pres = 1
                    jours_presents += 1
                
                if not is_pres and not conge and not mission and not formation:
                    if weekday < 5 and current < today:
                        if pointage and pointage.get("statut") == "Absent":
                            is_abs = 1
                        elif not pointage:
                            is_abs = 1

                    if is_abs:
                        jours_absents += 1

                if current < today and weekday < 5 and not conge and not mission and not formation:
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

            if total_ouvrables > 0:
                taux = min(round((jours_presents / total_ouvrables) * 100, 1), 100.0)
            else: 
                taux = 100.0 if jours_presents > 0 else 0.0

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
