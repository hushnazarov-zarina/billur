import { Response, NextFunction } from 'express';
import { pool } from '../database/pool';
import { AuthRequest, Unauthorized, Forbidden } from '../types';

const SESSION_TTL_HOURS = 8;

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = (req.headers['x-session-token'] as string) || req.cookies?.token;

  if (!token || typeof token !== 'string' || !/^[a-f0-9]{32,128}$/i.test(token)) {
    req.user = undefined;
    return next();
  }

  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.is_active
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
        AND s.expires_at > NOW()
        AND u.deleted_at IS NULL
        AND u.is_active = true
    `, [token]);

    if (!rows.length) {
      req.user = undefined;
      return next();
    }

    const user = rows[0];

    // Load permissions: role + overrides
    const permsRes = await pool.query(`
      SELECT permission_id, true AS granted FROM role_permissions WHERE role_id = $1
      UNION
      SELECT permission_id, granted FROM user_permission_overrides WHERE user_id = $2
    `, [user.role_id, user.id]);

    const granted = new Set<string>();
    const revoked = new Set<string>();
    for (const p of permsRes.rows) {
      if (p.granted) granted.add(p.permission_id);
      else revoked.add(p.permission_id);
    }
    const permissions = Array.from(granted).filter(p => !revoked.has(p));

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role_id: user.role_id,
      permissions
    };

    // Touch session (sliding window)
    pool.query(`UPDATE sessions SET last_seen_at = NOW() WHERE token = $1`, [token])
      .catch(() => {});

    next();
  } catch (e) {
    console.error('authMiddleware error:', e);
    req.user = undefined;
    next();
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) throw Unauthorized();
  next();
}

export function requirePermission(...perms: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw Unauthorized();
    const userPerms = new Set(req.user.permissions);
    const has = perms.every(p => userPerms.has(p));
    if (!has) throw Forbidden(`Ruxsat yo'q: ${perms.join(', ')}`);
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw Unauthorized();
    if (!roles.includes(req.user.role_id)) throw Forbidden();
    next();
  };
}
