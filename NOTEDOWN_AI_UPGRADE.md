# NoteDown AI upgrade

This build keeps the existing NoteDown Flask + PostgreSQL + React app and adds the unified Groq AI layer.

## AI

Backend AI calls use Groq through OpenAI-compatible Chat Completions.

- Text/reasoning: `openai/gpt-oss-120b`
- Timetable vision/OCR: `qwen/qwen3.8-27b`
- API key stays in `backend/.env`

Supported study workflows already connected to the existing UI:
- academic Q&A
- step-by-step explanations
- uploaded PDF/notes context
- multi-turn chat
- summaries/comparisons/problem solving/quiz/viva prompts
- syllabus + paper-pattern question analysis

## Timetable

`POST /api/timetable/scan` accepts JPG/PNG/WEBP images and returns structured timetable JSON for review.

`POST /api/timetable/import` validates reviewed entries against the existing Subject table and imports matched classes.

Timetable records now also store `faculty`, `class_type`, and `label`. Existing databases are migrated automatically by `backend/app.py`.

## Attendance / Bunk Planner

`POST /api/attendance/bunk-plan` accepts selected dates, optional subject IDs and a target percentage. It uses real timetable rows and existing attendance records, ignores already-marked classes, and returns projected overall and subject-level impact, safe bunks, recovery classes, warnings and the exact selected classes.

The React UI now includes:
- AI timetable image scanner with review/edit/import
- multi-date planner (1/7/14/30-day windows)
- subject filters
- date selection
- projected attendance
- subject impact
- safe bunk count
- recovery count
- timetable-aware selected-class list

## Setup

1. Copy the values from `backend/.env.example` into `backend/.env` and add the new Groq key.
2. Start PostgreSQL and make sure `DATABASE_URL` matches the local database credentials.
3. Start Flask from `backend`.
4. In `frontend`, run `npm install` and then `npm run build`.
5. Start Vite and log in.
6. Open Attendance -> Timetable -> AI Timetable Scanner.

The scanner intentionally requires review before import so OCR mistakes can be corrected without silently changing the user's timetable.
