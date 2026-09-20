const RAW_API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

const API_URL = RAW_API_URL
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

// ============================================================
// TYPES
// ============================================================

export type User = {
  id?: number;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  department_id?: number | null;
};

export type Department = {
  id: number;
  name: string;
  code: string;
  description?: string;
};

export type Subject = {
  id: number;
  name: string;
  code: string;
  semester: number;
  year: number;
  department_id: number;
  department_name?: string;
};

export type Resource = {
  id: number;
  title: string;
  description?: string;
  file_name?: string;
  filename?: string;
  resource_type?: string;
  unit_number?: number | null;
  downloads?: number;
  is_published?: boolean;
  subject_id?: number | null;
  subject_name?: string;
  subject?: Subject;
  created_at?: string;
};

export type HistoryItem = {
  id: number;
  downloaded_at: string;
  resource: Resource;
};

export type AttendanceSummary = {
  subject_id?: number | null;
  subject_name: string;
  subject_code?: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
};

export type AttendanceRecord = {
  id: number;

  // Optional now.
  // Timetable attendance does not require
  // a Subject master-table record.
  subject_id?: number | null;

  subject_name: string;
  subject_code?: string;

  class_date: string;
  status: string;

  method?: string;

  timetable_id?: number | null;

  location_mode?: string;

  latitude?: number;
  longitude?: number;
  accuracy?: number;

  marked_at?: string;
};

export type Timetable = {
  id: number;

  // IMPORTANT:
  // A timetable class can exist without a Subject record.
  subject_id?: number | null;

  subject_name: string;
  subject_code?: string;

  day_of_week: string;

  start_time: string;
  end_time: string;

  room?: string;
  faculty?: string;

  class_type?: string;
  label?: string;

  latitude?: number | null;
  longitude?: number | null;

  radius?: number;

  attendance_mode?: "AUTO" | "MANUAL";
};

export type AttendanceSettings = {
  minimum_percentage: number;
  location_enabled: boolean;
  default_radius: number;
};

// ============================================================
// CURRENT CLASS
// ============================================================

export type CurrentAttendanceClass = {
  found: boolean;

  needs_marking: boolean;

  already_marked: boolean;

  timetable?: Timetable | null;

  record?: AttendanceRecord | null;

  message?: string;
};

// ============================================================
// AUTH HELPERS
// ============================================================

export function getToken() {
  return (
    localStorage.getItem("notedown_token") ||
    localStorage.getItem("token")
  );
}

export function clearSession() {
  [
    "notedown_token",
    "token",
    "notedown_user",
    "user",
  ].forEach((key) =>
    localStorage.removeItem(key)
  );
}

// ============================================================
// REQUEST
// ============================================================

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(
    options.headers
  );

  if (!(options.body instanceof FormData)) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  const token = getToken();

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const cleanEndpoint =
    endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;

  const url =
    `${API_URL}${cleanEndpoint}`;

  console.log(
    `[NoteDown API] ${
      options.method || "GET"
    } ${url}`
  );

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error(
      "NoteDown API connection error:",
      error
    );

    throw new Error(
      `Cannot connect to NoteDown server at ${API_URL}. Make sure the Flask backend is running on port 5000.`
    );
  }

  const text =
    await response.text();

  let data: any = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      message:
        text ||
        "Invalid server response",
    };
  }

  console.log(
    `[NoteDown API] ${response.status}`,
    data
  );

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        data?.msg ||
        `Request failed (${response.status})`
    );
  }

  return data as T;
}

const unwrap = <T>(
  data: any,
  key: string
): T =>
  (data?.[key] ??
    data?.data?.[key] ??
    data) as T;

function authResult(
  data: any,
  fallbackUser: User
) {
  const token =
    data?.access_token ||
    data?.token ||
    data?.data?.access_token ||
    data?.data?.token;

  if (!token) {
    throw new Error(
      data?.message ||
        "Server did not return a login token."
    );
  }

  return {
    token,
    user:
      data?.user ||
      data?.data?.user ||
      fallbackUser,
  };
}

// ============================================================
// AUTH
// ============================================================

