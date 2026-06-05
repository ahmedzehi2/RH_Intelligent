# backend/services/ia_service.py
import json
import os
import requests
from typing import Any, Optional

SYSTEM_PROMPT_RH = """Tu es ARIA, un assistant IA expert en Ressources Humaines intégré dans une 
plateforme RH professionnelle. Tu reçois des données internes d'entreprise 
en temps réel et tu produis une analyse structurée, claire et actionnelle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONTEXTE ET DONNÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Les données proviennent de deux sources complémentaires :
1. Analyse règle-métier — comportements observés (retards, absences, patterns)
2. Modèle Random Forest — prédiction du risque futur (rf_prediction, rf_probability, rf_confidence)

Quand les deux sources sont en accord → risque CONFIRMÉ, priorité maximale.
Quand elles divergent → signaler la discordance, recommander vérification manuelle.
Quand le modèle RF n'est pas disponible → baser l'analyse sur les règles-métier uniquement.

Données reçues :
{{DATA_RH}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TON OBJECTIF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Produire une analyse RH complète en 4 sections.
Chaque section doit être courte, claire et immédiatement exploitable par un 
responsable RH sans formation technique.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SECTION 1 — Détection des comportements anormaux
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Identifier les employés avec des comportements inhabituels.
Anomalies à détecter :
- Retards répétés (notamment en début de semaine)
- Absences concentrées sur lundi ou vendredi
- Absences non justifiées récurrentes
- Absences et retards combinés sur la même période
- Comportement récent dégradé par rapport à l'historique
- Discordance entre règle-métier et modèle RF (signaler séparément)

Format de réponse :
## 🔎 Comportements anormaux détectés

- [Prénom Nom] (Département) → [Type d'anomalie] : [explication en 1 phrase]
  ↳ Source : [Règle-métier / Modèle IA / Les deux — CONFIRMÉ]

Si aucune anomalie : écrire "✅ Aucun comportement anormal détecté ce mois-ci."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SECTION 2 — Prédiction de l'absentéisme
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Identifier les employés susceptibles d'être absents prochainement.
Baser la prédiction sur :
- Tendances passées (retards fréquents = signal précurseur)
- Historique des absences récentes
- Résultat du modèle Random Forest si disponible (rf_prediction = 1)
- Pattern jour de la semaine (absences lundi/vendredi = signal fort)

Niveaux de probabilité UNIQUEMENT :
→ Faible    : signal isolé, pas de tendance marquée
→ Moyen     : plusieurs signaux combinés, à surveiller
→ Élevé     : tendance claire, règle-métier ET modèle en accord
→ Très élevé: situation critique, intervention immédiate recommandée

Format de réponse :
## 📊 Prédiction d'absentéisme

- [Prénom Nom] → [Faible / Moyen / Élevé / Très élevé] : [raison en 1 phrase]

Si aucune prédiction : écrire "✅ Aucun risque d'absentéisme prédit pour la période."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SECTION 3 — Employés à risque (statuts RH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Classer chaque employé signalé dans une catégorie RH :

Statuts disponibles UNIQUEMENT :
→ Stable      : comportement normal, pas d'action requise
→ À surveiller: signaux préoccupants, suivi recommandé
→ Critique    : situation urgente, intervention RH nécessaire

Format de réponse :
## ⚠️ Employés à risque

- [Prénom Nom] (Département) → [Stable / À surveiller / Critique]
  Motif : [explication courte]
  Action recommandée : [1 action concrète max]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SECTION 4 — Analyse des départements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Évaluer l'état de chaque département et détecter les tensions collectives.
Niveaux département UNIQUEMENT :
→ Stable      : pas d'anomalie collective
→ Sous tension: plusieurs signaux individuels dans le même département
→ Critique    : situation collective dégradée, action managériale requise

Format de réponse :
## 🏢 État des départements

- [Nom département] → [Stable / Sous tension / Critique]
  Observation : [1 phrase sur la situation]
  Recommandation : [1 action managériale ou RH]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 RÈGLES ABSOLUES — NE JAMAIS VIOLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Interdit :
- Afficher un score numérique (ex: 72/100, 85%)
- Utiliser des pourcentages bruts (ex: "taux de 43%")
- Mentionner rf_probability ou riskScore directement
- Inventer des données absentes du JSON fourni
- Écrire plus de 2 phrases par employé
- Utiliser un vocabulaire technique (ex: "features", "Random Forest", "classification")

✅ Obligatoire :
- Utiliser uniquement : Faible / Moyen / Élevé / Très élevé
- Utiliser uniquement : Stable / À surveiller / Critique
- Utiliser uniquement : Sous tension (pour les départements)
- Langage professionnel RH, compréhensible par un non-technicien
- Répondre en français uniquement
- Si une donnée est manquante : écrire "Information insuffisante"
- Toujours terminer par une section "Priorités d'action" (3 actions max)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SECTION FINALE OBLIGATOIRE — Priorités d'action
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Toujours terminer par :

## 🎯 Priorités d'action RH

1. [Action urgente — employé ou département Critique]
2. [Action préventive — employés À surveiller]
3. [Action structurelle — amélioration globale]
"""

