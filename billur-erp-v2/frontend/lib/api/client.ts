// API client — talks to /api/* (proxied to backend by next.config.mjs).
// Session token is kept in localStorage AND sent as cookie by the backend;
// we send it as x-session-token header for safety.

const TOKEN_KEY = 'billur_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else       localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  code?: string;
  constructor(msg: string, status: number, code?: string) {
    super(msg);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown, opts?: { raw?: boolean }): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['x-session-token'] = token;

  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (opts?.raw) return res as unknown as T;

  if (!res.ok) {
    let errMsg = res.statusText;
    let errCode: string | undefined;
    try {
      const j = await res.json();
      errMsg = j.error || errMsg;
      errCode = j.code;
    } catch { /* not JSON */ }
    throw new ApiError(errMsg, res.status, errCode);
  }

  // 204 / empty body
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:   <T = any>(path: string)              => request<T>('GET',    path),
  post:  <T = any>(path: string, body?: any)  => request<T>('POST',   path, body ?? {}),
  put:   <T = any>(path: string, body?: any)  => request<T>('PUT',    path, body ?? {}),
  patch: <T = any>(path: string, body?: any)  => request<T>('PATCH',  path, body ?? {}),
  del:   <T = any>(path: string)              => request<T>('DELETE', path),
  raw:   (path: string)                       => request<Response>('GET', path, undefined, { raw: true }),
};

export { ApiError };