export async function login(
  email: string,
  password: string
) {
  const data = await request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  return authResult(data, {
    email,
    role: "student",
  });
}

export async function register(
  name: string,
  email: string,
  password: string,
  department_id?: number | null
) {
  const data = await request(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        department_id:
          department_id ?? null,
      }),
    }
  );

  return authResult(data, {
    name,
    email,
    role: "student",
  });
}

export async function getCurrentUser() {
  return unwrap<User>(
    await request(
      "/api/auth/me"
    ),
    "user"
  );
}

// ============================================================
// DEPARTMENTS
// ============================================================

export async function getDepartments() {
  return unwrap<Department[]>(
    await request(
      "/api/departments"
    ),
    "departments"
  );
}

export async function createDepartment(
  name: string,
  code: string,
  description = ""
) {
  return request(
    "/api/departments",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        code,
        description,
      }),
    }
  );
}

export async function deleteDepartment(
  id: number
) {
  return request(
    `/api/departments/${id}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// SUBJECTS
// ============================================================

export async function getSubjects(
  departmentId?: number,
  year?: number,
  semester?: number
) {
  const params =
    new URLSearchParams();

  if (departmentId) {
    params.set(
      "department_id",
      String(departmentId)
    );
  }

  if (year) {
    params.set(
      "year",
      String(year)
    );
  }

  if (semester) {
    params.set(
      "semester",
      String(semester)
    );
  }

  const query =
    params.toString();

  return unwrap<Subject[]>(
    await request(
      `/api/subjects${
        query
          ? `?${query}`
          : ""
      }`
    ),
    "subjects"
  );
}

export async function createSubject(
  name: string,
  code: string,
  semester: number,
  year: number,
  department_id: number
) {
  return request(
    "/api/subjects",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        code,
        semester,
        year,
        department_id,
      }),
    }
  );
}

export async function deleteSubject(
  id: number
) {
  return request(
    `/api/subjects/${id}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// RESOURCES
// ============================================================

export async function getResources(
  filters: {
    subject_id?: number;
    search?: string;
    unit?: number;
    semester?: number;
    year?: number;
    department_id?: number;
  } = {}
) {
  const params =
    new URLSearchParams();

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        params.set(
          key,
          String(value)
        );
      }
    }
  );

  const query =
    params.toString();

  return unwrap<Resource[]>(
    await request(
      `/api/resources${
        query
          ? `?${query}`
          : ""
      }`
    ),
    "resources"
  );
}

export async function uploadResource(
  form: FormData
) {
  return request(
    "/api/resources/upload",
    {
      method: "POST",
      body: form,
    }
  );
}

export async function renameResource(
  id: number,
  title: string
) {
  return request(
    `/api/resources/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        title,
      }),
    }
  );
}

export async function deleteResource(
  id: number
) {
  return request(
    `/api/resources/${id}`,
    {
      method: "DELETE",
    }
  );
}

export async function downloadResource(
  id: number,
  filename = "notedown.pdf"
) {
  const token =
    getToken();

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}/api/resources/${id}/download`,
      {
        headers: token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {},
      }
    );
  } catch {
    throw new Error(
      "Download failed: check that the NoteDown server is running."
    );
  }

  if (!response.ok) {
    let data: any = {};

    try {
      data =
        await response.json();
    } catch {}

    throw new Error(
      data?.message ||
        "Download failed"
    );
  }

  const blob =
    await response.blob();

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download =
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

// ============================================================
// FAVORITES / HISTORY
// ============================================================

export async function getFavorites() {
  return unwrap<Resource[]>(
    await request(
      "/api/favorites"
    ),
    "favorites"
  );
}

export async function addFavorite(
  id: number
) {
  return request(
    `/api/favorites/${id}`,
    {
      method: "POST",
    }
  );
}

export async function removeFavorite(
  id: number
) {
  return request(
    `/api/favorites/${id}`,
    {
      method: "DELETE",
    }
  );
}

export async function getHistory() {
  return unwrap<HistoryItem[]>(
    await request(
      "/api/history"
    ),
    "history"
  );
}

