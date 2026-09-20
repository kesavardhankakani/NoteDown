const API = "http://localhost:5000/api";

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  department_id: number | null;
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
};

export type Resource = {
  id: number;
  title: string;
  description?: string;
  resource_type: string;
  file_name: string;
  file_size?: number;
  downloads: number;
  is_published: boolean;
  subject_id: number;
  uploaded_by: number;
  subject?: Subject;
  created_at: string;
};

export async function api(
  path: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem("notedown_token");

  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(API + path, {
    ...options,
    headers,
  });

  const text = await res.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text || "Server returned an invalid response",
    };
  }

  if (!res.ok) {
    throw new Error(
      data.message ||
        data.error ||
        data.msg ||
        `Request failed (${res.status})`
    );
  }

  return data;
}

/* =========================
   AUTH
========================= */

export const login = (
  email: string,
  password: string
) =>
  api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

export const register = (
  name: string,
  email: string,
  password: string,
  department_id: number | null
) =>
  api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      department_id,
    }),
  });

/* =========================
   DEPARTMENTS
========================= */

export const departments = () =>
  api("/departments");

export const createDepartment = (
  name: string,
  code: string,
  description = ""
) =>
  api("/departments", {
    method: "POST",
    body: JSON.stringify({
      name,
      code,
      description,
    }),
  });

export const renameDepartment = (
  id: number,
  name: string,
  code?: string,
  description?: string
) =>
  api(`/departments/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name,
      ...(code !== undefined && { code }),
      ...(description !== undefined && { description }),
    }),
  });

/* =========================
   SUBJECTS
========================= */

export const subjects = (
  department_id?: number
) => {
  const query = department_id
    ? `?department_id=${department_id}`
    : "";

  return api("/subjects" + query);
};

export const createSubject = (
  name: string,
  code: string,
  semester: number,
  year: number,
  department_id: number
) =>
  api("/subjects", {
    method: "POST",
    body: JSON.stringify({
      name,
      code,
      semester,
      year,
      department_id,
    }),
  });

export const renameSubject = (
  id: number,
  name: string,
  code?: string,
  semester?: number,
  year?: number
) =>
  api(`/subjects/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name,
      ...(code !== undefined && { code }),
      ...(semester !== undefined && { semester }),
      ...(year !== undefined && { year }),
    }),
  });

export const deleteSubject = (
  id: number
) =>
  api(`/subjects/${id}`, {
    method: "DELETE",
  });

/* =========================
   RESOURCES
========================= */

export const resources = (
  subject_id?: number,
  search = ""
) => {
  const params = new URLSearchParams();

  if (subject_id) {
    params.set(
      "subject_id",
      String(subject_id)
    );
  }

  if (search) {
    params.set("search", search);
  }

  const query = params.toString();

  return api(
    "/resources" +
      (query ? `?${query}` : "")
  );
};

export const uploadResource = (
  formData: FormData
) =>
  api("/resources", {
    method: "POST",
    body: formData,
  });

export const deleteResource = (
  id: number
) =>
  api(`/resources/${id}`, {
    method: "DELETE",
  });

export const renameResource = (
  id: number,
  title: string,
  description?: string
) =>
  api(`/resources/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title,
      ...(description !== undefined && {
        description,
      }),
    }),
  });

/* =========================
   FAVORITES
========================= */

export const favorites = () =>
  api("/favorites");

export const toggleFavorite = (
  id: number,
  remove = false
) =>
  api(`/favorites/${id}`, {
    method: remove ? "DELETE" : "POST",
  });

/* =========================
   DOWNLOAD HISTORY
========================= */

export const history = () =>
  api("/history");

/* =========================
   DOWNLOAD RESOURCE
========================= */

export const download = async (
  id: number,
  filename: string
) => {
  const token = localStorage.getItem(
    "notedown_token"
  );

  const res = await fetch(
    `${API}/resources/${id}/download`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    let message = "Download failed";

    try {
      const data = await res.json();

      message =
        data.message ||
        data.error ||
        data.msg ||
        message;
    } catch {}

    throw new Error(message);
  }

  const blob = await res.blob();

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
};