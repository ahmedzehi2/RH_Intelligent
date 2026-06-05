# backend/services/ml_service.py

import logging
import os
import random
from datetime import date

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, f1_score, recall_score, roc_auc_score, precision_score, confusion_matrix
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler



random.seed(None)  # Utiliser une graine aléatoire réelle (pas de seed fixe pour la variabilité)

MODEL_PATH = "models/absenteisme_models.pkl"

# Extended feature set - enriched with 30/90-day history, trends, and context
FEATURES = [
    # Historique 30 jours
    "abs_30j",
    "ret_30j",
    "presence_30j",
    
    # Historique 90 jours
    "abs_90j",
    "ret_90j",
    "presence_90j",
    
    # Historique d'absences détaillé
    "abs_injustifiees",
    "abs_justifiees",
    
    # Statistiques retards
    "retard_moyen_minutes",
    "retard_max_minutes",
    
    # Comportement récent
    "presence_5j",
    "presence_10j",
    "anomalies_recentes",
    
    # Tendances et variance
    "absence_trend",
    "delay_trend",
    "behavior_variance",
    
    # Contexte jour
    "jour_semaine",
    "est_fin_semaine",
    "est_debut_semaine",
    "veille_jour_ferie",
    "retour_jour_ferie",
    
    # Informations RH
    "anciennete_mois",
    "dept_id",
    "type_contrat_numeric",
]

