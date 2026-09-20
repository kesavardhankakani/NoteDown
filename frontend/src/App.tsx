import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen, Download, FileText, Heart, History, Home, LogIn, LogOut, Menu,
  MessageCircle, Search, Trash2, Upload, User, CalendarCheck, Brain, MoreHorizontal,
  X, RefreshCw, ShieldCheck, MapPin, Navigation, ChevronDown, ExternalLink,
  Clock3, CheckCircle2, CircleAlert, Target, TrendingUp, Zap, ListChecks
} from "lucide-react";
import {
  addFavorite, askNotes, clearSession, createDepartment, createSubject, deleteDepartment,
  deleteResource, deleteSubject, downloadResource, getAttendance, getCurrentUser,
  getDepartments, getFavorites, getHistory, getResources, getSubjects, login, markAttendance,
  predictQuestions, register, removeFavorite, renameResource, uploadResource, createTimetable, deleteTimetable,
  autoMarkAttendance, saveAttendanceSettings, updateTimetable
} from "./api";
import type { AttendanceRecord, AttendanceSummary, AttendanceSettings, Department, HistoryItem, Resource, Subject, Timetable, User as ApiUser } from "./api";
import TimetableScanner from "./TimetableScanner";
import BunkPlannerPro from "./BunkPlannerPro";

