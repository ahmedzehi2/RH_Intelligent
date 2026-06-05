# Documentation Technique : Système de Gestion des Absences Automatiques

## 1. Contexte Projet
Ce document récapitule l'architecture fonctionnelle et technique du module de gestion des absences automatiques. Ce système automatise la détection des absences journalières en croisant les données de pointage avec les justifications officielles (congés, missions, formations).

## 2. Stack Technique
*   **Frontend** : Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, SWR, Recharts.
*   **Backend** : Python (FastAPI).
*   **Base de données** : SQL Server (Driver `pyodbc`, schéma `dbo`).
*   **Authentification** : Context Auth existant (`useAuth`).

## 3. Architecture des Endpoints (API)
Tous les endpoints sont préfixés par l'URL de base de l'API.

| Méthode | Route | Description |
| :--- | :--- | :--- |
| **POST** | `/absence/sync` | Déclenche la synchronisation globale (détection AUTO) pour une date donnée. |
| **GET** | `/absence/all` | Liste filtrée des absences (params: `month`, `date`, `type`, `statut`, `departement`). |
| **PUT** | `/absence/statut` | Mise à jour du statut par le RH (Justifier / Refuser). |
| **GET** | `/absence/employe/{id}` | Historique complet des absences pour un employé spécifique. |
| **POST** | `/absence/supprimer` | Suppression définitive d'une absence (RH uniquement). |

## 4. Logique Métier : Détection Automatique
La fonction `synchroniser_absences_jour` suit cet algorithme :

1.  **Vérification Temporelle** : Ignore les week-ends (Samedi/Dimanche).
2.  **Cible** : Sélectionne uniquement les employés ayant le statut **'Actif'**.
3.  **Vérification de Présence** : Si un pointage existe pour l'employé à la `date_cible` -> **STOP** (Présent).
4.  **Vérification de Justification** :
    *   **Congé** : Statut `Valide` ou `Approuve` couvrant la date.
    *   **Mission** : Statut `Valide`, `Validée`, `Accepte` ou `Approuve` couvrant la date.
    *   **Formation** : Inscription active dans la table `Inscription` pour une formation couvrant la date.
    *   *Si une justification est trouvée* -> **STOP** (Justifié).
5.  **Création Absence AUTO** :
    *   Vérifie l'absence de doublon.
    *   Insère une ligne avec `type = 'AUTO'`, `statut = 'En attente'`, `justifiee = 0`.
    *   Motif par défaut : *"Absence automatique (aucun pointage ni justificatif)"*.

## 5. Workflow RH (Traitement)
1.  **Visualisation** : Les absences `AUTO` apparaissent en rouge dans le dashboard avec le statut **En attente**.
2.  **Action Justifier** : Passe le statut à `JUSTIFIEE` et `justifiee = 1`.
3.  **Action Non Justifiée** : Passe le statut à `REFUSEE` et `justifiee = 0`.
4.  **Immuabilité** : Une fois traitée (Justifiée ou Refusée), l'absence est verrouillée. L'API rejette toute modification ultérieure et l'UI affiche le badge **"Traité"**.

## 6. Schéma de Données (Référence)
*   `dbo.Absence` : `absence_id`, `employe_id`, `date_absence`, `type` (AUTO/MANUEL), `statut`, `justifiee` (0/1), `motif`.
*   `dbo.Pointage` : Lien via `employe_id` et `date_pointage`.
*   `dbo.Conge` / `dbo.Mission` : Vérification du `statut` et de la plage de dates.
*   `dbo.Inscription` / `dbo.Formation` : Vérification de la participation aux sessions de formation.

## 7. Principes de Développement
*   **Idempotence** : Le bouton "Synchroniser" peut être cliqué plusieurs fois sans créer de doublons.
*   **Auto-Correction** : Si un justificatif est validé après la détection d'une absence AUTO, une nouvelle synchronisation supprimera automatiquement l'absence AUTO devenue obsolète.
*   **Performance** : Requêtes SQL optimisées avec regroupement des données par date pour minimiser les appels à la base.