class AbsenteismeModel:
    def __init__(self):
        self.rf_model = None
        self.logreg_model = None
        self.trained = False
        self.accuracy = None
        self.rf_metrics = {}
        self.logreg_metrics = {}
        self.logger = logging.getLogger(__name__)
        self.scaler = StandardScaler()

    def prepare_features(self, employes: list[dict]) -> pd.DataFrame:
        """
        Convert raw employee dicts to enriched feature DataFrame.
        Includes 30/90-day history, recent behavior, trends, and date context.
        """
        df = pd.DataFrame(employes)

        # Ensure all required columns exist with defaults
        # Historique 30 jours
        if "abs_30j" not in df.columns:
            df["abs_30j"] = 0
        df["abs_30j"] = pd.to_numeric(df["abs_30j"], errors="coerce").fillna(0.0)
        
        if "ret_30j" not in df.columns:
            df["ret_30j"] = 0
        df["ret_30j"] = pd.to_numeric(df["ret_30j"], errors="coerce").fillna(0.0)
        
        if "presence_30j" not in df.columns:
            df["presence_30j"] = 20
        df["presence_30j"] = pd.to_numeric(df["presence_30j"], errors="coerce").fillna(20.0)

        # Historique 90 jours
        if "abs_90j" not in df.columns:
            df["abs_90j"] = 0
        df["abs_90j"] = pd.to_numeric(df["abs_90j"], errors="coerce").fillna(0.0)
        
        if "ret_90j" not in df.columns:
            df["ret_90j"] = 0
        df["ret_90j"] = pd.to_numeric(df["ret_90j"], errors="coerce").fillna(0.0)
        
        if "presence_90j" not in df.columns:
            df["presence_90j"] = 60
        df["presence_90j"] = pd.to_numeric(df["presence_90j"], errors="coerce").fillna(60.0)

        # Absences détaillées
        if "abs_injustifiees" not in df.columns:
            df["abs_injustifiees"] = 0
        df["abs_injustifiees"] = pd.to_numeric(df["abs_injustifiees"], errors="coerce").fillna(0.0)
        
        if "abs_justifiees" not in df.columns:
            df["abs_justifiees"] = 0
        df["abs_justifiees"] = pd.to_numeric(df["abs_justifiees"], errors="coerce").fillna(0.0)

        # Statistiques retards
        if "retard_moyen_minutes" not in df.columns:
            df["retard_moyen_minutes"] = 0
        df["retard_moyen_minutes"] = pd.to_numeric(df["retard_moyen_minutes"], errors="coerce").fillna(0.0)
        
        if "retard_max_minutes" not in df.columns:
            df["retard_max_minutes"] = 0
        df["retard_max_minutes"] = pd.to_numeric(df["retard_max_minutes"], errors="coerce").fillna(0.0)

        # Comportement récent
        if "presence_5j" not in df.columns:
            df["presence_5j"] = 5
        df["presence_5j"] = pd.to_numeric(df["presence_5j"], errors="coerce").fillna(5.0)
        
        if "presence_10j" not in df.columns:
            df["presence_10j"] = 10
        df["presence_10j"] = pd.to_numeric(df["presence_10j"], errors="coerce").fillna(10.0)
        
        if "anomalies_recentes" not in df.columns:
            df["anomalies_recentes"] = 0
        df["anomalies_recentes"] = pd.to_numeric(df["anomalies_recentes"], errors="coerce").fillna(0.0)

        # Tendances et variance
        if "absence_trend" not in df.columns:
            df["absence_trend"] = 0
        df["absence_trend"] = pd.to_numeric(df["absence_trend"], errors="coerce").fillna(0.0)
        
        if "delay_trend" not in df.columns:
            df["delay_trend"] = 0
        df["delay_trend"] = pd.to_numeric(df["delay_trend"], errors="coerce").fillna(0.0)
        
        if "behavior_variance" not in df.columns:
            df["behavior_variance"] = 0
        df["behavior_variance"] = pd.to_numeric(df["behavior_variance"], errors="coerce").fillna(0.0)

        # Contexte jour
        if "jour_semaine" not in df.columns:
            df["jour_semaine"] = 2
        df["jour_semaine"] = pd.to_numeric(df["jour_semaine"], errors="coerce").fillna(2.0).clip(1, 7)
        df["est_fin_semaine"] = (df["jour_semaine"].isin([5.0, 6.0, 7.0])).astype(float)
        df["est_debut_semaine"] = (df["jour_semaine"].isin([1.0, 2.0])).astype(float)
        
        if "veille_jour_ferie" not in df.columns:
            df["veille_jour_ferie"] = 0
        df["veille_jour_ferie"] = pd.to_numeric(df["veille_jour_ferie"], errors="coerce").fillna(0.0).astype(float)
        
        if "retour_jour_ferie" not in df.columns:
            df["retour_jour_ferie"] = 0
        df["retour_jour_ferie"] = pd.to_numeric(df["retour_jour_ferie"], errors="coerce").fillna(0.0).astype(float)

        # RH
        if "anciennete_mois" not in df.columns:
            df["anciennete_mois"] = 0
        df["anciennete_mois"] = pd.to_numeric(df["anciennete_mois"], errors="coerce").fillna(0.0)
        
        if "dept_id" not in df.columns:
            df["dept_id"] = 0
        df["dept_id"] = pd.to_numeric(df["dept_id"], errors="coerce").fillna(0.0)
        
        if "type_contrat_numeric" not in df.columns:
            df["type_contrat_numeric"] = 1
        df["type_contrat_numeric"] = pd.to_numeric(df["type_contrat_numeric"], errors="coerce").fillna(1.0)
        return df[FEATURES].fillna(0).astype(float)

    def label_data(self, df: pd.DataFrame) -> pd.Series:
        """
        Labeling réaliste avec variabilité stochastique.
        Règles basées sur des seuils métier clairs, avec probabilité 80/20
        pour éviter que le modèle mémorise des règles fixes.
        Poids maîtrisés : absences ≤ 2.0, retards ≤ 1.5, anomalies ≤ 1.5
        """
        n = len(df)
        labels = np.zeros(n, dtype=int)

        for i in range(n):
            absences = df["abs_30j"].iloc[i]
            retards = df["ret_30j"].iloc[i]
            abs_injustifiees = df["abs_injustifiees"].iloc[i]
            anomalies = df["anomalies_recentes"].iloc[i]

            # Condition à risque élevé : beaucoup d'absences ou retards
            if absences >= 2 or retards >= 4 or abs_injustifiees >= 2:
                # 80% de chance d'être labellisé à risque
                labels[i] = 1 if random.random() < 0.80 else 0
            elif absences >= 1 or retards >= 2 or anomalies >= 1.0:
                # Risque modéré : 40% de chance
                labels[i] = 1 if random.random() < 0.40 else 0
            else:
                # Faible risque : 10% de chance (bruit naturel)
                labels[i] = 1 if random.random() < 0.10 else 0

        y = pd.Series(labels, index=df.index)
        n_pos = int(y.sum())
        n_neg = int((y == 0).sum())
        print(f"[ML] Class Distribution: Risk=1 ({n_pos} employees), Normal=0 ({n_neg} employees)")

        # Garantir au moins 2 exemples de chaque classe pour la validation croisée
        if n_pos < 2 or n_neg < 2:
            self.logger.warning("Distribution déséquilibrée détectée, recalibration...")
            # Forcer un minimum équilibré : top 30% = à risque
            total_risk = df["abs_30j"] * 2.0 + df["ret_30j"] * 1.5 + df["anomalies_recentes"] * 1.5
            threshold = np.percentile(total_risk, 70)
            y = (total_risk > threshold).astype(int)

        return y

    def _build_metrics(self, y_true: pd.Series, y_pred: np.ndarray, y_proba: np.ndarray = None) -> dict:
        """Build comprehensive metrics for model evaluation."""
        try:
            precision = float(precision_score(y_true, y_pred, zero_division=0))
        except:
            precision = 0.0
        
        try:
            roc_auc = float(roc_auc_score(y_true, y_proba[:, 1])) if y_proba is not None and len(y_proba.shape) == 2 else 0.0
        except:
            roc_auc = 0.0
        
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel() if len(np.unique(y_true)) > 1 else (0, 0, 0, 0)
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        
        return {
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "precision": round(precision, 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "specificity": round(specificity, 4),
            "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "roc_auc": round(roc_auc, 4),
        }

    def _log_metrics(self, title: str, metrics: dict):
        """Log detailed model metrics."""
        print(f"\n=== {title} ===")
        print(f"  Accuracy:   {metrics.get('accuracy', 0):.4f}")
        print(f"  Precision:  {metrics.get('precision', 0):.4f}")
        print(f"  Recall:     {metrics.get('recall', 0):.4f}")
        print(f"  Specificity: {metrics.get('specificity', 0):.4f}")
        print(f"  F1-Score:   {metrics.get('f1', 0):.4f}")
        print(f"  ROC-AUC:    {metrics.get('roc_auc', 0):.4f}")
    
    def _log_class_distribution(self, y: pd.Series, title: str = "Class Distribution"):
        """Log class distribution statistics."""
        value_counts = y.value_counts()
        total = len(y)
        print(f"\n=== {title} ===")
        for label in sorted(value_counts.index):
            count = value_counts[label]
            pct = 100.0 * count / total
            label_name = "At-Risk" if label == 1 else "Present"
            print(f"  {label_name}: {count} ({pct:.1f}%)")
        if len(value_counts) == 2:
            imbalance = max(value_counts) / min(value_counts)
            print(f"  Imbalance Ratio: {imbalance:.2f}:1")
    
    def _log_feature_analysis(self, X: pd.DataFrame, importances_rf: list):
        """Log feature importance and suggestions."""
        print(f"\n=== FEATURE IMPORTANCE ANALYSIS ===")
        print(f"Total Features: {len(X.columns)}")
        
        if importances_rf:
            print(f"\nRandom Forest - Top 5 Features:")
            for i, feat in enumerate(importances_rf[:5], 1):
                print(f"  {i}. {feat['feature']}: {feat['importance']:.2f}%")
            
            weak_features = [f for f in importances_rf if f['importance'] < 0.5]
            if weak_features:
                print(f"\nWeak Features (< 0.5% importance): {len(weak_features)}")
                for feat in weak_features:
                    print(f"  - {feat['feature']}: {feat['importance']:.2f}%")
        
    
    def _validate_realism(self, predictions: list[dict]) -> dict:
        """Validate that predictions are realistic (not all 0 or 1)."""
        pred_values = [p.get('prediction', 0) for p in predictions]
        pred_dist = pd.Series(pred_values).value_counts()
        
        total = len(predictions)
        preds_0 = sum(1 for p in predictions if p.get('prediction') == 0)
        preds_1 = sum(1 for p in predictions if p.get('prediction') == 1)
        excluded = sum(1 for p in predictions if p.get('excluded', False))
        
        pct_0 = 100.0 * preds_0 / total if total > 0 else 0
        pct_1 = 100.0 * preds_1 / total if total > 0 else 0
        pct_excluded = 100.0 * excluded / total if total > 0 else 0
        
        realism_status = "BALANCED"
        if pct_0 > 95 or pct_1 > 95:
            realism_status = "BIASED (>95% same class)"
        elif pct_0 > 85 or pct_1 > 85:
            realism_status = "UNBALANCED (>85% same class)"
        
        return {
            "total": total,
            "present": preds_0,
            "at_risk": preds_1,
            "excluded": excluded,
            "pct_present": round(pct_0, 1),
            "pct_at_risk": round(pct_1, 1),
            "pct_excluded": round(pct_excluded, 1),
            "status": realism_status,
        }

    def _smooth_probability(self, probability: float) -> float:
        """Clamp simple sans distorsion."""
        return float(np.clip(probability, 0.01, 0.99))

    def train(self, employes: list[dict]) -> dict:
        """
        Train models with improved hyperparameters and cross-validation.
        Handles class imbalance automatically.
        """
        if len(employes) < 10:
            return {"status": "skipped", "reason": "Not enough data (< 10 employees)"}

        X = self.prepare_features(employes)
        y = self.label_data(X)

        if y.nunique() < 2:
            return {"status": "skipped", "reason": "Only one class in labels"}

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # Scale features for logistic regression
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # ========== RANDOM FOREST ==========
        self.rf_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=5,
            class_weight="balanced",
            random_state=42,
        )
        self.rf_model.fit(X_train, y_train)

        self.logreg_model = None
        self.logreg_metrics = {}

        # ========== PREDICTIONS AND METRICS ==========
        rf_pred = self.rf_model.predict(X_test)
        rf_proba = self.rf_model.predict_proba(X_test)

        self.rf_metrics = self._build_metrics(y_test, rf_pred, rf_proba)

        # ========== CROSS-VALIDATION ==========
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        rf_cv = cross_val_score(self.rf_model, X_train, y_train, cv=cv, scoring="f1")

        # ========== DETAILED LOGGING ==========
        self._log_class_distribution(y, "TRAINING SET CLASS DISTRIBUTION")
        
        print(f"\n=== CROSS-VALIDATION SCORES (5-Fold) ===")
        print(f"  RF F1:     {rf_cv.mean():.4f} (+/-{rf_cv.std():.4f})")
        
        # ========== FEATURE IMPORTANCE ==========
        importances_rf = self.feature_importance("rf")
        self._log_feature_analysis(X, importances_rf)

        self.trained = True
        self.accuracy = round(self.rf_metrics.get("accuracy", 0) * 100, 1)

        os.makedirs("models", exist_ok=True)
        joblib.dump(
            {
                "rf_model": self.rf_model,
                "scaler": self.scaler,
                "rf_metrics": self.rf_metrics,
            },
            MODEL_PATH,
        )

        trained_models = ["random_forest"]

        return {
            "status": "trained",
            "default_model": "random_forest",
            "trained_models": trained_models,
            "random_forest": self.rf_metrics,
            "nb_employes": len(employes),
            "nb_at_risk": int(y.sum()),
            "pct_at_risk": round(100.0 * y.sum() / len(y), 1) if len(y) > 0 else 0,
            "features": FEATURES,
            "feature_count": len(FEATURES),
            "feature_importance_rf": importances_rf,
            "training_data_quality": {
                "total_records": len(employes),
                "class_0_count": int((y == 0).sum()),
                "class_1_count": int((y == 1).sum()),
                "class_imbalance_ratio": round(max(int((y == 0).sum()), 1) / max(int((y == 1).sum()), 1), 2),
            },
        }

    def load(self) -> bool:
        """ Load previously saved models from disk. """
        if os.path.exists(MODEL_PATH):
            try:
                saved = joblib.load(MODEL_PATH)
                if isinstance(saved, dict):
                    self.rf_model = saved.get("rf_model")
                    self.scaler = saved.get("scaler", StandardScaler())
                    self.rf_metrics = saved.get("rf_metrics", {})
                    self.trained = self.rf_model is not None
                    self.accuracy = round(self.rf_metrics.get("accuracy", 0) * 100, 1)
                else:
                    self.rf_model = saved
                    self.trained = True
                return True
            except Exception:
                return False
        return False

    def _format_confidence(self, probability: float) -> str:
        """
        Seuils standards et fixes :
        - Faible  : prob < 0.40
        - Moyen   : 0.40 <= prob < 0.70
        - Élevé   : prob >= 0.70
        Aucun ajustement dynamique.
        """
        if probability >= 0.70:
            return "elevee"
        if probability >= 0.40:
            return "moyenne"
        return "faible"

    # Méthode _apply_probability_amplification supprimée.
    # Le modèle utilise directement les probabilités brutes de predict_proba.
    # Aucune amplification, aucun bruit, aucun ajustement artificiel.

    def predict_batch(self, employes: list[dict], model_choice: str = "rf", excluded_emp_ids: set = None) -> list[dict]:
        """
        Prédit le risque d'absentéisme pour une liste d'employés.
        Utilise uniquement Random Forest et convertit en décision simple.
        1 = ABSENCE, 0 = RETARD.
        """
        if excluded_emp_ids is None:
            excluded_emp_ids = set()

        if not self.trained or self.rf_model is None:
            return [
                {
                    **e,
                    "decision": "NORMAL",
                    "excluded": e.get("employe_id") in excluded_emp_ids,
                }
                for e in employes
            ]

        X = self.prepare_features(employes)
        
        rf_preds = self.rf_model.predict(X)

        import datetime
        is_sunday = datetime.datetime.today().weekday() == 6
        
        results = []
        for i, emp in enumerate(employes):
            emp_id = emp.get("employe_id")
            is_excluded = emp_id in excluded_emp_ids

            decision = "NORMAL"
            if not is_sunday and not is_excluded:
                pred = int(rf_preds[i])
                if pred == 1:
                    decision = "ABSENCE"
                elif pred == 0:
                    decision = "RETARD"

            results.append({
                **emp,
                "decision": decision,
                "excluded": is_excluded,
            })
        
        # Log de distribution — observation uniquement, pas d'ajustement forcé
        realism_check = self._validate_realism(results)
        print("\n=== PREDICTION DISTRIBUTION ===")
        print(f"  Faible   : {realism_check['present']} ({realism_check['pct_present']:.1f}%) - Target: 60-70%")
        print(f"  Moyen+Eleve: {realism_check['at_risk']} ({realism_check['pct_at_risk']:.1f}%) - Target: 30-40%")
        print(f"  Exclus   : {realism_check['excluded']} ({realism_check['pct_excluded']:.1f}%)")
        print(f"  Status   : {realism_check['status']}")
        
        return results

    def feature_importance(self, model: str = "rf") -> list[dict]:
        if model != "rf":
            return []
        estimator = self.rf_model

        if not self.trained or estimator is None:
            return []

        if hasattr(estimator, "base_estimator_"):
            estimator = getattr(estimator, "base_estimator_", estimator)

        importances = getattr(estimator, "feature_importances_", None)
        if importances is None:
            return []

        return sorted(
            [{"feature": f, "importance": round(float(v) * 100, 1)}
             for f, v in zip(FEATURES, importances)],
            key=lambda x: x["importance"], reverse=True
        )


# Singleton — loaded once at startup
absenteisme_model = AbsenteismeModel()
absenteisme_model.load()  # attempt to load from disk on import
