#!/usr/bin/env python3
"""
Simple SQL Server service status checker for Windows
"""
import os
import subprocess
import sys

print("\n" + "="*70)
print("SQL SERVER SERVICE DIAGNOSTIC")
print("="*70)

# Check if MSSQL$SQLEXPRESS service exists
print("\n[1] Checking if MSSQL$SQLEXPRESS service exists...")
try:
    result = subprocess.run(
        ['sc', 'query', 'MSSQL$SQLEXPRESS'],
        capture_output=True,
        text=True,
        timeout=5
    )
    
    if result.returncode == 0:
        print("  ✓ Service found!")
        print(result.stdout)
        
        # Check status
        if 'RUNNING' in result.stdout:
            print("  ✓ Status: RUNNING")
        elif 'STOPPED' in result.stdout:
            print("  ✗ Status: STOPPED")
            print("\n  💡 To start the service, run as Administrator:")
            print("     powershell -Command \"Start-Service -Name 'MSSQL$SQLEXPRESS'\"")
        else:
            print("  ⚠️  Status: UNKNOWN")
    else:
        print("  ✗ Service NOT FOUND!")
        print(f"  Error output:\n{result.stderr}")
        print("\n  💡 SQL Server may not be installed.")
        print("  Download and install from: https://www.microsoft.com/sql-server/sql-server-downloads")
        
except subprocess.TimeoutExpired:
    print("  ⚠️  Service query timed out")
except Exception as e:
    print(f"  ✗ Error: {e}")

# Check SQL Server Browser service
print("\n[2] Checking SQL Server Browser service...")
try:
    result = subprocess.run(
        ['sc', 'query', 'SQLBrowser'],
        capture_output=True,
        text=True,
        timeout=5
    )
    
    if result.returncode == 0 and 'RUNNING' in result.stdout:
        print("  ✓ SQL Server Browser: RUNNING")
    elif result.returncode == 0 and 'STOPPED' in result.stdout:
        print("  ✗ SQL Server Browser: STOPPED (should be running)")
    else:
        print("  ⚠️  SQL Server Browser: NOT FOUND or STATUS UNKNOWN")
        
except Exception as e:
    print(f"  ✗ Error: {e}")

# Test network connectivity
print("\n[3] Testing local TCP connection to port 1433...")
try:
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(3)
    result = sock.connect_ex(('127.0.0.1', 1433))
    sock.close()
    
    if result == 0:
        print("  ✓ TCP port 1433 is accessible")
    else:
        print("  ✗ Cannot connect to port 1433")
        print("  - SQL Server may not be listening")
        print("  - Check SQL Server Configuration Manager > TCP/IP > Properties")
        
except Exception as e:
    print(f"  ✗ Error: {e}")

print("\n" + "="*70 + "\n")
