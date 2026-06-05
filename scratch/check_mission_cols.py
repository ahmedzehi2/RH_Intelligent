import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

conn_str = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER=DESKTOP-MVNE0M6\\SQLEXPRESS;"
    f"DATABASE=GestionRH_Intelligente;"
    "Trusted_Connection=yes;"
)

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Mission'")
    cols = cursor.fetchall()
    print("Columns in Mission:")
    for col in cols:
        print(f"- {col[0]}")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