// ============================================================
// ATTENDANCE
// ============================================================

export async function getAttendance() {
  return request<{
    records: AttendanceRecord[];
    summary: AttendanceSummary[];
    timetables: Timetable[];
    settings: AttendanceSettings;
  }>(
    "/api/attendance"
  );
}

export async function saveAttendanceSettings(
  data: Partial<AttendanceSettings>
) {
  return request<{
    settings: AttendanceSettings;
  }>(
    "/api/attendance/settings",
    {
      method: "PUT",
      body: JSON.stringify(
        data
      ),
    }
  );
}

// ============================================================
// TODAY'S TIMETABLE
// ============================================================

export async function getTodayTimetable() {
  return unwrap<Timetable[]>(
    await request(
      "/api/timetable/today"
    ),
    "timetables"
  );
}

// ============================================================
// CURRENT CLASS
// ============================================================

export async function getCurrentAttendance() {
  return request<CurrentAttendanceClass>(
    "/api/attendance/current"
  );
}

export async function getCurrentClass() {
  return getCurrentAttendance();
}

// ============================================================
// TIMETABLE
// ============================================================

/*
 * IMPORTANT:
 *
 * subject_id is OPTIONAL.
 *
 * The new timetable system allows:
 *
 * Subject name:
 * Artificial Intelligence
 *
 * without requiring:
 *
 * Subject table → AI → ID
 *
 * This keeps manual/scanned timetable independent.
 */

export type TimetableCreateData = {
  subject_id?: number | null;

  subject_name: string;

  subject_code?: string;

  day_of_week: string;

  start_time: string;

  end_time: string;

  room?: string;

  faculty?: string;

  class_type?: string;

  label?: string;

  latitude?: number | null;

  longitude?: number | null;

  radius?: number;

  attendance_mode?: "AUTO" | "MANUAL";
};

export async function createTimetable(
  data: TimetableCreateData
) {
  return request<{
    timetable: Timetable;
  }>(
    "/api/timetable",
    {
      method: "POST",
      body: JSON.stringify({
        ...data,

        subject_id:
          data.subject_id ??
          null,

        subject_name:
          data.subject_name.trim(),

        subject_code:
          data.subject_code?.trim() ||
          "",

        room:
          data.room?.trim() ||
          "",

        faculty:
          data.faculty?.trim() ||
          "",

        class_type:
          data.class_type ||
          "class",

        label:
          data.label?.trim() ||
          data.subject_name.trim(),

        radius:
          data.radius ?? 50,

        attendance_mode:
          data.attendance_mode ||
          "MANUAL",
      }),
    }
  );
}

