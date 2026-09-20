@echo off
cd /d "%~dp0backend"
if not exist venv\Scripts\python.exe (
  echo Backend virtual environment not found.
  echo Create it with: python -m venv venv
  echo Then run: venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)
venv\Scripts\python.exe init_db.py
if errorlevel 1 (
  echo.
  echo Database initialization failed. Check backend\.env DATABASE_URL and PostgreSQL.
  pause
  exit /b 1
)
venv\Scripts\python.exe app.py
