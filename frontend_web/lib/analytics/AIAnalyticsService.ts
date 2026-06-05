// frontend_web/lib/analytics/AIAnalyticsService.ts

import { executeSafeQuery } from "../db/db-client"

export interface AbsenceStats {
  total_absences: number
  unjust_absences: number
}

export interface DelayStats {
  total_delays: number
  avg_delay_minutes: number
}

export interface AttendanceTrend {
  date: string
  presents: number
  absents: number
}

export interface DeptComparison {
  nom_departement: string
  total_records: number
  absences: number
  delays: number
  absence_rate: number
  punctuality_rate: number
}

export interface EmployeeRisk {
  employe_id: number
  nom: string
  prenom: string
  nom_departement: string
  absences: number
  unjustified_absences: number
  retards: number
  risk_score: number
}

export interface AbsencePattern {
  employe_id: number
  nom: string
  prenom: string
  nom_departement: string
  monday_friday_absences: number
}

export class AIAnalyticsService {
  /**
   * absence statistics
   */
  static async getAbsenceStats(): Promise<AbsenceStats> {
    const sql = `
      SELECT COUNT(*) as total_absences,
             SUM(CASE WHEN sous_statut = 'Injustifié' THEN 1 ELSE 0 END) as unjust_absences
      FROM dbo.Pointage
      WHERE date_pointage >= DATEADD(day, -30, GETDATE()) AND statut = 'Absent'
    `
    const rows = await executeSafeQuery(sql)
    return {
      total_absences: rows[0]?.total_absences ?? 0,
      unjust_absences: rows[0]?.unjust_absences ?? 0
    }
  }

  /**
   * delay statistics
   */
  static async getDelayStats(): Promise<DelayStats> {
    const sql = `
      SELECT COUNT(*) as total_delays,
             COALESCE(AVG(retard_minutes), 0) as avg_delay_minutes
      FROM dbo.Pointage
      WHERE date_pointage >= DATEADD(day, -30, GETDATE()) AND retard_minutes > 0
    `
    const rows = await executeSafeQuery(sql)
    return {
      total_delays: rows[0]?.total_delays ?? 0,
      avg_delay_minutes: Math.round(rows[0]?.avg_delay_minutes ?? 0)
    }
  }

  /**
   * attendance trends
   */
  static async getAttendanceTrends(): Promise<AttendanceTrend[]> {
    const sql = `
      SELECT FORMAT(date_pointage, 'yyyy-MM-dd') as date,
             SUM(CASE WHEN statut = 'Present' THEN 1 ELSE 0 END) as presents,
             SUM(CASE WHEN statut = 'Absent' THEN 1 ELSE 0 END) as absents
      FROM dbo.Pointage
      WHERE date_pointage >= DATEADD(day, -30, GETDATE())
      GROUP BY date_pointage
      ORDER BY date_pointage
    `
    return await executeSafeQuery<AttendanceTrend>(sql)
  }

  /**
   * department comparisons
   */
  static async getDepartmentComparisons(): Promise<DeptComparison[]> {
    const sql = `
      SELECT d.nom_departement,
             COUNT(*) as total_records,
             SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
             SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as delays,
             ROUND(CAST(SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100, 1) as absence_rate,
             ROUND(CAST(SUM(CASE WHEN p.statut = 'Present' AND p.retard_minutes = 0 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0) * 100, 1) as punctuality_rate
      FROM dbo.Pointage p
      JOIN dbo.Employe e ON p.employe_id = e.employe_id
      JOIN dbo.Departement d ON e.departement_id = d.departement_id
      WHERE p.date_pointage >= DATEADD(day, -30, GETDATE())
      GROUP BY d.nom_departement
    `
    return await executeSafeQuery<DeptComparison>(sql)
  }

  /**
   * employee risk scoring
   */
  static async getEmployeeRiskScoring(): Promise<EmployeeRisk[]> {
    const sql = `
      SELECT TOP 10 e.employe_id, e.nom, e.prenom, d.nom_departement,
             SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
             SUM(CASE WHEN p.statut = 'Absent' AND p.sous_statut = 'Injustifié' THEN 1 ELSE 0 END) as unjustified_absences,
             SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
             ROUND((SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) * 0.4) +
                   (SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) * 0.3) +
                   ((1 - CAST(SUM(CASE WHEN p.statut = 'Present' AND p.retard_minutes = 0 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0)) * 100 * 0.3), 1) as risk_score
      FROM dbo.Pointage p
      JOIN dbo.Employe e ON p.employe_id = e.employe_id
      JOIN dbo.Departement d ON e.departement_id = d.departement_id
      WHERE p.date_pointage >= DATEADD(day, -30, GETDATE())
      GROUP BY e.employe_id, e.nom, e.prenom, d.nom_departement
      ORDER BY risk_score DESC
    `
    return await executeSafeQuery<EmployeeRisk>(sql)
  }

  /**
   * repeated absence patterns
   */
  static async getRepeatedAbsencePatterns(): Promise<AbsencePattern[]> {
    const sql = `
      SELECT e.employe_id, e.nom, e.prenom, d.nom_departement,
             SUM(CASE WHEN DATEPART(weekday, p.date_pointage) IN (2, 6) AND p.statut = 'Absent' THEN 1 ELSE 0 END) as monday_friday_absences
      FROM dbo.Pointage p
      JOIN dbo.Employe e ON p.employe_id = e.employe_id
      JOIN dbo.Departement d ON e.departement_id = d.departement_id
      WHERE p.date_pointage >= DATEADD(day, -30, GETDATE()) AND p.statut = 'Absent'
      GROUP BY e.employe_id, e.nom, e.prenom, d.nom_departement
      HAVING SUM(CASE WHEN DATEPART(weekday, p.date_pointage) IN (2, 6) AND p.statut = 'Absent' THEN 1 ELSE 0 END) >= 2
    `
    return await executeSafeQuery<AbsencePattern>(sql)
  }

  /**
   * Comprehensive summary method that combines all statistics
   */
  static async getFullAnalyticsSummary() {
    const [absences, delays, depts, risks, patterns] = await Promise.all([
      this.getAbsenceStats(),
      this.getDelayStats(),
      this.getDepartmentComparisons(),
      this.getEmployeeRiskScoring(),
      this.getRepeatedAbsencePatterns()
    ])

    return {
      period: "30 derniers jours",
      global: {
        absences_totales: absences.total_absences,
        absences_injustifiees: absences.unjust_absences,
        retards_totaux: delays.total_delays,
        retard_moyen_minutes: delays.avg_delay_minutes
      },
      departements: depts,
      employes_a_risque: risks,
      comportements_anormaux: patterns
    }
  }
}
