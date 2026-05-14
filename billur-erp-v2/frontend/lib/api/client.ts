// API client — talks to backend API.
// Session token is kept in localStorage AND sent as cookie by the backend;
// we also send it as x-session-token header for safety.

const TOKEN_KEY = 'billur_token';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://crm-ui-zoee.onrender.com';

function buildUrl(path: string): string {
  // If full URL is already provided, use it directly
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Make sure path always starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Prevent double slash between base URL and path
  return `${API_BASE_URL.replace(/\/$/, '')}${cleanPath}`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(msg: string, status: number, code?: string) {
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { raw?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();

  if (token) {
    headers['x-session-token'] = token;
  }

  const res = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (opts?.raw) {
    return res as unknown as T;
  }

  if (!res.ok) {
    let errMsg = res.statusText || `HTTP ${res.status}`;
    let errCode: string | undefined;

    try {
      const j = await res.json();
      errMsg = j.error || j.message || errMsg;
      errCode = j.code;
    } catch {
      // Response is not JSON
    }

    throw new ApiError(errMsg, res.status, errCode);
  }

  // 204 / empty body
  if (res.status === 204) {
    return undefined as T;
  }

  const ctype = res.headers.get('content-type') || '';

  if (!ctype.includes('application/json')) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T = any>(path: string) =>
    request<T>('GET', path),

  post: <T = any>(path: string, body?: any) =>
    request<T>('POST', path, body ?? {}),

  put: <T = any>(path: string, body?: any) =>
    request<T>('PUT', path, body ?? {}),

  patch: <T = any>(path: string, body?: any) =>
    request<T>('PATCH', path, body ?? {}),

  del: <T = any>(path: string) =>
    request<T>('DELETE', path),

  raw: (path: string) =>
    request<Response>('GET', path, undefined, { raw: true }),
};

export { ApiError };
