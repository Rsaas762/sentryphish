const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(p: string) => request<T>(p, { method: "PATCH" }),
  upload: async <T>(p: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}${p}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
    return body as T;
  },
};
