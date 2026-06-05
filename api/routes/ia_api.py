# api/routes/ia_api.py
# Endpoint IA : analyse RH via Ollama (LLM local)

import os       
import json
import requests
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any
from backend.services.ia_service import analyse_rh, analyser_pour_dashboard

router = APIRouter()

# ─────────────────────────────────────────────
# CONFIG OLLAMA
# ─────────────────────────────────────────────

OLLAMA_URL   = "http://localhost:11434/api/chat"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")   # modèle par défaut
GEMINI_KEY   = os.getenv("GEMINI_API_KEY")

# ─────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────

class IARequest(BaseModel):
    question: str
    data_rh: dict[str, Any] = {}


class IAResponse(BaseModel):
    ok: bool
    reponse: str = ""
    model: str = ""
    error: str = ""


# ─────────────────────────────────────────────
# HELPER : format data_rh → text
# ─────────────────────────────────────────────

def _format_data_rh(data: dict) -> str:
    lines = []

    if "stats_globales" in data:
        lines.append("=== STATISTIQUES GLOBALES ===")
        for k, v in data["stats_globales"].items():
            lines.append(f"  {k}: {v}")

    if "employes_risque" in data:
        lines.append("\n=== EMPLOYÉS À RISQUE ===")
        for emp in data["employes_risque"][:10]:
            lines.append(
                f"  - {emp.get('prenom','')} {emp.get('nom','')} "
                f"(Dept: {emp.get('dept','N/A')}) | Score Métier: {emp.get('riskScore',0)}% "
                f"| Absences: {emp.get('absences',0)} | Retards: {emp.get('retards',0)} "
                f"| RF Pred: {emp.get('rf_prediction',0)} ({emp.get('rf_probability',0)}% risk, {emp.get('rf_confidence','N/A')}) "
                f"| Pattern: {emp.get('pattern','N/A')}"
            )

    if "risques_departements" in data:
        lines.append("\n=== RISQUES PAR DÉPARTEMENT ===")
        for dept in data["risques_departements"]:
            lines.append(
                f"  - {dept.get('dept','N/A')}: score {dept.get('score',0)}/100 "
                f"({dept.get('level','N/A')}) | {dept.get('observation','')} "
                f"| {dept.get('totalEmp',0)} employés"
            )

    if "alertes" in data:
        lines.append("\n=== ALERTES ACTIVES ===")
        for alert in data["alertes"][:10]:
            lines.append(
                f"  [{alert.get('severity','').upper()}] {alert.get('type','')} — {alert.get('message','')}"
            )

    if "stats_mensuelles" in data:
        lines.append("\n=== STATISTIQUES MENSUELLES ===")
        for stat in data["stats_mensuelles"][:10]:
            lines.append(
                f"  - {stat.get('prenom','')} {stat.get('nom','')} "
                f"| Heures: {stat.get('total_heures',0)}h / {stat.get('heures_attendues',160)}h "
                f"| Taux: {stat.get('taux_heures',0)}% "
                f"| Manquantes: {stat.get('heures_manquantes',0)}h"
            )

    return "\n".join(lines) if lines else "Aucune donnée disponible."


# ─────────────────────────────────────────────
# ENDPOINT
# ─────────────────────────────────────────────

@router.post("/analyser", response_model=IAResponse)
async def analyser(req: IARequest):
    """Analyse RH via IA (ARIA) — reçoit données + question."""
    try:
        reponse = await analyse_rh(req.data_rh, req.question)
        model = "gemini-1.5-flash" if os.getenv("GEMINI_API_KEY") else os.getenv("OLLAMA_MODEL", "mistral")
        return IAResponse(ok=True, reponse=reponse, model=model)
    except Exception as e:
        return IAResponse(ok=False, error=str(e))

@router.post("/dashboard-stats")
async def dashboard_stats(req: IARequest):
    """
    Génère une synthèse JSON structurée pour les widgets du dashboard.
    """
    try:
        data = await analyser_pour_dashboard(req.data_rh)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.post("/chat", response_model=IAResponse)
async def chat(req: IARequest):
    """Alias for analyser, used by floating chatbot."""
    return await analyser(req)



class SafeQueryRequest(BaseModel):
    query: str
    params: list = []

