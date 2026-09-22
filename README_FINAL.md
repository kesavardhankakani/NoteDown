# NoteDown Final

A production-oriented NoteDown build for students: subjects, semester/unit notes, search, PDF downloads, attendance, file-grounded AI notes, practice-question extraction, and an admin dashboard.

## What was fixed in this final build
- Clean responsive home-page alignment with a two-column hero and consistent spacing.
- Desktop logout and mobile logout.
- Fixed mobile bottom navigation: Home, Subjects, Resources, Attendance + More (History, AI Notes, Question Papers, Admin, Logout).
- Admin role badge (`Admin`) and visible **Admin Dashboard** navigation when the logged-in account has `role=admin`.
- Admin dashboard registration in Flask (`/api/admin/dashboard`) and management of departments, subjects and unit-wise PDFs.
- Department → Year → Semester → Subject → Unit 1..6 flow.
- Separate Year/Semester records per department; Semester 1 and Semester 2 are independent subject records.
- Search across resource title, description, filename, subject name and subject code, plus department/year/semester/unit filters.
- PDF downloads with download history.
- Attendance with Present/Absent, date, percentage, **Manual** mode, and **Use location** mode using device geolocation.
- Attendance stores location mode and optional latitude/longitude/accuracy.
- AI Notes searches the text extracted from stored PDFs and returns relevant explanatory passages and source titles.
- Question Paper Lab extracts question-like prompts from stored PDFs for practice; these are explicitly not guaranteed exam predictions.
- Additive database migration for `resources.unit_number` and attendance location columns.
- Vite pinned to the compatible 7.x line (`^7.3.6`) so it works with the supplied React plugin.

## Admin account
A normal registration creates a student account. To create/promote an administrator:

```powershell
cd backend
.\venv\Scripts\python.exe create_admin.py
```

Enter the email already used by the account if you want to promote that account. On the next login, the JWT contains `role=admin` and the Admin badge/dashboard appears.

## Local build
Frontend:

```powershell
cd frontend
npm install
npm run build
npm run dev
```

Backend:

```powershell
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe app.py
```

If PowerShell blocks `Activate.ps1`, use the direct `venv\\Scripts\\python.exe` commands above; activation is not required.

## Environment
Frontend `.env`:

```env
VITE_API_URL=https://notedown-api-2026.onrender.com
```

Production example:

```env
VITE_API_URL=https://YOUR-NOTEDOWN-BACKEND.onrender.com
```

Backend `.env`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=change-this-to-a-long-random-secret
MAX_CONTENT_LENGTH=52428800
```

Do not commit `.env` or passwords.

## Attendance location
Select **Attendance → Use location → Fetch location**. The browser/device will ask for location permission. Location mode saves the coordinates returned by the device along with the attendance record.

For an Android production WebView, the existing Capacitor Android project must have location permission enabled and the deployed site/API should be served over HTTPS. The supplied source archive did not contain the existing Android Studio project, so Android native files cannot be safely overwritten from this ZIP.

## AI Notes
The default implementation is file-grounded and requires no external AI key: it extracts text from PDFs with `pypdf`, ranks matching passages, and formats them into a study explanation. This guarantees that the fallback only uses files stored in NoteDown.

If a future deployment adds an LLM provider, send only retrieved PDF context to that provider and keep the local retrieval fallback enabled.

## Production storage
Render's normal service filesystem is not a permanent document store. For uploaded notes to survive redeploys/restarts, configure a Render Persistent Disk or external object storage and point `UPLOAD_FOLDER` to that persistent location.

## Existing data
The ZIP preserves the PDFs that were present in the supplied project. It does not fabricate university notes or question papers. Use Admin → Unit Notes to upload the actual remaining semester/unit/question-paper PDFs.

## Attendance Dashboard — Final
The Attendance section is now a four-part dashboard:

1. **Overview** — overall percentage, present/absent/conducted counts, today's timetable classes, subject-wise progress bars, target percentage, and recent records.
2. **Timetable** — add/edit/delete Monday–Sunday classes with subject, time, room, Manual/Automatic mode, classroom latitude/longitude and radius.
3. **Mark Attendance** — manual Present/Absent plus location-assisted marking. Automatic classes check the student's current location against the saved classroom radius and only mark Present when the configured class time/day is active. Manual fallback remains available.
4. **Bunk Planner** — what-if calculator, maximum safe bunks for a chosen target percentage, and required consecutive classes to reach the target.

### Location note
Web browsers/Android WebView do not guarantee background geofencing. NoteDown therefore performs a foreground GPS check when the student taps **Check & Mark Present**. This avoids falsely claiming background attendance while still providing classroom-radius automation.

### Existing database migration
On startup, NoteDown creates the new `timetables` and `attendance_settings` tables and adds the new attendance fields (`timetable_id`, `method`, `marked_at`) to an existing `attendance` table when needed. Keep a PostgreSQL backup before production migration.

### Local test order
```powershell
cd frontend
npm install
npm run build

cd ..\backend
.\venv\Scripts\python.exe app.py
```
Then test `/api/health`, login, Attendance → Timetable, Mark Attendance, and Bunk Planner.
