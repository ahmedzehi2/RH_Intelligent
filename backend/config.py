import os

DB_SERVER = os.getenv("DB_SERVER", r"DESKTOP-MVNE0M6\SQLEXPRESS")
DB_DATABASE = os.getenv("DB_DATABASE", "GestionRH_Intelligente")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
DB_USE_TRUSTED_CONNECTION = os.getenv("DB_USE_TRUSTED_CONNECTION", "true").lower() in ("1", "true", "yes", "y")
DB_UID = os.getenv("DB_UID", "")
DB_PWD = os.getenv("DB_PWD", "")