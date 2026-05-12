import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

export function cookieParser(req: AuthRequest, res: Response, next: NextFunction) {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    const k = p.slice(0, idx).trim();
    const v = decodeURIComponent(p.slice(idx + 1).trim());
    if (k) cookies[k] = v;
  });
  (req as any).cookies = cookies;
  next();
}

export function securityHeaders(isProd: boolean) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    res.setHeader('X-XSS-Protection', '0');
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

export function corsMiddleware(allowedOrigins: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function clientIp(req: AuthRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Rate limiter (in-memory; production'da Redis bilan almashtirish kerak)
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxPerWindow: number, windowMs: number) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const key = `${clientIp(req)}:${req.path}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > maxPerWindow) {
      res.status(429).json({ error: 'Juda ko\'p urinish, biroz kutib turing' });
      return;
    }
    next();
  };
}

// Audit log helper
import { pool } from '../database/pool';

export async function auditLog(opts: {
  event_type: string;
  user_id?: string | null;
  username?: string | null;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  before_value?: any;
  after_value?: any;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
}) {
  try {
    await pool.query(`
      INSERT INTO audit_logs (event_type, user_id, username, resource_type, resource_id,
                              action, before_value, after_value, ip_address, user_agent, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      opts.event_type, opts.user_id || null, opts.username || null,
      opts.resource_type || null, opts.resource_id || null, opts.action || null,
      opts.before_value ? JSON.stringify(opts.before_value) : null,
      opts.after_value ? JSON.stringify(opts.after_value) : null,
      opts.ip_address || null, opts.user_agent || null,
      opts.metadata ? JSON.stringify(opts.metadata) : null
    ]);
  } catch (e) {
    console.error('audit log error:', e);
  }
}