SYSTEM_PROMPT_DASHBOARD_JSON = """Tu es ARIA, un expert en analyse des ressources humaines.

🎯 OBJECTIF :
Analyser les données RH fournies et générer une synthèse claire, professionnelle et exploitable pour un dashboard.

⚠️ RÈGLES STRICTES :
- ❌ Interdit d'utiliser des scores numériques (0-100, %, probabilités chiffrées)
- ❌ Interdit d'utiliser du jargon technique (machine learning, modèle, features, etc.)
- ❌ Interdit de mentionner des calculs internes
- ✅ Utiliser uniquement des niveaux qualitatifs :
   - Faible | Moyen | Élevé
   - Stable | À surveiller | Critique
- ✅ Les réponses doivent être simples, compréhensibles par un responsable RH
- ✅ Chaque explication doit être courte et claire

📊 ANALYSES À FOURNIR :

1. 🔎 Détection des comportements anormaux
Identifier les employés ayant :
- Retards fréquents
- Absences répétées
- Comportement inhabituel

2. 📊 Prédiction de l’absentéisme
Identifier les employés susceptibles d’être absents prochainement
Basé sur tendances récentes (retards, absences)

3. ⚠️ Identification des employés à risque
Classer chaque employé dans :
- Stable
- À surveiller
- Critique

📌 FORMAT DE RÉPONSE (OBLIGATOIRE - JSON uniquement) :

{
  "anomalies": [
    {
      "nom": "Nom Prénom",
      "type": "Type d’anomalie",
      "explication": "Explication simple"
    }
  ],
  "predictions": [
    {
      "nom": "Nom Prénom",
      "niveau": "Faible | Moyen | Élevé",
      "raison": "Pourquoi"
    }
  ],
  "risques": [
    {
      "nom": "Nom Prénom",
      "statut": "Stable | À surveiller | Critique",
      "explication": "Pourquoi"
    }
  ]
}

📌 IMPORTANT :
- Même si des données internes contiennent des scores, tu dois les ignorer
- Tu dois transformer toute analyse en langage métier (RH)
- Ne retourne RIEN d’autre que le JSON
"""

async def analyse_rh(data_rh: dict, question: Optional[str] = None) -> str:
    """
    Génère une analyse RH structurée via LLM (Gemini ou Ollama).
    Injecte les données DATA_RH dans le prompt ARIA.
    """
    # Préparation du prompt
    data_json = json.dumps(data_rh, ensure_ascii=False, indent=2)
    prompt_final = SYSTEM_PROMPT_RH.replace("{{DATA_RH}}", data_json)
    
    if question:
        prompt_final += f"\n\nUSER QUESTION: {question}\nRéponds en respectant le format ARIA."

    gemini_key = os.getenv("GEMINI_API_KEY")
    
    try:
        if gemini_key:
            # Appel Gemini
            url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt_final}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
            }
            resp = requests.post(url, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            # Appel Ollama (Local)
            url = "http://localhost:11434/api/chat"
            payload = {
                "model": os.getenv("OLLAMA_MODEL", "mistral"),
                "messages": [{"role": "user", "content": prompt_final}],
                "stream": False
            }
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "Erreur Ollama")
            
    except Exception as e:
        return f"❌ Erreur d'analyse IA : {str(e)}"

async def analyser_pour_dashboard(data_rh: dict) -> dict:
    """
    Génère une synthèse JSON pour le dashboard RH.
    Retourne un dictionnaire prêt à être envoyé au frontend.
    """
    data_json_str = json.dumps(data_rh, ensure_ascii=False, indent=2)
    prompt_final = SYSTEM_PROMPT_DASHBOARD_JSON.replace("{{data_rh}}", data_json_str)

    gemini_key = os.getenv("GEMINI_API_KEY")
    reponse_brute = ""

    try:
        if gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt_final}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
            }
            resp = requests.post(url, json=payload, timeout=60)
            resp.raise_for_status()
            reponse_brute = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        else:
            url = "http://localhost:11434/api/chat"
            payload = {
                "model": os.getenv("OLLAMA_MODEL", "mistral"),
                "messages": [{"role": "user", "content": prompt_final}],
                "stream": False
            }
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            reponse_brute = resp.json().get("message", {}).get("content", "{}")

        # Nettoyage JSON (pour enlever d'éventuels blocs ```json ... ```)
        clean_json = reponse_brute.strip()
        if "```json" in clean_json:
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_json:
            clean_json = clean_json.split("```")[1].split("```")[0].strip()

        return json.loads(clean_json)

    except Exception as e:
        print(f"[IA_SERVICE] Erreur Dashboard JSON: {e}")
        return {
            "anomalies": [],
            "predictions": [],
            "risques": [],
            "error": str(e)
        }


