import json
from typing import Dict, List, Optional

from backend.db import Database


def _serialize_programme(programme: list | None) -> str | None:
    if not programme:
        return None
    return json.dumps(programme, ensure_ascii=False)


def _deserialize_programme(raw: str | None) -> list | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


class FormationRepository:
    def __init__(self):
        self.db = Database()
        # Schema creation is deferred until the first repository operation.
        # This avoids connecting to SQL Server during FastAPI import.

    def ensure_schema(self) -> None:
        self.db.execute(
            """
            IF OBJECT_ID('dbo.Formation', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Formation (
                    formation_id INT IDENTITY(1,1) PRIMARY KEY,
                    titre NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX) NULL,
                    date_debut DATE NOT NULL,
                    date_fin DATE NULL,
                    duree INT NULL,
                    nombre_places INT NULL,
                    organisateur NVARCHAR(255) NULL,
                    type_formation NVARCHAR(150) NULL,
                    lieu NVARCHAR(255) NULL,
                    date_creation DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                    date_modification DATETIME2 NULL
                );
            END;

            IF COL_LENGTH('dbo.Formation', 'description') IS NULL
                ALTER TABLE dbo.Formation ADD description NVARCHAR(MAX) NULL;

            IF COL_LENGTH('dbo.Formation', 'duree') IS NULL
                ALTER TABLE dbo.Formation ADD duree INT NULL;

            IF COL_LENGTH('dbo.Formation', 'nombre_places') IS NULL
                ALTER TABLE dbo.Formation ADD nombre_places INT NULL;

            IF COL_LENGTH('dbo.Formation', 'lieu') IS NULL
                ALTER TABLE dbo.Formation ADD lieu NVARCHAR(255) NULL;

            IF COL_LENGTH('dbo.Formation', 'date_creation') IS NULL
                ALTER TABLE dbo.Formation ADD date_creation DATETIME2 NOT NULL DEFAULT SYSDATETIME();

            IF COL_LENGTH('dbo.Formation', 'date_modification') IS NULL
                ALTER TABLE dbo.Formation ADD date_modification DATETIME2 NULL;

            IF OBJECT_ID('dbo.Inscription', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Inscription (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    employeeId INT NOT NULL,
                    formationId INT NOT NULL,
                    dateInscription DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                    CONSTRAINT UQ_Inscription_Employee_Formation UNIQUE (employeeId, formationId),
                    CONSTRAINT FK_Inscription_Employe
                        FOREIGN KEY (employeeId) REFERENCES dbo.Employe(employe_id) ON DELETE CASCADE,
                    CONSTRAINT FK_Inscription_Formation
                        FOREIGN KEY (formationId) REFERENCES dbo.Formation(formation_id) ON DELETE CASCADE
                );
            END;
            """
        )
        def _add_column_if_missing(cursor, table: str, column: str, definition: str):
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = ? AND COLUMN_NAME = ?
            """, (table, column))
            if cursor.fetchone()[0] == 0:
                cursor.execute(f"ALTER TABLE {table} ADD {column} {definition}")

        with self.db.get_cursor() as cursor:
            _add_column_if_missing(cursor, "Formation", "heure_debut", "VARCHAR(5) NULL")
            _add_column_if_missing(cursor, "Formation", "heure_fin", "VARCHAR(5) NULL")
            _add_column_if_missing(cursor, "Formation", "programme_details", "NVARCHAR(MAX) NULL")

    def get_all(self) -> List[Dict]:
        sql = """
        SELECT
            f.formation_id,
            f.titre,
            f.description,
            CONVERT(VARCHAR(10), f.date_debut, 23) AS date_debut,
            CONVERT(VARCHAR(10), f.date_fin, 23) AS date_fin,
            f.duree,
            f.nombre_places,
            f.organisateur,
            f.type_formation,
            f.lieu,
            f.heure_debut,
            f.heure_fin,
            f.programme_details,
            ISNULL(i.nb_inscrits, 0) AS nb_inscrits,
            CASE
                WHEN f.nombre_places IS NULL THEN NULL
                ELSE f.nombre_places - ISNULL(i.nb_inscrits, 0)
            END AS places_restantes
        FROM dbo.Formation f
        OUTER APPLY (
            SELECT COUNT(*) AS nb_inscrits
            FROM dbo.Inscription ins
            WHERE ins.formationId = f.formation_id
        ) i
        ORDER BY f.date_debut DESC, f.formation_id DESC;
        """
        rows = self.db.fetch_all(sql)
        for row in rows:
            row["programme_details"] = _deserialize_programme(row.get("programme_details"))
        return rows

    def get_by_id(self, formation_id: int) -> Optional[Dict]:
        sql = """
        SELECT
            f.formation_id,
            f.titre,
            f.description,
            CONVERT(VARCHAR(10), f.date_debut, 23) AS date_debut,
            CONVERT(VARCHAR(10), f.date_fin, 23) AS date_fin,
            f.duree,
            f.nombre_places,
            f.organisateur,
            f.type_formation,
            f.lieu,
            f.heure_debut,
            f.heure_fin,
            f.programme_details,
            ISNULL(i.nb_inscrits, 0) AS nb_inscrits,
            CASE
                WHEN f.nombre_places IS NULL THEN NULL
                ELSE f.nombre_places - ISNULL(i.nb_inscrits, 0)
            END AS places_restantes
        FROM dbo.Formation f
        OUTER APPLY (
            SELECT COUNT(*) AS nb_inscrits
            FROM dbo.Inscription ins
            WHERE ins.formationId = f.formation_id
        ) i
        WHERE f.formation_id = ?;
        """
        row = self.db.fetch_one(sql, [formation_id])
        if row:
            row["programme_details"] = _deserialize_programme(row.get("programme_details"))
        return row

    def find_duplicate(self, titre: str, date_debut: str, exclude_id: int | None = None) -> Optional[Dict]:
        sql = """
        SELECT TOP 1 formation_id
        FROM dbo.Formation
        WHERE titre = ? AND CAST(date_debut AS DATE) = CAST(? AS DATE)
        """
        params: List[object] = [titre, date_debut]
        if exclude_id is not None:
            sql += " AND formation_id <> ?"
            params.append(exclude_id)
        sql += " ORDER BY formation_id DESC;"
        return self.db.fetch_one(sql, params)

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.Formation
        (titre, description, date_debut, date_fin, duree, nombre_places, organisateur, type_formation, lieu, heure_debut, heure_fin, programme_details)
        VALUES (?, ?, CAST(? AS DATE), CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?);
        """
        return self.db.execute_and_identity(
            sql,
            [
                data.get("titre"),
                data.get("description"),
                data.get("date_debut"),
                data.get("date_fin"),
                data.get("duree"),
                data.get("nombre_places"),
                data.get("organisateur"),
                data.get("type_formation"),
                data.get("lieu"),
                data.get("heure_debut"),
                data.get("heure_fin"),
                _serialize_programme(data.get("programme_details")),
            ],
        )

    def update(self, formation_id: int, data: Dict) -> bool:
        sql = """
        UPDATE dbo.Formation
        SET
            titre = ?,
            description = ?,
            date_debut = CAST(? AS DATE),
            date_fin = CAST(? AS DATE),
            duree = ?,
            nombre_places = ?,
            organisateur = ?,
            type_formation = ?,
            lieu = ?,
            heure_debut = ?,
            heure_fin = ?,
            programme_details = ?,
            date_modification = SYSDATETIME()
        WHERE formation_id = ?;
        """
        return self.db.execute(
            sql,
            [
                data.get("titre"),
                data.get("description"),
                data.get("date_debut"),
                data.get("date_fin"),
                data.get("duree"),
                data.get("nombre_places"),
                data.get("organisateur"),
                data.get("type_formation"),
                data.get("lieu"),
                data.get("heure_debut"),
                data.get("heure_fin"),
                _serialize_programme(data.get("programme_details")),
                formation_id,
            ],
        )

    def delete(self, formation_id: int) -> bool:
        sql = "DELETE FROM dbo.Formation WHERE formation_id = ?;"
        return self.db.execute(sql, [formation_id])

    def count_inscriptions(self, formation_id: int) -> int:
        sql = "SELECT COUNT(*) AS total FROM dbo.Inscription WHERE formationId = ?;"
        row = self.db.fetch_one(sql, [formation_id])
        return int(row["total"]) if row and row.get("total") is not None else 0

    def inscription_exists(self, employee_id: int, formation_id: int) -> bool:
        sql = """
        SELECT TOP 1 id
        FROM dbo.Inscription
        WHERE employeeId = ? AND formationId = ?;
        """
        return self.db.fetch_one(sql, [employee_id, formation_id]) is not None

    def create_inscription(self, employee_id: int, formation_id: int) -> int:
        sql = """
        INSERT INTO dbo.Inscription (employeeId, formationId)
        VALUES (?, ?);
        """
        return self.db.execute_and_identity(sql, [employee_id, formation_id])

    def delete_inscription(self, employee_id: int, formation_id: int) -> bool:
        sql = """
        DELETE FROM dbo.Inscription
        WHERE employeeId = ? AND formationId = ?;
        """
        return self.db.execute(sql, [employee_id, formation_id])

    def get_participants(self, formation_id: int) -> List[Dict]:
        sql = """
        SELECT
            e.employe_id,
            e.nom,
            e.prenom,
            e.poste,
            e.matricule,
            CONVERT(VARCHAR(19), i.dateInscription, 120) AS date_inscription
        FROM dbo.Inscription i
        INNER JOIN dbo.Employe e ON e.employe_id = i.employeeId
        WHERE i.formationId = ?
        ORDER BY i.dateInscription DESC, e.nom, e.prenom;
        """
        return self.db.fetch_all(sql, [formation_id])

    def get_by_employe(self, employee_id: int) -> List[Dict]:
        sql = """
        SELECT
            f.formation_id,
            f.titre,
            f.description,
            CONVERT(VARCHAR(10), f.date_debut, 23) AS date_debut,
            CONVERT(VARCHAR(10), f.date_fin, 23) AS date_fin,
            f.duree,
            f.nombre_places,
            f.organisateur,
            f.type_formation,
            f.lieu,
            CONVERT(VARCHAR(19), i.dateInscription, 120) AS date_inscription
        FROM dbo.Inscription i
        INNER JOIN dbo.Formation f ON f.formation_id = i.formationId
        WHERE i.employeeId = ?
        ORDER BY f.date_debut DESC, f.formation_id DESC;
        """
        return self.db.fetch_all(sql, [employee_id])
