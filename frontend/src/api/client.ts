import type {
  Company,
  Interview,
  Metrics,
  ReplanResult,
  Room,
  StateSummary,
  Student,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  resetDataset: () =>
    request<{ generated: unknown; scheduled: unknown }>("/api/dataset/reset", { method: "POST" }),

  stateSummary: () => request<StateSummary>("/api/state/summary"),
  metrics: () => request<Metrics>("/api/metrics"),

  companies: () => request<Company[]>("/api/companies"),
  company: (id: number) => request<Company & { interviews: Interview[] }>(`/api/companies/${id}`),
  panels: (companyId?: number) => request<import("./types").Panel[]>(`/api/panels${queryString({ company_id: companyId })}`),

  rooms: () => request<Room[]>("/api/rooms"),

  students: (q?: string) => request<Student[]>(`/api/students${queryString({ q })}`),
  student: (id: number) => request<Student & { interviews: Interview[] }>(`/api/students/${id}`),

  interviews: (params: Record<string, string | number | undefined> = {}) =>
    request<Interview[]>(`/api/interviews${queryString(params)}`),

  conflicts: (day?: number) => request<Interview[]>(`/api/conflicts${queryString({ day })}`),

  disruptCompanyDelay: (companyId: number, delayHours: number) =>
    request<ReplanResult>("/api/disrupt/company-delay", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId, delay_hours: delayHours }),
    }),
  disruptPanelDropout: (panelId: number) =>
    request<ReplanResult>("/api/disrupt/panel-dropout", {
      method: "POST",
      body: JSON.stringify({ panel_id: panelId }),
    }),
  disruptStudentWithdrawal: (studentId: number) =>
    request<ReplanResult>("/api/disrupt/student-withdrawal", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    }),
  disruptRoomUnavailable: (roomId: number) =>
    request<ReplanResult>("/api/disrupt/room-unavailable", {
      method: "POST",
      body: JSON.stringify({ room_id: roomId }),
    }),
};
