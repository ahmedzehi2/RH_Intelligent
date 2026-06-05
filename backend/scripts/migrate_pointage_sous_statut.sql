-- Migration SQL for new Pointage schema: add sous_statut and normalize existing pointage rows

ALTER TABLE dbo.Pointage
ADD sous_statut NVARCHAR(50) NULL;

UPDATE dbo.Pointage
SET sous_statut = CASE
    WHEN UPPER(statut) IN ('A_L_HEURE', 'A L HEURE', 'RETARD') THEN UPPER(statut)
    ELSE NULL
  END
WHERE statut IS NOT NULL;

UPDATE dbo.Pointage
SET statut = CASE
    WHEN UPPER(statut) IN ('A_L_HEURE', 'RETARD') THEN 'PRESENT'
    ELSE statut
  END
WHERE statut IS NOT NULL;

-- Optional cleanup for absent or unpointed records
UPDATE dbo.Pointage
SET sous_statut = NULL
WHERE UPPER(statut) = 'ABSENT';

-- Ensure new rows can set a valid `sous_statut` when present
-- Existing business logic should now compute `sous_statut` from heure_entree.