type Page = "home" | "subjects" | "resources" | "history" | "chat" | "attendance" | "papers" | "admin";
type UserData = ApiUser & { name: string; email: string; role: string };
const normalize = (u: any): UserData => ({ id: u?.id, name: u?.name || u?.username || "Student", username: u?.username, email: u?.email || "", role: u?.role || "student", department_id: u?.department_id });

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [boot, setBoot] = useState(true);
  const [mobileMore, setMobileMore] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem("notedown_token")) setUser(normalize(await getCurrentUser()));
      } catch { clearSession(); }
      finally { setBoot(false); }
    })();
  }, []);
  useEffect(() => { if (user) void refresh(); }, [user]);
  async function refresh() {
    try {
      const [d, s, r] = await Promise.all([getDepartments(), getSubjects(), getResources()]);
      setDepartments(d); setSubjects(s); setResources(r);
    } catch (e) { console.error(e); }
  }
  if (boot) return <div className="center-page">Loading NoteDown…</div>;
  if (!user) return <Auth onLogin={u => setUser(normalize(u))} />;
  const nav = (p: Page) => { setPage(p); setMobileMore(false); document.querySelector(".timetable-editor-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const logout = () => { clearSession(); setUser(null); setPage("home"); };
  return <div className="app">
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => nav("home")} aria-label="NoteDown home">
          <span className="brand-icon"><BookOpen size={20} /></span><span>NoteDown</span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {(["home", "subjects", "resources", "history", "chat"] as Page[]).map(p => <NavButton key={p} page={p} active={page === p} onClick={() => nav(p)} />)}
          <button className={page === "attendance" ? "nav-btn active" : "nav-btn"} onClick={() => nav("attendance")}><CalendarCheck size={17} />Attendance</button>
          {user.role === "admin" && <button className={page === "admin" ? "nav-btn admin-active" : "nav-btn admin-btn"} onClick={() => nav("admin")}><ShieldCheck size={17} />Admin</button>}
        </nav>
        <div className="desktop-user">
          <div className="user-chip"><User size={15} /><span>{user.name}</span>{user.role === "admin" && <span className="admin-badge"><ShieldCheck size={13} /> Admin</span>}</div>
          <button className="logout-btn" onClick={logout}><LogOut size={16} />Logout</button>
        </div>
        <button className="mobile-more-toggle" onClick={() => setMobileMore(v => !v)} aria-label="More menu">{mobileMore ? <X /> : <Menu />}</button>
      </div>
      {mobileMore && <div className="mobile-more-panel">
        <div className="mobile-profile"><User size={17} /><b>{user.name}</b>{user.role === "admin" && <span className="admin-badge"><ShieldCheck size={13} /> Admin</span>}</div>
        {(["history", "chat", "papers"] as Page[]).map(p => <button key={p} onClick={() => nav(p)} className={page === p ? "mobile-more-item active" : "mobile-more-item"}>{pageIcon(p)} {label(p)}</button>)}
        {user.role === "admin" && <button onClick={() => nav("admin")} className={page === "admin" ? "mobile-more-item active" : "mobile-more-item"}><ShieldCheck size={18} />Admin Dashboard</button>}
        <button onClick={logout} className="mobile-more-item danger-item"><LogOut size={18} />Logout</button>
      </div>}
    </header>
    <main className="main">
      {page === "home" && <HomePage user={user} resources={resources} subjects={subjects} nav={nav} />}
      {page === "subjects" && <Subjects departments={departments} subjects={subjects} resources={resources} refresh={refresh} />}
      {page === "resources" && <Resources resources={resources} departments={departments} subjects={subjects} refresh={refresh} />}
      {page === "history" && <HistoryPage />}
      {page === "chat" && <Chat />}
      {page === "attendance" && <Attendance />}
      {page === "papers" && <Papers subjects={subjects} />}
      {page === "admin" && user.role === "admin" && <Admin departments={departments} subjects={subjects} resources={resources} refresh={refresh} />}
    </main>
    <MobileBottomNav page={page} nav={nav} admin={user.role === "admin"} />
  </div>;
}
function NavButton({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  return <button className={active ? "nav-btn active" : "nav-btn"} onClick={onClick}>{pageIcon(page)}{label(page)}</button>;
}
function label(p: Page) { return ({ home: "Home", subjects: "Subjects", resources: "Resources", history: "History", chat: "AI Notes", attendance: "Attendance", papers: "Question Papers", admin: "Admin" })[p]; }
function pageIcon(p: Page) { const C: any = { home: Home, subjects: BookOpen, resources: FileText, history: History, chat: MessageCircle, attendance: CalendarCheck, papers: Brain, admin: ShieldCheck }[p]; return <C size={18} />; }
function MobileBottomNav({ page, nav, admin }: { page: Page; nav: (p: Page) => void; admin: boolean }) {
  return <nav className="bottom-nav" aria-label="Mobile navigation">
    {(["home", "subjects", "resources", "attendance"] as Page[]).map(p => <button key={p} className={page === p ? "bottom-item active" : "bottom-item"} onClick={() => nav(p)}>{pageIcon(p)}<span>{label(p)}</span></button>)}
    <button className={page === "chat" || page === "papers" || page === "history" || page === "admin" ? "bottom-item active" : "bottom-item"} onClick={() => nav("chat")}><MoreHorizontal size={19} /><span>More</span></button>
  </nav>;
}
function Auth({ onLogin }: { onLogin: (u: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login"), [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setError(""); if (!email || password.length < 6 || (mode === "register" && !name)) return setError(mode === "register" ? "Enter name, email and a 6+ character password." : "Enter a valid email and 6+ character password."); setBusy(true); try { const r = mode === "login" ? await login(email, password) : await register(name, email, password); localStorage.setItem("notedown_token", r.token); localStorage.setItem("notedown_user", JSON.stringify(r.user)); onLogin(r.user); } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed"); } finally { setBusy(false); } }
  return <div className="auth-page"><div className="auth-card"><div className="auth-logo"><BookOpen size={25} /></div><span className="eyebrow">ACADEMIC RESOURCE PLATFORM</span><h1>NoteDown</h1><p>Notes, resources, attendance and study tools in one app.</p><form onSubmit={submit}>{mode === "register" && <input autoComplete="name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />}<input autoComplete="email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} /><input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />{error && <div className="error">{error}</div>}<button className="primary full" disabled={busy}><LogIn size={17} />{busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}</button></form><button className="switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "New to NoteDown? Create account" : "Already registered? Login"}</button></div></div>;
}
function HomePage({ user, resources, subjects, nav }: { user: UserData; resources: Resource[]; subjects: Subject[]; nav: (p: Page) => void }) {
  return <>
    <section className="hero">
      <div className="hero-copy"><span className="hero-eyebrow">ACADEMIC RESOURCE PLATFORM</span><h1>Welcome back,<br /><em>{user.name}</em></h1><p>Find semester subjects, unit-wise notes, download PDFs, track attendance and study with AI from the files stored in NoteDown.</p><div className="hero-actions"><button className="hero-primary" onClick={() => nav("subjects")}><BookOpen size={18} />Browse Subjects</button><button className="hero-secondary" onClick={() => nav("chat")}><MessageCircle size={18} />Ask Notes AI</button></div></div>
      <div className="hero-side"><div className="hero-stat"><strong>{subjects.length}</strong><span>Subjects</span></div><div className="hero-stat"><strong>{resources.length}</strong><span>Published notes</span></div><div className="hero-stat"><strong>6</strong><span>Units / subject</span></div></div>
    </section>
    <Section title="Quick access" text="Everything you need, one tap away."><div className="quick-grid">{[["Subjects", "Department → year → semester → units", "subjects", BookOpen], ["Resources", `${resources.length} notes and PDFs`, "resources", FileText], ["Attendance", "Manual or location-assisted", "attendance", CalendarCheck], ["Question Papers", "Practice questions from PDFs", "papers", Brain], ["AI Notes", "Explain from your stored files", "chat", MessageCircle], ["History", "Your downloaded resources", "history", History]].map(([t, d, p, C]: any) => <button className="quick-card" key={p} onClick={() => nav(p)}><span className="quick-icon"><C size={20} /></span><b>{t}</b><span>{d}</span></button>)}</div></Section>
  </>;
}
function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) { return <section className="section"><div className="section-heading"><div><span className="eyebrow">NOTEDOWN</span><h2>{title}</h2></div>{text && <p>{text}</p>}</div>{children}</section>; }
function Subjects({ departments, subjects, resources, refresh }: { departments: Department[]; subjects: Subject[]; resources: Resource[]; refresh: () => Promise<void> }) {
  const [d, setD] = useState(""), [year, setYear] = useState(""), [sem, setSem] = useState(""), [open, setOpen] = useState<number | null>(null);
  const years = useMemo(() => Array.from(new Set(subjects.map(s => s.year))).sort((a, b) => a - b), [subjects]);
  const semesters = useMemo(() => Array.from(new Set(subjects.filter(s => !year || String(s.year) === year).map(s => s.semester))).sort((a, b) => a - b), [subjects, year]);
  const list = useMemo(() => subjects.filter(s => (!d || String(s.department_id) === d) && (!year || String(s.year) === year) && (!sem || String(s.semester) === sem)), [subjects, d, year, sem]);
  return <><PageHead title="Subjects" text="Choose department, year and semester. Open a subject to see all six unit slots and uploaded notes." />
    <div className="filter-panel"><select value={d} onChange={e => { setD(e.target.value); setOpen(null); }}><option value="">All departments</option>{departments.map(x => <option value={x.id} key={x.id}>{x.name} ({x.code})</option>)}</select><select value={year} onChange={e => { setYear(e.target.value); setSem(""); setOpen(null); }}><option value="">All years</option>{years.map(x => <option value={x} key={x}>Year {x}</option>)}</select><select value={sem} onChange={e => { setSem(e.target.value); setOpen(null); }}><option value="">All semesters</option>{semesters.map(x => <option value={x} key={x}>Semester {x}</option>)}</select><button className="ghost" onClick={() => { setD(""); setYear(""); setSem(""); setOpen(null); void refresh(); }}><RefreshCw size={15} />Refresh</button></div>
    <div className="subject-list">{list.map(s => { const notes = resources.filter(r => r.subject_id === s.id).sort((a, b) => (a.unit_number ?? 99) - (b.unit_number ?? 99)); return <div className="subject-block" key={s.id}><button className="subject-row" onClick={() => setOpen(open === s.id ? null : s.id)}><span className="subject-icon"><BookOpen size={20} /></span><span className="subject-info"><b>{s.name}</b><small>{s.code} · Year {s.year} · Semester {s.semester}</small></span><span className="subject-count">{notes.length} note{notes.length === 1 ? "" : "s"}<ChevronDown className={open === s.id ? "rotated" : ""} size={18} /></span></button>{open === s.id && <div className="unit-list">{[1, 2, 3, 4, 5, 6].map(u => { const unitNotes = notes.filter(n => n.unit_number === u); return <div className="unit-group" key={u}><div className="unit-title">Unit {u}</div>{unitNotes.length ? unitNotes.map(r => <MiniResource key={r.id} r={r} />) : <div className="unit-empty">No Unit {u} note uploaded yet.</div>}</div>})}</div>}</div>; })}</div>{!list.length && <Empty icon={<BookOpen />} title="No matching subjects" text="Choose another department, year or semester, or ask your admin to add the subject." />}</>;
}
function MiniResource({ r }: { r: Resource }) { const [busy, setBusy] = useState(false); return <div className="mini-resource"><FileText size={18} /><div><b>{r.title}</b><small>{r.description || "Academic PDF"} · {r.downloads || 0} downloads</small></div><button disabled={busy} onClick={async () => { setBusy(true); try { await downloadResource(r.id, r.file_name || `notedown-${r.id}.pdf`); } catch (e) { alert(e instanceof Error ? e.message : "Download failed"); } finally { setBusy(false); } }}><Download size={15} />{busy ? "Saving…" : "Download"}</button></div>; }
function Resources({ resources, departments, subjects, refresh }: { resources: Resource[]; departments: Department[]; subjects: Subject[]; refresh: () => Promise<void> }) {
  const [q, setQ] = useState(""), [d, setD] = useState(""), [year, setYear] = useState(""), [sem, setSem] = useState(""), [unit, setUnit] = useState(""), [items, setItems] = useState(resources), [busy, setBusy] = useState(false);
  useEffect(() => setItems(resources), [resources]);
  async function search() { setBusy(true); try { setItems(await getResources({ search: q, department_id: d ? Number(d) : undefined, year: year ? Number(year) : undefined, semester: sem ? Number(sem) : undefined, unit: unit ? Number(unit) : undefined })); } catch (e) { alert(e instanceof Error ? e.message : "Search failed"); } finally { setBusy(false); } }
  const clear = () => { setQ(""); setD(""); setYear(""); setSem(""); setUnit(""); setItems(resources); void refresh(); };
  return <><PageHead title="Resources" text="Search by title, subject, description, unit, year, semester and department." /><div className="search-panel"><Search size={19} /><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && void search()} placeholder="Search notes, subjects, algorithms, units…" /><button onClick={() => void search()} disabled={busy}>{busy ? "Searching…" : "Search"}</button></div><div className="filter-panel resource-filters"><select value={d} onChange={e => setD(e.target.value)}><option value="">Department</option>{departments.map(x => <option value={x.id} key={x.id}>{x.code}</option>)}</select><select value={year} onChange={e => setYear(e.target.value)}><option value="">Year</option>{[1, 2, 3, 4].map(x => <option key={x}>{x}</option>)}</select><select value={sem} onChange={e => setSem(e.target.value)}><option value="">Semester</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(x => <option key={x}>{x}</option>)}</select><select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Unit</option>{[1, 2, 3, 4, 5, 6].map(x => <option key={x}>{x}</option>)}</select><button className="ghost" onClick={clear}>Clear</button></div><div className="resource-list">{items.map(r => <ResourceCard key={r.id} r={r} />)}</div>{!items.length && <Empty icon={<Search />} title="No resources found" text="Try another keyword or clear the filters." />}</>;
}
function ResourceCard({ r }: { r: Resource }) { const [fav, setFav] = useState(false), [busy, setBusy] = useState(false); useEffect(() => { getFavorites().then(x => setFav(x.some(y => y.id === r.id))).catch(() => {}); }, [r.id]); async function toggle() { try { if (fav) await removeFavorite(r.id); else await addFavorite(r.id); setFav(!fav); } catch (e) { alert(e instanceof Error ? e.message : "Favorite failed"); } } return <article className="resource-card"><div className="resource-icon"><FileText size={21} /></div><div className="resource-body"><div className="resource-title"><b>{r.unit_number ? `Unit ${r.unit_number} · ` : ""}{r.title}</b><button className={fav ? "icon-btn liked" : "icon-btn"} onClick={() => void toggle()} aria-label="Favorite"><Heart size={17} fill={fav ? "currentColor" : "none"} /></button></div><p>{r.description || "Academic PDF"}</p><small>{r.subject?.name || r.subject_name || "Subject"} · {r.downloads || 0} downloads</small></div><button className="download-btn" disabled={busy} onClick={async () => { setBusy(true); try { await downloadResource(r.id, r.file_name || `notedown-${r.id}.pdf`); } catch (e) { alert(e instanceof Error ? e.message : "Download failed"); } finally { setBusy(false); } }}><Download size={16} />{busy ? "Saving…" : "Download"}</button></article>; 
}
function HistoryPage() { const [items, setItems] = useState<HistoryItem[]>([]); useEffect(() => { getHistory().then(setItems).catch(() => setItems([])); }, []); return <><PageHead title="Download History" text="Your successful NoteDown PDF downloads." /><div className="history-list">{items.map(x => <div className="history-row" key={x.id}><FileText size={19} /><div><b>{x.resource?.title || "Resource"}</b><small>{x.resource?.subject_name || x.resource?.subject?.name || "Subject"} · {new Date(x.downloaded_at).toLocaleString()}</small></div><span className="history-unit">{x.resource?.unit_number ? `Unit ${x.resource.unit_number}` : "PDF"}</span></div>)}{!items.length && <Empty icon={<History />} title="No downloads yet" text="Download a PDF and it will appear here." />}</div></>; }
function Chat() {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const suggestions = [
    "Explain this topic from my notes step by step",
    "Teach me this concept like I am preparing for an exam",
    "Give me a simple example and then a harder one",
    "Ask me 5 viva questions from this subject",
  ];
  async function ask(e?: FormEvent) {
    e?.preventDefault();
    const text = q.trim();

    if (!text || busy) return;

    const next = [
      ...messages,
      {
        role: "user" as const,
        content: text,
      },
    ];

    setMessages(next);
    setQ("");
    setBusy(true);

    try {
      const r = await askNotes(text, next.slice(-8));

      setMessages((x) => [
        ...x,
        {
          role: "assistant",
          content: r.answer,
        },
      ]);

      setSources(r.sources || []);
    } catch (e) {
      setMessages((x) => [
        ...x,
        {
          role: "assistant",
          content:
            e instanceof Error ? e.message : "AI request failed",
        },
      ]);

      setSources([]);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUser || busy) return;

    setBusy(true);

    try {
      const historyWithoutLastAnswer = messages
        .slice(0, -1)
        .slice(-8);

      const r = await askNotes(
        lastUser.content,
        historyWithoutLastAnswer
      );

      setMessages((current) => {
        const copy = [...current];

        if (copy.length && copy[copy.length - 1].role === "assistant") {
          copy[copy.length - 1] = {
            role: "assistant",
            content: r.answer,
          };
        } else {
          copy.push({
            role: "assistant",
            content: r.answer,
          });
        }

        return copy;
      });

      setSources(r.sources || []);
    } catch (e) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            e instanceof Error ? e.message : "AI request failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setSources([]);
  }

  function newChat() {
    setMessages([]);
    setSources([]);
    setQ("");
    setSidebarOpen(false);
  }

  function copyAnswer(text: string) {
    navigator.clipboard?.writeText(text);
  }

  function renderAnswer(text: string): ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);

  function formatInline(value: string): ReactNode {
    const tokens = value.split(
      /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g
    );

    return tokens.map((token, index) => {
      if (
        (token.startsWith("**") && token.endsWith("**")) ||
        (token.startsWith("__") && token.endsWith("__"))
      ) {
        return (
          <strong key={index}>
            {token.slice(2, -2)}
          </strong>
        );
      }

      if (
        token.startsWith("*") &&
        token.endsWith("*") &&
        !token.startsWith("**")
      ) {
        return (
          <em key={index}>
            {token.slice(1, -1)}
          </em>
        );
      }

      if (token.startsWith("`") && token.endsWith("`")) {
        return (
          <code key={index}>
            {token.slice(1, -1)}
          </code>
        );
      }

      return <span key={index}>{token}</span>;
    });
  }

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const code = part
        .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
        .replace(/```$/, "");

      return (
        <pre className="ai-code-block" key={index}>
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split("\n");

    return (
      <div key={index}>
        {lines.map((line, lineIndex) => {
          const trimmed = line.trim();

          if (!trimmed) {
            return (
              <div
                className="ai-line-space"
                key={lineIndex}
              />
            );
          }

          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={lineIndex}>
                {formatInline(
                  trimmed.replace(/^###\s*/, "")
                )}
              </h4>
            );
          }

          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={lineIndex}>
                {formatInline(
                  trimmed.replace(/^##\s*/, "")
                )}
              </h3>
            );
          }

          if (trimmed.startsWith("# ")) {
            return (
              <h3 key={lineIndex}>
                {formatInline(
                  trimmed.replace(/^#\s*/, "")
                )}
              </h3>
            );
          }

          if (/^[-*]\s/.test(trimmed)) {
            return (
              <div className="ai-bullet" key={lineIndex}>
                <span>•</span>
                <span>
                  {formatInline(
                    trimmed.replace(/^[-*]\s+/, "")
                  )}
                </span>
              </div>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(
              /^(\d+)\.\s+(.*)$/
            );

            return (
              <div
                className="ai-numbered"
                key={lineIndex}
              >
                <span>{match?.[1]}.</span>
                <span>
                  {formatInline(match?.[2] || "")}
                </span>
              </div>
            );
          }

          return (
            <p key={lineIndex}>
              {formatInline(trimmed)}
            </p>
          );
        })}
      </div>
    );
  });
}

  const lastAssistantIndex = messages.reduce(
    (last, message, index) =>
      message.role === "assistant" ? index : last,
    -1
  );

  return (
    <>
      <PageHead
        title="NoteDown AI"
        text="Your academic AI tutor for explanations, problem solving, revision and questions from your notes."
      />

      <div className="ai-chat-page">

        {/* SIDEBAR */}
        <aside
          className={`ai-sidebar ${
            sidebarOpen ? "open" : "closed"
          }`}
        >
          <div className="ai-sidebar-top">

            <button
              className="ai-new-chat"
              onClick={newChat}
            >
              <MessageCircle size={18} />
              <span>New chat</span>
            </button>

            <button
              className="ai-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <X size={18} />
            </button>

          </div>

          <div className="ai-sidebar-section">
            <div className="ai-sidebar-title">
              <span>NoteDown AI</span>
            </div>

            {messages.length > 0 ? (
              <button className="ai-history-item">
                <MessageCircle size={15} />
                <span>
                  {messages
                    .find((m) => m.role === "user")
                    ?.content.slice(0, 34) || "New conversation"}
                </span>
              </button>
            ) : (
              <div className="ai-history-empty">
                No previous chats
              </div>
            )}
          </div>

          <div className="ai-sidebar-bottom">
            <button
              className="ai-sidebar-action"
              onClick={clearChat}
              disabled={!messages.length}
            >
              <Trash2 size={16} />
              <span>Clear conversation</span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="ai-main">

          {/* TOP BAR */}
          <div className="ai-topbar">

            <button
              className="ai-menu-button"
              onClick={() => setSidebarOpen((x) => !x)}
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="ai-topbar-title">
              <div className="ai-topbar-icon">
                <Brain size={18} />
              </div>

              <div>
                <strong>NoteDown AI</strong>
                <span>Academic study assistant</span>
              </div>
            </div>

            <button
              className="ai-clear-button"
              onClick={clearChat}
              disabled={!messages.length || busy}
            >
              <Trash2 size={16} />
              <span>Clear</span>
            </button>

          </div>

          {/* CONVERSATION */}
          <div className="ai-conversation-new">

            {!messages.length && !busy ? (
              <div className="ai-welcome">

                <div className="ai-welcome-icon">
                  <Brain size={34} />
                </div>

                <h1>How can I help you study?</h1>

                <p>
                  Ask NoteDown AI anything about your subjects,
                  algorithms, programming, theory, numericals,
                  exam preparation or uploaded notes.
                </p>

                <div className="ai-suggestion-grid">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQ(suggestion)}
                    >
                      <MessageCircle size={16} />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>

              </div>
            ) : (
              <div className="ai-messages-list">

                {messages.map((message, index) => (
                  <div
                    className={`ai-message-row ${
                      message.role === "user"
                        ? "user-row"
                        : "assistant-row"
                    }`}
                    key={index}
                  >

                    {message.role === "assistant" && (
                      <div className="ai-avatar">
                        <Brain size={18} />
                      </div>
                    )}

                    <div className="ai-message-content">

                      <div className="ai-message-name">
                        {message.role === "user"
                          ? "You"
                          : "NoteDown AI"}
                      </div>

                      <div className="ai-answer">
                        {message.role === "assistant"
                          ? renderAnswer(message.content)
                          : <p>{message.content}</p>}
                      </div>

                      {message.role === "assistant" &&
                        index === lastAssistantIndex && (
                          <div className="ai-message-actions">

                            <button
                              onClick={() =>
                                copyAnswer(message.content)
                              }
                              title="Copy answer"
                            >
                              Copy
                            </button>

                            <button
                              onClick={regenerate}
                              disabled={busy}
                              title="Regenerate answer"
                            >
                              <RefreshCw size={14} />
                              Regenerate
                            </button>

                          </div>
                        )}

                    </div>

                  </div>
                ))}

                {busy && (
                  <div className="ai-message-row assistant-row">

                    <div className="ai-avatar ai-avatar-thinking">
                      <Brain size={18} />
                    </div>

                    <div className="ai-message-content">

                      <div className="ai-message-name">
                        NoteDown AI
                      </div>

                      <div className="ai-thinking-new">
                        <span />
                        <span />
                        <span />
                        <em>Thinking…</em>
                      </div>

                    </div>

                  </div>
                )}

              </div>
            )}

          </div>

          {/* SOURCES */}
          {sources.length > 0 && (
            <div className="ai-sources-new">

              <div className="ai-sources-title">
                <FileText size={15} />
                <span>Sources from your notes</span>
              </div>

              <div className="ai-source-list">
                {sources.map((source) => (
                  <span
                    className="ai-source-chip-new"
                    key={source}
                  >
                    {source}
                  </span>
                ))}
              </div>

            </div>
          )}

          {/* COMPOSER */}
          <div className="ai-composer-area">

            <form
              className="ai-composer"
              onSubmit={ask}
            >

              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                placeholder="Message NoteDown AI…"
                disabled={busy}
              />

              <button
                type="submit"
                className="ai-send-button"
                disabled={busy || !q.trim()}
                title="Send message"
              >
                <MessageCircle size={18} />
              </button>

            </form>

            <div className="ai-composer-hint">
              NoteDown AI can make mistakes. Verify important
              information from your notes or textbooks.
            </div>

          </div>

        </main>
      </div>
    </>
  );
}

function Attendance() {
  const [tab, setTab] = useState<"overview" | "timetable" | "mark" | "bunk">("overview");
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>({
    minimum_percentage: 75,
    location_enabled: false,
    default_radius: 50,
  });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await getAttendance();
      setSummary(r.summary || []);
      setRecords(r.records || []);
      setTimetable(r.timetables || []);
      if (r.settings) setSettings(r.settings);
    } catch (e) {
      console.error("Attendance load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const overall = useMemo(() => {
    const present = summary.reduce((a, x) => a + Number(x.present || 0), 0);
    const total = summary.reduce((a, x) => a + Number(x.total || 0), 0);
    return {
      present,
      total,
      pct: total ? Math.round((present * 1000) / total) / 10 : 0,
    };
  }, [summary]);

  const todayName = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  const todayClasses = useMemo(
    () =>
      timetable
        .filter((x) => x.day_of_week === todayName)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [timetable, todayName]
  );

  return (
    <>
      <PageHead
        title="Attendance Dashboard"
        text="Your timetable controls today's classes. When a class is active, NoteDown shows it here so you can mark Present or Absent without selecting a subject."
      />

      <div className="attendance-tabs">
        {([
          ["overview", "📊 Overview"],
          ["timetable", "🗓️ Timetable"],
          ["mark", "✅ Mark Attendance"],
          ["bunk", "🎯 Bunk Planner"],
        ] as const).map(([x, l]) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">
          <p>Loading attendance dashboard…</p>
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <AttendanceOverview
              summary={summary}
              records={records}
              todayClasses={todayClasses}
              overall={overall}
              minimum={settings.minimum_percentage}
              onTab={setTab}
            />
          )}

          {tab === "timetable" && (
            <TimetablePanel
              items={timetable}
              settings={settings}
              refresh={load}
            />
          )}

          {tab === "mark" && (
            <MarkAttendance
              items={timetable}
              refresh={load}
              locationEnabled={settings.location_enabled}
            />
          )}

          {tab === "bunk" && (
            <BunkPlannerPro
              summary={summary}
              timetable={timetable}
              minimum={settings.minimum_percentage}
              onRefresh={load}
            />
          )}
        </>
      )}
    </>
  );
}

function AttendanceOverview({
  summary,
  records,
  todayClasses,
  overall,
  minimum,
  onTab,
}: {
  summary: AttendanceSummary[];
  records: AttendanceRecord[];
  todayClasses: Timetable[];
  overall: { present: number; total: number; pct: number };
  minimum: number;
  onTab: (x: "overview" | "timetable" | "mark" | "bunk") => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="attendance-dashboard">
      <div className="attendance-overview-grid">
        <div className="attendance-hero-card">
          <span>Overall Attendance</span>
          <strong>{overall.pct}%</strong>
          <div className="progress">
            <i style={{ width: `${Math.min(overall.pct, 100)}%` }} />
          </div>
          <small>
            {overall.present} present · {overall.total - overall.present} absent · {overall.total} conducted
          </small>
        </div>

        <div className="attendance-stat-card">
          <b>Minimum target</b>
          <strong>{minimum}%</strong>
          <span>
            {overall.pct >= minimum
              ? "Above your target"
              : "Below your target"}
          </span>
        </div>

        <div className="attendance-stat-card">
          <b>Today's classes</b>
          <strong>{todayClasses.length}</strong>
          <span>
            {todayClasses.length
              ? "See timetable below"
              : "No classes added"}
          </span>
        </div>
      </div>

      <div className="attendance-two-col">
        <section className="card">
          <div className="summary-header">
            <h3>Today's Classes</h3>
            <button className="ghost" onClick={() => onTab("timetable")}>
              Manage timetable
            </button>
          </div>

          {todayClasses.length ? (
            todayClasses.map((x) => {
              const record = records.find(
                (r) =>
                  r.class_date === today &&
                  r.timetable_id === x.id &&
                  r.status !== "cancelled"
              );

              return (
                <div className="today-class" key={x.id}>
                  <span className="time-block">
                    {x.start_time}
                    <small>{x.end_time}</small>
                  </span>
                  <div>
                    <b>{x.subject_name || x.label || "Class"}</b>
                    <small>
                      {x.room || "Room not set"} · {x.attendance_mode === "AUTO" ? "📍 Automatic" : "Manual"}
                    </small>
                  </div>
                  <span
                    className={
                      record?.status === "present"
                        ? "present-pill"
                        : record?.status === "absent"
                        ? "absent-pill"
                        : "upcoming-pill"
                    }
                  >
                    {record?.status === "present"
                      ? "Present"
                      : record?.status === "absent"
                      ? "Absent"
                      : "Upcoming"}
                  </span>
                </div>
              );
            })
          ) : (
            <Empty
              icon={<CalendarCheck />}
              title="No classes today"
              text="Add your weekly timetable to see today's classes here."
            />
          )}
        </section>

        <section className="card">
          <div className="summary-header">
            <h3>Subject-wise Attendance</h3>
            <button className="ghost" onClick={() => onTab("mark")}>
              Mark class
            </button>
          </div>

          {summary.length ? (
            summary.map((s) => (
              <div className="subject-att" key={String(s.subject_id)}>
                <div>
                  <b>{s.subject_name || "Subject"}</b>
                  <small>
                    {s.present} present · {s.total} conducted
                  </small>
                </div>
                <strong>{s.percentage}%</strong>
                <div className="progress">
                  <i style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                </div>
              </div>
            ))
          ) : (
            <Empty
              icon={<CalendarCheck />}
              title="No attendance records"
              text="Use Mark Attendance to record your first class."
            />
          )}
        </section>
      </div>

      <section className="card">
        <h3>Recent Attendance</h3>
        {records.slice(0, 10).map((r) => (
          <div className="recent-row" key={r.id}>
            <span>{new Date(r.class_date).toLocaleDateString()}</span>
            <b>{r.subject_name || "Class"}</b>
            <span
              className={
                r.status === "present" ? "present-pill" : "absent-pill"
              }
            >
              {r.status}
            </span>
            <small>
              {r.method === "AUTO" ? "📍 Automatic" : "✋ Manual"}
            </small>
          </div>
        ))}
        {!records.length && (
          <p className="form-help">No attendance has been marked yet.</p>
        )}
      </section>
    </div>
  );
}

function TimetablePanel({
  items,
  settings,
  refresh,
}: {
  items: Timetable[];
  settings: AttendanceSettings;
  refresh: () => Promise<void>;
}) {
  const empty = {
    subject_name: "",
    subject_code: "",
    day_of_week: "Monday",
    start_time: "09:00",
    end_time: "10:00",
    room: "",
    faculty: "",
    class_type: "class",
    label: "",
    latitude: "",
    longitude: "",
    radius: String(settings.default_radius || 50),
    attendance_mode: "MANUAL" as "AUTO" | "MANUAL",
  };

  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(
    settings.location_enabled
  );
  const [defaultRadius, setDefaultRadius] = useState(
    settings.default_radius || 50
  );

  useEffect(() => {
    setLocationEnabled(settings.location_enabled);
    setDefaultRadius(settings.default_radius || 50);
  }, [settings.location_enabled, settings.default_radius]);

  function useLocation() {
    if (!navigator.geolocation) {
      alert("Location is not supported on this device.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({
          ...f,
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
          attendance_mode: "AUTO",
        }));
        setLocating(false);
      },
      () => {
        alert("Location permission was denied or unavailable.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }

  function resetForm() {
    setForm({ ...empty, radius: String(defaultRadius || 50) });
    setEditing(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();

    const subjectName = form.subject_name.trim();
    const subjectCode = form.subject_code.trim();

    if (!subjectName) {
      alert("Enter the subject/class name.");
      return;
    }

    if (!form.start_time || !form.end_time) {
      alert("Select start and end time.");
      return;
    }

    if (form.end_time <= form.start_time) {
      alert("End time must be after start time.");
      return;
    }

    if (
      form.attendance_mode === "AUTO" &&
      (!form.latitude || !form.longitude)
    ) {
      alert("Fetch/set the classroom location for automatic attendance.");
      return;
    }

    setSaving(true);

    try {
      const existing = editing
        ? items.find((x) => x.id === editing)
        : undefined;

      const payload: any = {
        subject_id: existing?.subject_id ?? null,
        subject_name: subjectName,
        subject_code: subjectCode,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim(),
        faculty: form.faculty.trim(),
        class_type: form.class_type || "class",
        label: form.label.trim() || subjectName,
        radius: Number(form.radius) || 50,
        attendance_mode: form.attendance_mode,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      };

      if (editing) {
        await updateTimetable(editing, payload);
      } else {
        await createTimetable(payload);
      }

      resetForm();
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save class");
    } finally {
      setSaving(false);
    }
  }

  function edit(x: Timetable) {
    setEditing(x.id);
    setForm({
      subject_name: x.subject_name || x.label || "",
      subject_code: x.subject_code || "",
      day_of_week: x.day_of_week || "Monday",
      start_time: x.start_time || "09:00",
      end_time: x.end_time || "10:00",
      room: x.room || "",
      faculty: x.faculty || "",
      class_type: x.class_type || "class",
      label: x.label || x.subject_name || "",
      latitude:
        x.latitude !== null && x.latitude !== undefined
          ? String(x.latitude)
          : "",
      longitude:
        x.longitude !== null && x.longitude !== undefined
          ? String(x.longitude)
          : "",
      radius: String(x.radius || defaultRadius || 50),
      attendance_mode: x.attendance_mode || "MANUAL",
    });
    document.querySelector(".timetable-editor-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveSettings() {
    try {
      const r = await saveAttendanceSettings({
        location_enabled: locationEnabled,
        default_radius: Number(defaultRadius) || 50,
      });
      setLocationEnabled(r.settings.location_enabled);
      setDefaultRadius(r.settings.default_radius);
      alert("Attendance settings saved.");
    } catch (e) {
      alert(
        e instanceof Error ? e.message : "Could not save settings"
      );
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    const dayOrder: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7,
    };
    return (
      (dayOrder[a.day_of_week] || 99) -
        (dayOrder[b.day_of_week] || 99) ||
      a.start_time.localeCompare(b.start_time)
    );
  });

  return (
    <>
      <TimetableScanner subjects={[]} onImported={refresh} />

      <div className="attendance-two-col">
        <div className="attendance-form">
          <form className="card attendance-form timetable-editor-form" onSubmit={save}>
            <div className="card-title">
              <CalendarCheck />
              <div>
                <h3>{editing ? "Edit Class" : "Add Class"}</h3>
                <p>
                  Enter the class name directly. No department or Subject
                  master record is required.
                </p>
              </div>
            </div>

            <label>
              Subject / Class name
              <input
                value={form.subject_name}
                onChange={(e) =>
                  setForm({ ...form, subject_name: e.target.value })
                }
                placeholder="Artificial Intelligence"
              />
            </label>

            <label>
              Subject code (optional)
              <input
                value={form.subject_code}
                onChange={(e) =>
                  setForm({ ...form, subject_code: e.target.value })
                }
                placeholder="24ACSE51T"
              />
            </label>

            <div className="two">
              <label>
                Day
                <select
                  value={form.day_of_week}
                  onChange={(e) =>
                    setForm({ ...form, day_of_week: e.target.value })
                  }
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                Room
                <input
                  value={form.room}
                  onChange={(e) =>
                    setForm({ ...form, room: e.target.value })
                  }
                  placeholder="CSE-201"
                />
              </label>
            </div>

            <div className="two">
              <label>
                Start time
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm({ ...form, start_time: e.target.value })
                  }
                />
              </label>

              <label>
                End time
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) =>
                    setForm({ ...form, end_time: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="two">
              <label>
                Faculty (optional)
                <input
                  value={form.faculty}
                  onChange={(e) =>
                    setForm({ ...form, faculty: e.target.value })
                  }
                  placeholder="Dr. Kumar"
                />
              </label>

              <label>
                Class type
                <select
                  value={form.class_type}
                  onChange={(e) =>
                    setForm({ ...form, class_type: e.target.value })
                  }
                >
                  <option value="class">Class</option>
                  <option value="lab">Lab</option>
                  <option value="break">Break</option>
                  <option value="activity">Activity</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <label>
              Display label (optional)
              <input
                value={form.label}
                onChange={(e) =>
                  setForm({ ...form, label: e.target.value })
                }
                placeholder="AI Lab"
              />
            </label>

            <div>
              <span className="field-label">Attendance mode</span>
              <div className="seg">
                <button
                  type="button"
                  className={
                    form.attendance_mode === "MANUAL" ? "selected" : ""
                  }
                  onClick={() =>
                    setForm({ ...form, attendance_mode: "MANUAL" })
                  }
                >
                  ✋ Manual
                </button>
                <button
                  type="button"
                  className={
                    form.attendance_mode === "AUTO" ? "selected" : ""
                  }
                  onClick={() =>
                    setForm({ ...form, attendance_mode: "AUTO" })
                  }
                >
                  📍 Automatic
                </button>
              </div>
            </div>

            {form.attendance_mode === "AUTO" && (
              <div className="location-box">
                <div>
                  {form.latitude && form.longitude
                    ? `${form.latitude}, ${form.longitude}`
                    : "Set the classroom location before saving."}
                </div>
                <button
                  type="button"
                  className="ghost"
                  onClick={useLocation}
                  disabled={locating}
                >
                  <Navigation size={15} />
                  {locating ? "Fetching…" : "Use current location"}
                </button>
                <div className="two">
                  <input
                    value={form.latitude}
                    onChange={(e) =>
                      setForm({ ...form, latitude: e.target.value })
                    }
                    placeholder="Latitude"
                  />
                  <input
                    value={form.longitude}
                    onChange={(e) =>
                      setForm({ ...form, longitude: e.target.value })
                    }
                    placeholder="Longitude"
                  />
                </div>
              </div>
            )}

            <div className="two">
              <label>
                Radius (metres)
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={form.radius}
                  onChange={(e) =>
                    setForm({ ...form, radius: e.target.value })
                  }
                />
              </label>
              <div />
            </div>

            <div className="row-actions">
              <button className="primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update Class" : "Add Class"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="ghost"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="card">
            <div className="summary-header">
              <div>
                <h3>Attendance settings</h3>
                <p className="form-help">
                  These settings apply to automatic attendance classes.
                </p>
              </div>
            </div>

            <label>
              Default radius (metres)
              <input
                type="number"
                min="10"
                max="1000"
                value={defaultRadius}
                onChange={(e) => setDefaultRadius(Number(e.target.value))}
              />
            </label>

            <div className="seg">
              <button
                type="button"
                className={locationEnabled ? "selected" : ""}
                onClick={() => setLocationEnabled(true)}
              >
                📍 Location enabled
              </button>
              <button
                type="button"
                className={!locationEnabled ? "selected" : ""}
                onClick={() => setLocationEnabled(false)}
              >
                ✋ Manual only
              </button>
            </div>

            <button className="primary" type="button" onClick={() => void saveSettings()}>
              Save settings
            </button>
          </div>
        </div>

        <div className="card">
          <div className="summary-header">
            <h3>Your Weekly Timetable</h3>
            <span>{sortedItems.length} classes</span>
          </div>

          {sortedItems.length ? (
            <div className="timetable-list">
              {sortedItems.map((x) => (
                <div className="timetable-row" key={x.id}>
                  <div className="time-block">
                    {x.start_time}
                    <small>{x.end_time}</small>
                  </div>
                  <div>
                    <b>{x.subject_name || x.label || "Class"}</b>
                    <small>
                      {x.day_of_week} · {x.room || "Room not set"}
                      {x.subject_code ? ` · ${x.subject_code}` : ""}
                      {x.faculty ? ` · ${x.faculty}` : ""}
                      {x.class_type ? ` · ${x.class_type}` : ""}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="icon-btn" onClick={() => edit(x)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={async () => {
                        if (!confirm("Delete this class?")) return;
                        try {
                          await deleteTimetable(x.id);
                          await refresh();
                        } catch (e) {
                          alert(
                            e instanceof Error ? e.message : "Delete failed"
                          );
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarCheck />}
              title="Timetable is empty"
              text="Scan your timetable or add your first class manually."
            />
          )}
        </div>
      </div>
    </>
  );
}

function MarkAttendance({
  items,
  refresh,
  locationEnabled,
}: {
  items: Timetable[];
  refresh: () => Promise<void>;
  locationEnabled: boolean;
}) {
  const [status, setStatus] = useState<"present" | "absent">("present");
  const [mode, setMode] = useState<"manual" | "location">("manual");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);

  // Keep the screen live so the current class changes automatically.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const todayName = now.toLocaleDateString("en-US", {
    weekday: "long",
  });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  function toMinutes(value: string) {
    const [h, m] = value.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const todayClasses = useMemo(
    () =>
      items
        .filter((x) => x.day_of_week === todayName)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [items, todayName]
  );

  const currentClass = useMemo(
    () =>
      todayClasses.find((x) => {
        const start = toMinutes(x.start_time);
        const end = toMinutes(x.end_time);
        return nowMinutes >= start && nowMinutes < end;
      }) || null,
    [todayClasses, nowMinutes]
  );

  const nextClass = useMemo(
    () =>
      todayClasses.find(
        (x) => toMinutes(x.start_time) > nowMinutes
      ) || null,
    [todayClasses, nowMinutes]
  );

  const completedCount = todayClasses.filter(
    (x) => toMinutes(x.end_time) <= nowMinutes
  ).length;

  function fetchLocation() {
    if (!navigator.geolocation) {
      setMsg("Location is not supported on this device.");
      return;
    }

    setLocating(true);
    setMsg("Requesting GPS permission…");

    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setMsg(
          `GPS captured successfully (±${Math.round(
            p.coords.accuracy
          )} m)`
        );
        setLocating(false);
      },
      (e) => {
        setMsg(
          e.code === 1
            ? "Location permission was denied. Manual attendance is still available."
            : "Could not fetch GPS. You can continue with manual attendance."
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }

  async function saveAttendance() {
    if (!currentClass) {
      setMsg("There is no active timetable class right now.");
      return;
    }

    if (mode === "location" && !location) {
      fetchLocation();
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      await markAttendance(
        (currentClass.subject_id ?? null) as any,
        status,
        todayKey,
        {
          mode,
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
        },
        currentClass.id
      );

      setMsg(
        `${currentClass.subject_name || currentClass.label || "Class"}: ${
          status === "present" ? "Present" : "Absent"
        } marked successfully.`
      );

      await refresh();
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Could not save attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  async function autoCheck() {
    if (!currentClass) {
      setMsg("There is no active timetable class right now.");
      return;
    }

    if (!location) {
      fetchLocation();
      return;
    }

    setSaving(true);
    setMsg("Checking your classroom location…");

    try {
      const r = await autoMarkAttendance({
        timetable_id: currentClass.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        client_day: todayName,
        client_time: now.toTimeString().slice(0, 5),
      });

      setMsg(r.message);
      await refresh();
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Automatic attendance failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const title =
    currentClass?.subject_name ||
    currentClass?.label ||
    "No class right now";

  return (
    <div className="attendance-mark-modern">
      <div className="attendance-current-card">
        <div className="attendance-current-top">
          <div>
            <span className="eyebrow">LIVE ATTENDANCE</span>
            <h2>
              {currentClass
                ? "Are you attending this class?"
                : "No class is active right now"}
            </h2>
            <p>
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              · {now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="attendance-live-badge">
            <span className={currentClass ? "live-dot" : "idle-dot"} />
            {currentClass ? "CLASS NOW" : "WAITING"}
          </div>
        </div>

        {currentClass ? (
          <>
            <div className="current-class-main">
              <div className="current-class-icon">
                <CalendarCheck size={28} />
              </div>

              <div className="current-class-info">
                <h1>{title}</h1>
                <div className="current-class-meta">
                  <span>
                    <Clock3 size={15} />
                    {currentClass.start_time}–{currentClass.end_time}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {currentClass.room || "Room not set"}
                  </span>
                  {currentClass.faculty && (
                    <span>
                      <User size={15} />
                      {currentClass.faculty}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="attendance-question">
              <span>Mark your attendance</span>

              <div className="attendance-choice-grid">
                <button
                  type="button"
                  className={
                    status === "present"
                      ? "attendance-choice present selected"
                      : "attendance-choice present"
                  }
                  onClick={() => setStatus("present")}
                  disabled={saving}
                >
                  <CheckCircle2 size={24} />
                  <span>
                    <b>Present</b>
                    <small>I am attending</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    status === "absent"
                      ? "attendance-choice absent selected"
                      : "attendance-choice absent"
                  }
                  onClick={() => setStatus("absent")}
                  disabled={saving}
                >
                  <CircleAlert size={24} />
                  <span>
                    <b>Absent</b>
                    <small>I am not attending</small>
                  </span>
                </button>
              </div>
            </div>

            {locationEnabled && (
              <div className="attendance-location-box">
                <div>
                  <b>
                    <Navigation size={16} />
                    Attendance method
                  </b>
                  <small>
                    Use manual marking or verify your classroom location.
                  </small>
                </div>

                <div className="seg">
                  <button
                    type="button"
                    className={mode === "manual" ? "selected" : ""}
                    onClick={() => setMode("manual")}
                    disabled={saving}
                  >
                    ✋ Manual
                  </button>
                  <button
                    type="button"
                    className={mode === "location" ? "selected" : ""}
                    onClick={() => setMode("location")}
                    disabled={saving}
                  >
                    📍 Location
                  </button>
                </div>
              </div>
            )}

            {mode === "location" && locationEnabled && (
              <div className="location-action-row">
                <button
                  type="button"
                  className="ghost"
                  onClick={fetchLocation}
                  disabled={locating || saving}
                >
                  <Navigation size={16} />
                  {locating
                    ? "Getting location…"
                    : location
                    ? "Refresh location"
                    : "Get my location"}
                </button>

                {location && (
                  <small>
                    GPS ±{Math.round(location.accuracy || 0)} m
                  </small>
                )}

                <button
                  type="button"
                  className="ghost"
                  onClick={() => void autoCheck()}
                  disabled={saving || locating}
                >
                  <ShieldCheck size={16} />
                  Verify & mark automatically
                </button>
              </div>
            )}

            <button
              type="button"
              className={
                status === "present"
                  ? "primary attendance-submit"
                  : "attendance-submit attendance-submit-absent"
              }
              onClick={() => void saveAttendance()}
              disabled={saving || (mode === "location" && !location)}
            >
              {saving ? (
                <>
                  <RefreshCw size={17} className="spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Mark {status === "present" ? "Present" : "Absent"}
                </>
              )}
            </button>

            {msg && (
              <div className="attendance-message">
                {msg}
              </div>
            )}
          </>
        ) : (
          <div className="attendance-empty-state">
            <div className="attendance-empty-icon">
              <Clock3 size={30} />
            </div>
            <h3>No class is active at the moment</h3>
            <p>
              NoteDown automatically detects the class from your timetable.
              You do not need to choose a subject.
            </p>

            {nextClass ? (
              <div className="next-class-card">
                <span>NEXT CLASS</span>
                <b>
                  {nextClass.subject_name ||
                    nextClass.label ||
                    "Class"}
                </b>
                <small>
                  {nextClass.start_time}–{nextClass.end_time}
                  {" · "}
                  {nextClass.room || "Room not set"}
                </small>
              </div>
            ) : (
              <p className="form-help">
                No more classes are scheduled for today.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="attendance-day-strip">
        <div>
          <b>Today’s timetable</b>
          <span>
            {completedCount} completed · {todayClasses.length} scheduled
          </span>
        </div>

        <div className="attendance-mini-list">
          {todayClasses.length ? (
            todayClasses.map((item) => {
              const start = toMinutes(item.start_time);
              const end = toMinutes(item.end_time);
              const active =
                nowMinutes >= start && nowMinutes < end;
              const completed = nowMinutes >= end;

              return (
                <div
                  key={item.id}
                  className={
                    active
                      ? "attendance-mini-row active"
                      : completed
                      ? "attendance-mini-row completed"
                      : "attendance-mini-row"
                  }
                >
                  <span className="mini-time">
                    {item.start_time}
                  </span>
                  <div>
                    <b>
                      {item.subject_name ||
                        item.label ||
                        "Class"}
                    </b>
                    <small>
                      {item.end_time}
                      {item.room
                        ? ` · ${item.room}`
                        : ""}
                    </small>
                  </div>
                  <span className="mini-status">
                    {active
                      ? "Now"
                      : completed
                      ? "Done"
                      : "Upcoming"}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="form-help">
              No timetable entries for {todayName}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Papers({ subjects }: { subjects: Subject[] }) {
  const [sid,setSid]=useState(""), [syllabus,setSyllabus]=useState(""), [pattern,setPattern]=useState(""), [marks,setMarks]=useState(""), [result,setResult]=useState<any>(null), [sources,setSources]=useState<string[]>([]), [busy,setBusy]=useState(false), [note,setNote]=useState("");
  async function run(){if(syllabus.trim().length<10)return alert("Enter the syllabus first. Include units/topics as completely as possible.");if(pattern.trim().length<5)return alert("Enter the question-paper pattern first.");setBusy(true);setResult(null);try{const r=await predictQuestions({subject_id:sid?Number(sid):undefined,syllabus,pattern,marks});setResult(r.prediction);setSources(r.sources||[]);setNote(r.note||"")}catch(e){setNote(e instanceof Error?e.message:"Could not generate prediction")}finally{setBusy(false)}}
  return <><PageHead title="Question Paper Predictor" text="Enter your syllabus first, then describe the exact question-paper pattern. NoteDown AI maps topics to the pattern and creates a detailed practice prediction." /><div className="paper-lab"><div className="card predictor-form"><div className="predictor-step"><span>1</span><div><h3>Enter your syllabus</h3><p>Paste the complete syllabus, unit-wise topics, or upload/paste the official syllabus text.</p></div></div><textarea value={syllabus} onChange={e=>setSyllabus(e.target.value)} placeholder={'Example:\nUnit 1: Introduction, data preprocessing…\nUnit 2: Classification, decision trees…\nUnit 3: Clustering…'} /><div className="predictor-step"><span>2</span><div><h3>Describe the question-paper pattern</h3><p>Tell the AI sections, marks, choices and question counts exactly as your college uses them.</p></div></div><textarea value={pattern} onChange={e=>setPattern(e.target.value)} placeholder={'Example:\nSection A: 10 × 2 = 20 marks, answer all\nSection B: 5 × 10 = 50 marks, answer one from each unit\nInclude internal choice…'} /><div className="predictor-row"><label>Subject (optional)<select value={sid} onChange={e=>setSid(e.target.value)}><option value="">Use all uploaded notes</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></label><label>Extra marks/rules (optional)<input value={marks} onChange={e=>setMarks(e.target.value)} placeholder="e.g. 75 marks, 3 hours" /></label></div><button className="primary predictor-run" onClick={()=>void run()} disabled={busy}><Brain size={18}/>{busy?"Analyzing syllabus + pattern + notes…":"Generate AI prediction"}</button>{note&&<div className="notice">{note}</div>}</div>{result&&<div className="prediction-results"><div className="card"><div className="result-heading"><Brain size={20}/><div><h3>AI exam-preparation analysis</h3><p>{result.overview}</p></div></div></div>{result.unit_analysis?.length>0&&<div className="card"><h3>Unit analysis</h3><div className="unit-analysis">{result.unit_analysis.map((u:any,i:number)=><div key={i}><b>{u.unit}</b><span>{u.priority}</span><p>{(u.topics||[]).join(" · ")}</p></div>)}</div></div>}{(result.sections||[]).map((section:any,i:number)=><div className="card" key={i}><h3>{section.section} <small>{section.marks} marks</small></h3><div className="prediction-questions">{(section.questions||[]).map((q:any,j:number)=><article key={j}><div className="q-num">{q.number||j+1}</div><div><b>{q.question}</b><small>{q.type} · {q.marks} marks · {q.unit}</small><p>{q.reason}</p></div></article>)}</div></div>)}{result.important_topics?.length>0&&<div className="card"><h3>High-priority topics</h3><div className="topic-pills">{result.important_topics.map((x:string)=><span key={x}>{x}</span>)}</div></div>}{result.study_strategy?.length>0&&<div className="card"><h3>How to prepare</h3><ol className="strategy-list">{result.study_strategy.map((x:string)=><li key={x}>{x}</li>)}</ol></div>}{sources.length>0&&<div className="source-chips"><span>Notes considered:</span>{sources.map(x=><span className="source-chip" key={x}>{x}</span>)}</div>}</div>}{!result&&!busy&&<Empty icon={<Brain/>} title="Ready when you are" text="Provide the syllabus and paper pattern above. The AI will build a structured practice prediction instead of simply copying questions from PDFs." />}</div></>;
}

function Admin({ departments, subjects, resources, refresh }: { departments: Department[]; subjects: Subject[]; resources: Resource[]; refresh: () => Promise<void> }) { const [tab, setTab] = useState<"departments" | "subjects" | "resources">("resources"); return <><PageHead title="Admin Dashboard" text="Manage departments, year/semester subjects and unit-wise PDF notes." /><div className="admin-banner"><ShieldCheck size={21} /><div><b>Administrator workspace</b><span>Changes here are reflected immediately for students.</span></div></div><div className="tabs">{(["departments", "subjects", "resources"] as const).map(x => <button className={tab === x ? "active" : ""} key={x} onClick={() => setTab(x)}>{x === "departments" ? "Departments" : x === "subjects" ? "Subjects" : "Unit Notes"}</button>)}</div>{tab === "departments" && <DeptPanel deps={departments} refresh={refresh} />}{tab === "subjects" && <SubPanel deps={departments} subs={subjects} refresh={refresh} />}{tab === "resources" && <ResPanel resources={resources} subjects={subjects} refresh={refresh} />}</>; }
function DeptPanel({ deps, refresh }: { deps: Department[]; refresh: () => Promise<void> }) { const [name, setName] = useState(""), [code, setCode] = useState(""), [desc, setDesc] = useState(""); return <div className="admin-grid"><form className="card" onSubmit={async e => { e.preventDefault(); try { await createDepartment(name, code, desc); setName(""); setCode(""); setDesc(""); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><h3>Add department</h3><input placeholder="Department name" value={name} onChange={e => setName(e.target.value)} /><input placeholder="Code e.g. CSE" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} /><button className="primary">Create department</button></form><div className="card"><h3>Departments</h3>{deps.map(d => <div className="admin-row" key={d.id}><span><b>{d.name}</b><small>{d.code}</small></span><button className="icon-btn danger" onClick={async () => { if (confirm("Delete department?")) try { await deleteDepartment(d.id); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><Trash2 size={16} /></button></div>)}</div></div>; }
function SubPanel({ deps, subs, refresh }: { deps: Department[]; subs: Subject[]; refresh: () => Promise<void> }) { const [n, setN] = useState(""), [c, setC] = useState(""), [sem, setSem] = useState(""), [year, setYear] = useState(""), [dep, setDep] = useState(""); return <div className="admin-grid"><form className="card" onSubmit={async e => { e.preventDefault(); if (!dep || !year || !sem) return alert("Select department, year and semester."); try { await createSubject(n, c, Number(sem), Number(year), Number(dep)); setN(""); setC(""); setSem(""); setYear(""); setDep(""); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><h3>Add subject</h3><select value={dep} onChange={e => setDep(e.target.value)}><option value="">Department</option>{deps.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}</select><input placeholder="Subject name" value={n} onChange={e => setN(e.target.value)} /><input placeholder="Subject code" value={c} onChange={e => setC(e.target.value.toUpperCase())} /><div className="two"><select value={year} onChange={e => setYear(e.target.value)}><option value="">Year</option>{[1, 2, 3, 4].map(x => <option key={x}>{x}</option>)}</select><select value={sem} onChange={e => setSem(e.target.value)}><option value="">Semester</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(x => <option key={x}>{x}</option>)}</select></div><div className="form-help">Semester 1 and Semester 2 are separate records, and each department/year can have its own subjects.</div><button className="primary">Create subject</button></form><div className="card"><h3>Subjects</h3>{subs.map(s => <div className="admin-row" key={s.id}><span><b>{s.name}</b><small>{s.code} · {s.department_name || "Department"} · Year {s.year} · Sem {s.semester}</small></span><button className="icon-btn danger" onClick={async () => { if (confirm("Delete subject and its notes?")) try { await deleteSubject(s.id); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><Trash2 size={16} /></button></div>)}</div></div>; }
function ResPanel({ resources, subjects, refresh }: { resources: Resource[]; subjects: Subject[]; refresh: () => Promise<void> }) { const [t, setT] = useState(""), [desc, setDesc] = useState(""), [sid, setSid] = useState(""), [unit, setUnit] = useState(""), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false); async function up(e: FormEvent) { e.preventDefault(); if (!t || !sid || !file) return alert("Title, subject and PDF are required."); const f = new FormData(); f.append("title", t); f.append("description", desc); f.append("subject_id", sid); f.append("unit_number", unit); f.append("file", file); setBusy(true); try { await uploadResource(f); setT(""); setDesc(""); setSid(""); setUnit(""); setFile(null); await refresh(); alert("PDF uploaded successfully."); } catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); } } return <div className="admin-grid"><form className="card" onSubmit={up}><h3>Upload unit note</h3><select value={sid} onChange={e => setSid(e.target.value)}><option value="">Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} · Y{s.year} S{s.semester}</option>)}</select><select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Unit number</option>{[1, 2, 3, 4, 5, 6].map(x => <option key={x}>{x}</option>)}</select><input placeholder="Note title" value={t} onChange={e => setT(e.target.value)} /><textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} /><input type="file" accept=".pdf,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /><div className="form-help">Upload each unit separately when possible. AI Notes and Question Paper Lab read these PDFs.</div><button className="primary" disabled={busy}><Upload size={17} />{busy ? "Uploading…" : "Upload PDF"}</button></form><div className="card"><h3>Published unit notes</h3>{resources.map(r => <div className="admin-row" key={r.id}><span><b>{r.unit_number ? `Unit ${r.unit_number}: ` : ""}{r.title}</b><small>{r.subject?.name || r.subject_name || "Subject"} · Y{r.subject?.year || "-"} S{r.subject?.semester || "-"}</small></span><div className="row-actions"><button className="icon-btn" onClick={async () => { const x = prompt("New title", r.title); if (x) try { await renameResource(r.id, x); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><ExternalLink size={15} /></button><button className="icon-btn danger" onClick={async () => { if (confirm("Delete PDF?")) try { await deleteResource(r.id); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); } }}><Trash2 size={15} /></button></div></div>)}</div></div>; }

function PageHead({ title, text }: { title: string; text: string }) { return <div className="page-head"><span className="eyebrow">NOTEDOWN</span><h1>{title}</h1><p>{text}</p></div>; }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty">{icon}<h3>{title}</h3><p>{text}</p></div>; }
