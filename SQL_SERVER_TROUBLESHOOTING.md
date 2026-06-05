# SQL Server Connection Error - Troubleshooting Guide

## Problem Summary
Your FastAPI application fails to start with this error:
```
pyodbc.OperationalError: ('08001', '[08001] [Microsoft][ODBC Driver 17 for SQL Server]
SQL Server Network Interfaces: Error Locating Server/Instance Specified [xFFFFFFFF]
```

**Root Cause:** SQL Server instance `DESKTOP-MVNE0M6\SQLEXPRESS` is not running or not accessible.

---

## Solution 1: Verify SQL Server is Running (RECOMMENDED)

### Step 1: Check if SQL Server Service Exists and is Running
```powershell
# Open PowerShell as Administrator and run:
Get-Service -Name "MSSQL$SQLEXPRESS"
```

**Expected output:**
```
Status   Name                DisplayName
------   ----                -----------
Running  MSSQL$SQLEXPRESS    SQL Server (SQLEXPRESS)
```

### Step 2: Start the Service if Stopped
```powershell
# If status is "Stopped", start it:
Start-Service -Name "MSSQL$SQLEXPRESS"

# Verify it's running:
Get-Service -Name "MSSQL$SQLEXPRESS"
```

### Step 3: Check SQL Server Browser Service
```powershell
# The SQL Server Browser service must also be running
Get-Service -Name "SQLBrowser"

# If stopped, start it:
Start-Service -Name "SQLBrowser"
```

---

## Solution 2: Enable TCP/IP in SQL Server Configuration

1. **Open SQL Server Configuration Manager**
   - Press `Win + R` and type: `SQLServerManager17.msc`
   - Or find it in Start Menu > SQL Server Configuration Manager

2. **Enable TCP/IP Protocol**
   - Navigate: `SQL Server Network Configuration > Protocols for SQLEXPRESS`
   - Right-click **TCP/IP** → **Enable**
   - Right-click **TCP/IP** → **Properties**
   - Go to **IP Addresses** tab
   - Find the section with `IPAddress=127.0.0.1` and ensure it's set to `1433`
   - Click OK

3. **Restart the SQL Server Service**
   ```powershell
   Restart-Service -Name "MSSQL$SQLEXPRESS" -Force
   ```

---

## Solution 3: Verify Connection with sqlcmd (Command Line)

Test connectivity directly:
```cmd
sqlcmd -S DESKTOP-MVNE0M6\SQLEXPRESS -E -q "SELECT @@VERSION"
```

- `-S`: Server name
- `-E`: Use Windows authentication (Trusted_Connection)
- `-q`: Execute query

**Expected:** SQL Server version information

---

## Solution 4: Fix Encoding Issue in Database Connection

Even if SQL Server starts, there's another issue: **encoding configuration**. The commented-out encoding in `backend/db.py` may cause problems.

**Update `backend/db.py`:**
```python
import pyodbc
from backend import config
from contextlib import contextmanager

class Database:
    def __init__(self):
        # Use the simple connection string first
        conn_string = (
            f"DRIVER={{{config.DB_DRIVER}}};"
            f"SERVER={config.DB_SERVER};"
            f"DATABASE={config.DB_DATABASE};"
            "Trusted_Connection=yes;"
            "Mars_Connection=yes;"
        )
        
        try:
            self.conn = pyodbc.connect(conn_string, autocommit=True)
            # pyodbc automatically handles UTF-16 for SQL_WCHAR
            # Don't manually decode - let the driver handle it
        except Exception as e:
            print(f"Database connection error: {e}")
            print(f"Connection string: {conn_string}")
            raise

    @contextmanager
    def get_cursor(self):
        cursor = self.conn.cursor()
        try:
            yield cursor
        finally:
            cursor.close()
```

---

## Solution 5: Temporary Mock Database (For Development Only)

If you need to run the application immediately while fixing SQL Server:

**Create `backend/db_mock.py`:**
```python
# Temporary mock for development - DO NOT USE IN PRODUCTION
class Database:
    def __init__(self):
        self.conn = None
        print("⚠️  WARNING: Using mock database - NO DATA PERSISTENCE")
    
    @property
    def get_cursor(self):
        # Return a mock cursor that does nothing
        class MockCursor:
            def execute(self, *args, **kwargs):
                pass
            def fetchone(self):
                return (None,)
            def fetchall(self):
                return []
            def close(self):
                pass
        return MockCursor()
```

Then temporarily change `api/main.py` to use the mock:
```python
# Temporary - for testing without database
# from backend.db_mock import Database
```

**This is NOT a real solution - only for development/testing**

---

## Solution 6: Check Database and User Permissions

Ensure the database exists and your Windows user has permissions:

```sql
-- Run in SQL Server Management Studio as Administrator:
SELECT name FROM sys.databases WHERE name = 'GestionRH_Intelligente';

-- If not found, create it:
CREATE DATABASE GestionRH_Intelligente;
GO
```

---

## Diagnostic Commands to Run

```powershell
# 1. List all SQL Server instances
Get-Service | Where-Object {$_.Name -match "SQL"}

# 2. Test TCP port 1433
Test-NetConnection -ComputerName localhost -Port 1433

# 3. Check firewall
netsh advfirewall firewall show rule name="SQL Server"

# 4. View SQL Server error log (if service starts but fails)
Get-Content "C:\Program Files\Microsoft SQL Server\MSSQL15.SQLEXPRESS\MSSQL\Log\ERRORLOG"
```

---

## Quick Checklist

- [ ] SQL Server service (`MSSQL$SQLEXPRESS`) is running
- [ ] SQL Server Browser service is running
- [ ] TCP/IP protocol is enabled in SQL Server Configuration Manager
- [ ] Database `GestionRH_Intelligente` exists
- [ ] Windows user has database permissions
- [ ] Port 1433 is not blocked by firewall
- [ ] Instance name `DESKTOP-MVNE0M6\SQLEXPRESS` is correct
- [ ] No encoding issues in connection string

---

## If Still Not Working

**Reinstall SQL Server:**

1. Go to Control Panel > Programs > Uninstall a program
2. Find `Microsoft SQL Server 2019/2022` and click **Uninstall**
3. Download fresh from: https://www.microsoft.com/sql-server/sql-server-downloads
4. Install **SQL Server Express** (free edition)
5. During installation, select "SQLEXPRESS" as instance name
6. Enable SQL Server Browser in features

---

## Next Steps

1. **Immediately:** Run `sc query "MSSQL$SQLEXPRESS"` to check if service exists
2. **If not found:** Install SQL Server Express
3. **If stopped:** Start the service with `Start-Service -Name "MSSQL$SQLEXPRESS"`
4. **Then:** Test connection with diagnostic Python script again
5. **Finally:** Restart the FastAPI application

Let me know which step fails and I can provide more specific guidance!