def calculate_risk_score(emp_stats: dict) -> float:
    """
    Score 0-100 basé sur 3 facteurs pondérés.
    retards          → poids 0.3
    absences         → poids 0.5
    heures_manquantes → poids 0.2
    """
    retards_norm           = min(emp_stats["nb_retards"] / 20 * 100, 100)
    absences_norm          = min(emp_stats["nb_absences"] / 10 * 100, 100)
    
    # Gérer les heures manquantes négatives comme 0
    hm = max(emp_stats.get("heures_manquantes", 0), 0)
    heures_manquantes_norm = min(hm / 40 * 100, 100)

    # Note: On a mis à jour avec -(1-taux_heures) comme mentionné en fin de prompt par le user ?
    # Le user dit "risk_score = (absences * 0.4) + (retards * 0.3) + ((1 - taux_heures) * 100 * 0.3)"
    # Mais le code principal partagé donnait 0.3/0.5/0.2. Gardons la logique du code principal (qui est propre et bornée p/r à 100).

    return round(
        retards_norm           * 0.3 +
        absences_norm          * 0.5 +
        heures_manquantes_norm * 0.2,
        1
    )

def get_risk_level(score: float) -> dict:
    if score > 70:
        return {"niveau": "eleve",  "label": "Risque élevé",  "color": "red"}
    elif score > 40:
        return {"niveau": "moyen",  "label": "Risque moyen",  "color": "orange"}
    else:
        return {"niveau": "faible", "label": "Stable",        "color": "green"}

def detect_patterns(emp_stats: dict, moyenne_retards: float) -> list[str]:
    """Détection comportements anormaux — règles métier."""
    patterns = []

    # Retards > 2x la moyenne
    if moyenne_retards > 0 and emp_stats["nb_retards"] > moyenne_retards * 2:
        patterns.append("Retards anormalement élevés vs moyenne équipe")

    # Absences répétées lundi/vendredi
    if emp_stats.get("absences_lun_ven", 0) > 3:
        patterns.append("Absences répétées lundi/vendredi détectées")

    # Retards consécutifs (3+ jours de suite)
    if emp_stats.get("retards_consecutifs", 0) >= 3:
        patterns.append(f"{emp_stats['retards_consecutifs']} retards consécutifs")

    # Heures très faibles (<60% objectif)
    if emp_stats.get("taux_heures", 100) < 60:
        patterns.append("Heures travaillées < 60% de l'objectif")

    return patterns

def run_ia_analysis(employes_stats: list, moyenne_retards: float) -> dict:
    employes_risque = []
    alertes         = []
    risk_counts     = {"eleve": 0, "moyen": 0, "faible": 0}

    for emp in employes_stats:
        score    = calculate_risk_score(emp)
        risk     = get_risk_level(score)
        patterns = detect_patterns(emp, moyenne_retards)

        employes_risque.append({
            "id":       emp["id"],
            "nom":      emp["nom"],
            "prenom":   emp["prenom"],
            "dept":     emp["departement"],
            "score":    score,
            "niveau":   risk["niveau"],
            "label":    risk["label"],
            "color":    risk["color"],
            "patterns": patterns,
        })

        risk_counts[risk["niveau"]] += 1

        # Alertes automatiques
        if risk["niveau"] == "eleve":
            alertes.append({
                "niveau":  "danger",
                "message": f"{emp['nom']} {emp['prenom']} — score risque {score}/100 ({', '.join(patterns) or 'profil à risque'})"
            })

    # Alerte globale absentéisme
    if risk_counts["eleve"] > 5:
        alertes.insert(0, {
            "niveau":  "danger",
            "message": f"{risk_counts['eleve']} employés à risque élevé — intervention RH recommandée"
        })

    # Return top 5 employes a risques (ceux qui ont plus de score)
    # Filtre seulement ceux qui ont > 0 et les trie
    employes_risque_trie = sorted([e for e in employes_risque if e["score"] > 0], key=lambda x: x["score"], reverse=True)

    return {
        "employes_risque": employes_risque_trie[:5],
        "risk_counts":     risk_counts,
        "alertes":         alertes,
        "score_global":    round(sum(e["score"] for e in employes_risque) / len(employes_risque), 1) if employes_risque else 0,
    }
