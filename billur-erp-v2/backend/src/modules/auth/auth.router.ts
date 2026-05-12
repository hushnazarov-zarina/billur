import { Router, Response, NextFunction } from 'express';
import { pool } from '../../shared/database/pool';
import { hashPassword, verifyPassword, generateSessionToken } from '../../shared/utils/crypto';
import { AuthRequest, BadRequest, Unauthorized } from '../../shared/types';
import { auditLog, clientIp, rateLimit } from '../../shared/middleware/security';
import { requireAuth } from '../../shared/middleware/auth';

const router = Router();
const isProd = process.env.NODE_ENV === 'production';

function buildAuthCookie(token: string, expire = false): string {
  const parts = [
    `token=${expire ? '' : token}`,
    'Path=/',
    'HttpOnly',
    expire ? 'Max-Age=0' : 'Max-Age=28800',
    `SameSite=${isProd ? 'Strict' : 'Lax'}`
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

router.post('/login', rateLimit(10, 15 * 60 * 1000), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      throw BadRequest('Login va parol kerak');
    }
    if (username.length > 64 || password.length > 256) {
      throw Unauthorized('Login yoki parol xato');
    }

    const ip = clientIp(req);
    const ua = req.headers['user-agent'] || null;

    const { rows } = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
      [username.trim()]
    );

    if (!rows.length) {
      // timing leak'ni kamaytirish
      await verifyPassword(password, 'scrypt:00:00');
      await pool.query(
        `INSERT INTO login_history (username, success, ip_address, user_agent, failure_reason)
         VALUES ($1,false,$2,$3,'no_user')`,
        [username, ip, ua]
      );
      throw Unauthorized('Login yoki parol xato');
    }

    const user = rows[0];

    if (!user.is_active) throw Unauthorized('Foydalanuvchi faol emas');
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw Unauthorized('Hisob bloklangan');
    }

    const ok = await verifyPassword(password, user.password_hash);

    if (!ok) {
      const newAttempts = user.failed_attempts + 1;
      const lockedUntil = newAttempts >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        `UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
        [newAttempts, lockedUntil, user.id]
      );
      await pool.query(
        `INSERT INTO login_history (user_id, username, success, ip_address, user_agent, failure_reason)
         VALUES ($1,$2,false,$3,$4,'wrong_password')`,
        [user.id, username, ip, ua]
      );
      throw Unauthorized('Login yoki parol xato');
    }

    // Login muvaffaqiyatli — session yaratamiz
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO sessions (token, user_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, user.id, ip, ua, expiresAt]
    );

    // Reset failed attempts, update last_login
    await pool.query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL,
                        last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
      [ip, user.id]
    );

    // Cleanup expired sessions (lazy)
    pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`).catch(() => {});

    await pool.query(
      `INSERT INTO login_history (user_id, username, success, ip_address, user_agent)
       VALUES ($1,$2,true,$3,$4)`,
      [user.id, username, ip, ua]
    );

    await auditLog({
      event_type: 'login.success',
      user_id: user.id, username,
      ip_address: ip, user_agent: ua as string
    });

    res.setHeader('Set-Cookie', buildAuthCookie(token));

    // Load permissions same way as authMiddleware so the client gets a complete picture
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

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role_id: user.role_id,
        permissions
      }
    });
  } catch (e) { next(e); }
});

router.post('/logout', async (req: AuthRequest, res: Response) => {
  const token = (req as any).cookies?.token || (req.headers['x-session-token'] as string);
  if (token) {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }
  res.setHeader('Set-Cookie', buildAuthCookie('', true));
  res.json({ ok: true });
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

router.post('/me/password', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) throw BadRequest('Eski va yangi parol kerak');
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      throw BadRequest('Yangi parol 6-128 belgi');
    }
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.user!.id]);
    if (!rows.length) throw Unauthorized();
    if (!await verifyPassword(oldPassword, rows[0].password_hash)) {
      throw Unauthorized('Eski parol noto\'g\'ri');
    }
    const newHash = await hashPassword(newPassword);
    const currentToken = (req as any).cookies?.token || (req.headers['x-session-token'] as string);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, req.user!.id]);
    // Boshqa qurilmalardagi sessionlarni yopish
    await pool.query(`DELETE FROM sessions WHERE user_id = $1 AND token != $2`,
      [req.user!.id, currentToken || '']);
    await auditLog({
      event_type: 'password.self_changed',
      user_id: req.user!.id, username: req.user!.username,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
