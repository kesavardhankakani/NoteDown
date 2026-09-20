# NoteDown

Academic notes and resources platform built with React + TypeScript + Vite and Flask + PostgreSQL.

## Features
- Student registration and login with JWT
- Student dashboard
- Department and subject browsing
- PDF resource search
- PDF download with download history
- Favorites
- Admin dashboard
- Create/rename/delete departments
- Create/rename/delete subjects
- Upload/rename/delete PDF notes

## Run backend (Windows)
1. Open PowerShell in `NoteDown\backend`.
2. Activate your virtual environment:
   `..\venv\Scripts\Activate.ps1` (or use the venv already created inside `backend`).
3. Install dependencies:
   `python -m pip install -r requirements.txt`
4. Check `backend\.env` and make sure `DATABASE_URL` contains the correct PostgreSQL password and database name.
5. Create the database `notedown` in PostgreSQL/pgAdmin if it does not exist.
6. Run:
   `python init_db.py`
7. Create/promote an admin:
   `python create_admin.py`
8. Start:
   `python app.py`

Backend health: `http://127.0.0.1:5000/api/health`
Database test: `http://127.0.0.1:5000/api/db-test`

## Run frontend (Windows)
Open a second terminal in `NoteDown\frontend`:

`npm install`

`npm run dev`

Open the URL Vite prints, normally `http://localhost:5173`.

## Build frontend
`npm run build`

The project includes `src/vite-env.d.ts`, so `import.meta.env.VITE_API_URL` is correctly typed. If no `.env` is supplied, the frontend uses `http://127.0.0.1:5000`.

## Important PostgreSQL note
If Flask reports `password authentication failed for user "postgres"`, the application code is running but PostgreSQL rejected the credentials. Update only `backend/.env`:

`DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/notedown`

Then rerun `python init_db.py` and `python app.py`.
