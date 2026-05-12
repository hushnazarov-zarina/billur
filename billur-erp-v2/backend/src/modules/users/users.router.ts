import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { hashPassword } from '../../shared/utils/crypto';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('users.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, username, full_name, role_id, phone, email,
             is_active, last_login_at, created_at
      FROM users
      WHERE deleted_at IS NULL
      ORDER BY username
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('users.create'), async (req: AuthRequest, res, next) => {
  try {
    const { username, password, role_id, full_name, phone, email } = req.body || {};
    if (!username || !password || !role_id || !full_name) throw BadRequest('Maydonlar to\'liq emas');
    if (!/^[a-zA-Z0-9_.-]{2,64}$/.test(username)) throw BadRequest('Username noto\'g\'ri');
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      throw BadRequest('Parol 6-128 belgi');
    }
    const dup = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
    if (dup.rows.length) throw Conflict('Bu username band');
    const role = await pool.query(`SELECT 1 FROM roles WHERE id = $1`, [role_id]);
    if (!role.rows.length) throw BadRequest('Noto\'g\'ri rol');

    const hash = await hashPassword(password);
    const { rows } = await pool.query(`
      INSERT INTO users (username, password_hash, role_id, full_name, phone, email)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, username, full_name, role_id, phone, email
    `, [username, hash, role_id, full_name, phone || null, email || null]);

    await auditLog({
      event_type: 'user.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'user', resource_id: rows[0].id, action: 'create',
      after_value: rows[0], ip_address: clientIp(req)
    });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('users.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, username, full_name, role_id, phone, email,
             is_active, last_login_at, created_at
      FROM users WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);
    if (!rows.length) throw NotFound();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('users.update'), async (req: AuthRequest, res, next) => {
  try {
    const { full_name, phone, email, is_active, role_id } = req.body || {};
    const sel = await pool.query(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!sel.rows.length) throw NotFound();

    await pool.query(`
      UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        is_active = COALESCE($4, is_active),
        role_id = COALESCE($5, role_id),
        updated_at = NOW()
      WHERE id = $6
    `, [full_name, phone, email, is_active, role_id, req.params.id]);

    await auditLog({
      event_type: 'user.update',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'user', resource_id: req.params.id, action: 'update',
      before_value: sel.rows[0], after_value: req.body,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/:id/password', requirePermission('users.update'), async (req: AuthRequest, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
      throw BadRequest('Parol 6-128 belgi');
    }
    const hash = await hashPassword(password);
    const r = await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
      [hash, req.params.id]);
    if (!r.rowCount) throw NotFound();
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [req.params.id]);
    await auditLog({
      event_type: 'user.password_reset',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'user', resource_id: req.params.id,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('users.delete'), async (req: AuthRequest, res, next) => {
  try {
    const sel = await pool.query(`SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!sel.rows.length) throw NotFound();
    if (sel.rows[0].username === 'admin') throw BadRequest('Admin o\'chirilmaydi');
    await pool.query(`UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [req.params.id]);
    await auditLog({
      event_type: 'user.delete',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'user', resource_id: req.params.id,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/_meta/roles', requirePermission('users.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM roles ORDER BY id`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/_meta/permissions', requirePermission('users.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM permissions ORDER BY resource, action`);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