@router.post("/execute-safe-query")
async def execute_safe_query(req: SafeQueryRequest):
    import re
    from fastapi import HTTPException
    
    query_upper = req.query.strip().upper()
    
    # 1. Must be SELECT only
    if not query_upper.startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Seules les requêtes SELECT sont autorisées.")
        
    # 2. Prevent query chaining (semicolon)
    if ";" in req.query:
        raise HTTPException(status_code=400, detail="Les requêtes multiples (point-virgule) ne sont pas autorisées.")
        
    # 3. Deny destructive actions
    forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "XP_CMDSHELL", "EXEC", "EXECUTE", "INTO", "MERGE"]
    for keyword in forbidden_keywords:
        if re.search(r'\b' + keyword + r'\b', query_upper):
            raise HTTPException(status_code=400, detail=f"Mot-clé interdit détecté : {keyword}")
            
    # 4. Strictly whitelist allowed tables
    allowed_tables = ["DBO.EMPLOYE", "DBO.DEPARTEMENT", "DBO.POINTAGE", "DBO.CONGE", "DBO.MISSION", "DBO.FORMATION", "DBO.INSCRIPTION", "EMPLOYE", "DEPARTEMENT", "POINTAGE", "CONGE", "MISSION", "FORMATION", "INSCRIPTION"]
    
    tables_found = re.findall(r'\b(?:FROM|JOIN)\s+([a-zA-Z0-9_\.]+)', query_upper)
    for table in tables_found:
        clean_table = table.strip().replace("[", "").replace("]", "")
        if clean_table not in allowed_tables:
            raise HTTPException(status_code=400, detail=f"Accès à la table non autorisée : {clean_table}")
            
    # 5. Execute query
    from backend.db import Database
    db = Database()
    try:
        results = db.fetch_all(req.query, req.params)
        return {"ok": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur SQL : {str(e)}")
    finally:
        db.close()


class ChatMessageModel(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    messages: list[ChatMessageModel]


@router.post("/ai-chat")
def post_ai_chat(req: AIChatRequest):
    """
    Endpoint de chat IA RH connecté en direct à la base de données réelle.
    Construit un contexte RH complet et l'envoie à Llama 3.3 Versatile via Groq Cloud.
    """
    from backend.db import Database
    from fastapi import HTTPException
    
    db = Database()
    
    try:
        # 1. Effectifs
        total_employes = db.fetch_all("SELECT COUNT(*) as count FROM dbo.Employe WHERE statut = 'Actif'")[0]["count"]
        total_departements = db.fetch_all("SELECT COUNT(*) as count FROM dbo.Departement")[0]["count"]
        
        # 2. Présence d'aujourd'hui
        today_stats = db.fetch_all("""
            SELECT 
                SUM(CASE WHEN statut = 'Present' THEN 1 ELSE 0 END) as presents,
                SUM(CASE WHEN statut = 'Absent' THEN 1 ELSE 0 END) as absents,
                SUM(CASE WHEN retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
                SUM(CASE WHEN statut = 'Present' AND retard_minutes = 0 THEN 1 ELSE 0 END) as a_l_heure
            FROM dbo.Pointage
            WHERE date_pointage = CAST(GETDATE() AS DATE)
        """)[0]
        
        p_today = today_stats["presents"] or 0
        a_today = today_stats["absents"] or 0
        r_today = today_stats["retards"] or 0
        h_today = today_stats["a_l_heure"] or 0
        
        # 3. Statistiques 30 jours
        presence_stats = db.fetch_all("""
            SELECT 
                SUM(CASE WHEN statut = 'Present' THEN 1 ELSE 0 END) as presents,
                SUM(CASE WHEN statut = 'Absent' THEN 1 ELSE 0 END) as absents,
                SUM(CASE WHEN retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
                SUM(CASE WHEN statut = 'Present' AND retard_minutes = 0 THEN 1 ELSE 0 END) as a_l_heure
            FROM dbo.Pointage
            WHERE date_pointage >= DATEADD(day, -30, GETDATE())
        """)[0]
        
        presents_30j = presence_stats["presents"] or 0
        absents_30j = presence_stats["absents"] or 0
        retards_30j = presence_stats["retards"] or 0
        a_l_heure_30j = presence_stats["a_l_heure"] or 0
        total_records_30j = presents_30j + absents_30j
        
        taux_presence_30j = round((presents_30j / max(total_records_30j, 1)) * 100, 1)
        taux_ponctualite_30j = round((a_l_heure_30j / max(presents_30j, 1)) * 100, 1)
        
        # 4. Employés les plus absents ou en retard
        high_risks = db.fetch_all("""
            SELECT TOP 5 e.nom, e.prenom, d.nom_departement as departement,
                   SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
                   SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
                   ROUND((SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) * 0.4) +
                         (SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) * 0.3) +
                         ((1 - CAST(SUM(CASE WHEN p.statut = 'Present' AND p.retard_minutes = 0 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0)) * 100 * 0.3), 1) as score_risque
            FROM dbo.Pointage p
            JOIN dbo.Employe e ON p.employe_id = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE p.date_pointage >= DATEADD(day, -30, GETDATE())
            GROUP BY e.nom, e.prenom, d.nom_departement
            ORDER BY score_risque DESC
        """)
        
        # 5. Risques par département
        risk_depts = db.fetch_all("""
            SELECT TOP 5 d.nom_departement as dept,
                   SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
                   SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as retards
            FROM dbo.Pointage p
            JOIN dbo.Employe e ON p.employe_id = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE p.date_pointage >= DATEADD(day, -30, GETDATE())
            GROUP BY d.nom_departement
            ORDER BY absences DESC, retards DESC
        """)
        
        # 6. Employés sans pointage aujourd'hui
        sans_pointage = db.fetch_all("""
            SELECT TOP 10 e.prenom, e.nom, d.nom_departement as departement
            FROM dbo.Employe e
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE e.statut = 'Actif' 
              AND e.employe_id NOT IN (
                  SELECT employe_id FROM dbo.Pointage WHERE date_pointage = CAST(GETDATE() AS DATE)
              )
        """)

        # 7. Synthèse du contexte RH
        contexte_rh = {
            "total_employees": total_employes,
            "total_departments": total_departements,
            "presents_today": p_today,
            "absents_today": a_today,
            "retards_today": r_today,
            "a_l_heure_today": h_today,
            "stats_30j": {
                "taux_presence_moyen": f"{taux_presence_30j}%",
                "taux_ponctualite_moyen": f"{taux_ponctualite_30j}%",
                "total_absences": absents_30j,
                "total_retards": retards_30j
            },
            "employes_a_risque": [
                {
                    "nom": f"{emp['prenom']} {emp['nom']}",
                    "departement": emp["departement"],
                    "absences": emp["absences"] or 0,
                    "retards": emp["retards"] or 0,
                    "score_risque": f"{emp['score_risque']}%"
                } for emp in high_risks
            ],
            "departements_risque": [
                {
                    "departement": dept["dept"],
                    "absences": dept["absences"] or 0,
                    "retards": dept["retards"] or 0
                } for dept in risk_depts
            ],
            "employees_sans_pointage_today": [
                f"{emp['prenom']} {emp['nom']} ({emp['departement']})" for emp in sans_pointage
            ]
        }
        
        # 8. System Prompt IA RH
        system_prompt = f"""Tu es un analyste RH SaaS expert et intelligent.
Ton objectif est de fournir des analyses courtes, percutantes et structurées basées sur les données SQL Server fournies.

Contexte actuel de l'entreprise (Données réelles) :
{json.dumps(contexte_rh, ensure_ascii=False, indent=2)}

RÈGLES STRICTES ET ABSOLUES :
1. Tu dois répondre EXACTEMENT à la question posée, de façon courte et claire (max 350 mots).
2. INTERDICTION TOTALE de générer un "Email RH", "Template de message", "Avertissement" ou "Convocation" SAUF si l'utilisateur le demande EXPLICITEMENT (ex: "génère un email", "écris un mail").
3. Ne propose jamais de générer un mail automatiquement à la fin de ta réponse.
4. Parle de manière moderne, SaaS, professionnelle. Pas de répétitions, pas de pavés de texte.
5. Utilise STRICTEMENT le format de réponse structuré suivant :

# Résumé
petit résumé intelligent

# Analyse
analyse RH concise

# Données
[Inclus un vrai tableau Markdown propre ICI UNIQUEMENT SI pertinent pour la question]

# Recommandation
- Max 2 ou 3 recommandations utiles (liste à puces)
"""

        # 9. Envoyer la requête à Groq Cloud
        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY manquante dans les variables d'environnement")
            
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        # Préparer la liste des messages avec l'historique complet + le system prompt au début
        messages_payload = [
            {"role": "system", "content": system_prompt}
        ]
        
        for msg in req.messages:
            messages_payload.append({
                "role": msg.role,
                "content": msg.content
            })
        
        payload = {
            "model": groq_model,
            "messages": messages_payload,
            "temperature": 0.2
        }
        
        headers = {
            "Authorization": f"Bearer {groq_key}",
            "Content-Type": "application/json"
        }
        
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=60)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"Erreur Groq Cloud: {resp.text}")
            
        completion = resp.json()
        reply_content = completion["choices"][0]["message"]["content"]
        
        return {"ok": True, "reply": reply_content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

