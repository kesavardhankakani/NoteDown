# NoteDown AI — Groq setup

NoteDown keeps the Groq API key on the Flask backend. Never put the key in the React frontend.

## backend/.env

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/notedown
JWT_SECRET_KEY=change-this-secret
AI_API_KEY=YOUR_GROQ_API_KEY
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-120b
TIMETABLE_VISION_MODEL=qwen/qwen3.8-27b
AI_TIMEOUT_SECONDS=90
```

## AI capabilities

- Academic Q&A and step-by-step tutoring
- Uploaded PDF/notes context
- Multi-turn conversations
- Summaries, comparisons and problem solving
- Quiz/viva generation
- Syllabus + paper-pattern question-paper analysis
- Timetable image OCR and review/import
- Attendance and timetable-aware bunk planning

The browser calls Flask routes only; Flask calls Groq.
