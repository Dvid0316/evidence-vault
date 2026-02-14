const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });

  // If 401, clear token and redirect to login
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
    throw new Error("Authentication required");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

async function requestRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });

  // If 401, clear token and redirect to login
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
    throw new Error("Authentication required");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; role: string }; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<{ user: { id: string; email: string; role: string }; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () =>
    request<{ user: { id: string; email: string; role: string } }>("/auth/me"),

  // Users
  getUsers: () =>
    request<{ users: { id: string; email: string; createdAt: string }[] }>("/users"),

  createUser: (email: string) =>
    request<{ user: { id: string; email: string; createdAt: string } }>("/users", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Records — ownerUserId is now derived from the JWT on the server
  getRecords: (params?: { search?: string; caseId?: string; tagId?: string; status?: string }) => {
    const qp = new URLSearchParams();
    if (params?.search) qp.set("search", params.search);
    if (params?.caseId) qp.set("caseId", params.caseId);
    if (params?.tagId) qp.set("tagId", params.tagId);
    if (params?.status) qp.set("status", params.status);
    const qs = qp.toString();
    return request<{ ownerUserId: string; records: unknown[] }>(`/records${qs ? `?${qs}` : ""}`);
  },

  getRecord: (recordId: string) =>
    request<{
      id: string;
      ownerUserId: string;
      status: string;
      currentVersion: {
        id: string;
        versionNumber: number;
        contentText: string;
        eventDateText: string | null;
      };
    }>(`/records/${recordId}`),

  getVersions: (recordId: string) =>
    request<{ recordId: string; versions: unknown[] }>(`/records/${recordId}/versions`),

  createRecord: (body: { contentText: string; eventDateText?: string | null }) =>
    request<{ created: boolean; record: unknown; version: unknown }>("/records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addVersion: (recordId: string, body: { contentText: string }) =>
    request<{ created?: boolean; version?: { versionNumber: number }; [k: string]: unknown }>(
      `/records/${recordId}/versions`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  restoreVersion: (recordId: string, body: { versionId: string }) =>
    request<{ restored: boolean; recordId: string; version: unknown }>(`/records/${recordId}/restore`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  archiveRecord: (recordId: string) =>
    request<unknown>(`/records/${recordId}/archive`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  unarchiveRecord: (recordId: string) =>
    request<unknown>(`/records/${recordId}/unarchive`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getHistory: (recordId: string) =>
    request<{ recordId: string; history: unknown[] }>(`/records/${recordId}/history`),

  // Attachments
  getAttachments: (recordId: string) =>
    request<{ recordId: string; attachments: unknown[] }>(`/records/${recordId}/attachments`),

  uploadAttachment: (recordId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestRaw<{ attachment: unknown }>(`/records/${recordId}/attachments`, {
      method: "POST",
      body: formData,
    });
  },

  deleteAttachment: (attachmentId: string) =>
    request<{ deleted: boolean }>(`/attachments/${attachmentId}`, { method: "DELETE" }),

  getAttachmentDownloadUrl: (attachmentId: string) =>
    `${BASE}/attachments/${attachmentId}/download`,

  // Share links
  createShareLink: (recordId: string, expiresAt?: string) =>
    request<{ shareLink: unknown }>(`/records/${recordId}/share`, {
      method: "POST",
      body: JSON.stringify({ expiresAt: expiresAt || undefined }),
    }),

  getShareLinks: (recordId: string) =>
    request<{ recordId: string; shareLinks: unknown[] }>(`/records/${recordId}/shares`),

  revokeShareLink: (linkId: string) =>
    request<{ revoked: boolean }>(`/shares/${linkId}`, { method: "DELETE" }),

  // Exhibits — ownerUserId now derived from JWT on server
  designateExhibit: (recordId: string, body: { label?: string }) =>
    request<{ exhibit: unknown }>(`/records/${recordId}/exhibit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getRecordExhibit: (recordId: string) =>
    request<{ exhibit: unknown | null }>(`/records/${recordId}/exhibit`),

  removeExhibit: (exhibitId: string) =>
    request<{ removed: boolean }>(`/exhibits/${exhibitId}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    }),

  listExhibits: () =>
    request<{ exhibits: unknown[] }>(`/exhibits`),

  getExhibitPdfUrl: (exhibitId: string) =>
    `${BASE}/exhibits/${exhibitId}/pdf`,

  // Cases
  createCase: (body: { name: string; description?: string; caseNumber?: string }) =>
    request<{ case: unknown }>("/cases", { method: "POST", body: JSON.stringify(body) }),

  listCases: () =>
    request<{ cases: unknown[] }>("/cases"),

  getCase: (caseId: string) =>
    request<{ case: unknown }>(`/cases/${caseId}`),

  updateCase: (caseId: string, body: { name?: string; description?: string | null; caseNumber?: string | null; isActive?: boolean }) =>
    request<{ case: unknown }>(`/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) }),

  assignRecordToCase: (recordId: string, caseId: string) =>
    request<{ assigned: boolean }>(`/records/${recordId}/case`, { method: "POST", body: JSON.stringify({ caseId }) }),

  removeRecordFromCase: (recordId: string) =>
    request<{ removed: boolean }>(`/records/${recordId}/case`, { method: "DELETE", body: JSON.stringify({}) }),

  // Tags
  createTag: (body: { name: string; color?: string }) =>
    request<{ tag: unknown }>("/tags", { method: "POST", body: JSON.stringify(body) }),

  listTags: () =>
    request<{ tags: unknown[] }>("/tags"),

  deleteTagById: (tagId: string) =>
    request<{ deleted: boolean }>(`/tags/${tagId}`, { method: "DELETE", body: JSON.stringify({}) }),

  addTagToRecord: (recordId: string, tagId: string) =>
    request<{ added: boolean }>(`/records/${recordId}/tags`, { method: "POST", body: JSON.stringify({ tagId }) }),

  removeTagFromRecord: (recordId: string, tagId: string) =>
    request<{ removed: boolean }>(`/records/${recordId}/tags/${tagId}`, { method: "DELETE", body: JSON.stringify({}) }),

  getRecordTags: (recordId: string) =>
    request<{ tags: unknown[] }>(`/records/${recordId}/tags`),

  // Dashboard
  getDashboard: () =>
    request<{
      summary: { totalRecords: number; activeRecords: number; archivedRecords: number; totalExhibits: number; totalAttachments: number; totalCases: number; activeCases: number };
      recordsByCase: { caseId: string | null; caseName: string; caseNumber: string | null; count: number }[];
      recordsByTag: { tagId: string; tagName: string; tagColor: string; count: number }[];
      recentActivity: { id: string; createdAt: string; changeType: string; changeSummary: string; actorUserId: string | null; recordId: string; ipAddress: string | null }[];
      integrityStatus: { totalAttachments: number; verified: number; lastVerifiedAt: string | null };
      exhibitProgress: { exhibitCode: string; label: string | null; recordId: string; hasAttachments: boolean }[];
      timelineData: { date: string; records: number; versions: number; attachments: number }[];
    }>("/dashboard"),
};