export async function updateTimetable(
  id: number,
  data: Partial<TimetableCreateData>
) {
  return request<{
    timetable: Timetable;
  }>(
    `/api/timetable/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...data,

        ...(data.subject_name !==
        undefined
          ? {
              subject_name:
                data.subject_name.trim(),
            }
          : {}),

        ...(data.subject_code !==
        undefined
          ? {
              subject_code:
                data.subject_code
                  ?.trim() || "",
            }
          : {}),

        ...(data.room !==
        undefined
          ? {
              room:
                data.room
                  ?.trim() || "",
            }
          : {}),

        ...(data.faculty !==
        undefined
          ? {
              faculty:
                data.faculty
                  ?.trim() || "",
            }
          : {}),

        subject_id:
          data.subject_id ??
          null,
      }),
    }
  );
}

export async function deleteTimetable(
  id: number
) {
  return request(
    `/api/timetable/${id}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// AUTO ATTENDANCE
// ============================================================

export async function autoMarkAttendance(
  data: {
    timetable_id: number;

    latitude: number;

    longitude: number;

    accuracy?: number;

    client_day?: string;

    client_time?: string;
  }
) {
  return request<{
    message: string;

    record?: AttendanceRecord;

    distance_m?: number;

    summary?: AttendanceSummary[];
  }>(
    "/api/attendance/auto",
    {
      method: "POST",
      body: JSON.stringify(
        data
      ),
    }
  );
}

// ============================================================
// MANUAL ATTENDANCE
// ============================================================

/*
 * Kept compatible with your existing App.tsx.
 *
 * Later, App.tsx will stop asking for
 * subject selection and will pass the
 * timetable class directly.
 */

export async function markAttendance(
  subject_id: number | null,

  status:
    | "present"
    | "absent"
    | "cancelled",

  class_date: string,

  location?: {
    mode:
      | "manual"
      | "location";

    latitude?: number;

    longitude?: number;

    accuracy?: number;
  },

  timetable_id?: number | null
) {
  return request(
    "/api/attendance",
    {
      method: "POST",

      body: JSON.stringify({
        subject_id:
          subject_id ?? null,

        status,

        class_date,

        timetable_id:
          timetable_id ??
          null,

        location_mode:
          location?.mode ||
          "manual",

        latitude:
          location?.latitude,

        longitude:
          location?.longitude,

        accuracy:
          location?.accuracy,
      }),
    }
  );
}

// ============================================================
// AI CHAT
// ============================================================

export type AIMessage = {
  role:
    | "user"
    | "assistant";

  content: string;
};

export async function askNotes(
  question: string,

  history: AIMessage[] = []
) {
  return request<{
    answer: string;

    sources: string[];

    model?: string;
  }>(
    "/api/chat",
    {
      method: "POST",

      body: JSON.stringify({
        question,

        history,
      }),
    }
  );
}

// ============================================================
// QUESTION PAPER PREDICTION
// ============================================================

export type QuestionPrediction = {
  overview: string;

  unit_analysis: {
    unit: string;

    topics: string[];

    priority: string;
  }[];

  sections: {
    section: string;

    marks: string | number;

    questions: {
      number?: number;

      question: string;

      marks: string | number;

      type: string;

      unit: string;

      reason: string;
    }[];
  }[];

  important_topics: string[];

  study_strategy: string[];
};

export async function predictQuestions(
  data: {
    subject_id?: number;

    syllabus: string;

    pattern: string;

    marks?: string;
  }
) {
  return request<{
    prediction: QuestionPrediction;

    sources: string[];

    note: string;
  }>(
    "/api/question-papers/predict",
    {
      method: "POST",

      body: JSON.stringify(
        data
      ),
    }
  );
}

// ============================================================
// TIMETABLE OCR
// ============================================================

export async function scanTimetable(
  file: File
) {
  const form =
    new FormData();

  /*
   * Keep the existing field name.
   * Your current backend scanner expects
   * "image".
   */
  form.append(
    "image",
    file
  );

  return request<{
    timetable: {
      entries: any[];

      warnings?: string[];

      [key: string]: any;
    };

    entry_count: number;

    warning_count: number;

    review_required: boolean;

    model: string;
  }>(
    "/api/timetable/scan",
    {
      method: "POST",

      body: form,
    }
  );
}

// ============================================================
// TIMETABLE IMPORT
// ============================================================

export async function importTimetable(
  entries: any[],

  replace_existing = false
) {
  if (!entries.length) {
    throw new Error(
      "No timetable entries available to import."
    );
  }

  console.log(
    "TIMETABLE IMPORT REQUEST:",
    {
      entries,

      replace_existing,
    }
  );

  const result =
    await request<{
      message: string;

      created: number;

      skipped: number;

      skipped_entries: any[];

      timetables: Timetable[];
    }>(
      "/api/timetable/import",
      {
        method: "POST",

        body: JSON.stringify({
          entries,

          replace_existing,
        }),
      }
    );

  console.log(
    "TIMETABLE IMPORT RESPONSE:",
    result
  );

  return result;
}

// ============================================================
// BUNK PLANNER
// ============================================================

export async function planBunk(
  data: {
    dates: string[];

    subject_ids: number[];

    minimum_percentage: number;
  }
) {
  return request<any>(
    "/api/attendance/bunk-plan",
    {
      method: "POST",

      body: JSON.stringify(
        data
      ),
    }
  );
}

// ============================================================
// EXPORT
// ============================================================

export { API_URL };

export default request;