import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

const VALID_POSITIONS = [
  'cutting', 'printing', 'sewing', 'quality',
  'ironing', 'packing', 'boxing', 'warehouse', 'other'
];

router.get('/', requirePermission('workers.read'), async (req, res, next) => {
  try {
    const { stage, position, active } = req.query;
    const params: any[] = [];
    const conds: string[] = [`w.deleted_at IS NULL`];

    if (stage)    { params.push(stage);    conds.push(`w.default_stage = $${params.length}`); }
    if (position) { params.push(position); conds.push(`w.position = $${params.length}`); }
    if (active === 'true')  conds.push(`w.is_active = true`);
    if (active === 'false') conds.push(`w.is_active = false`);

    const { rows } = await pool.query(`
      SELECT w.*,
        ps.name_uz AS default_stage_name,
        (SELECT COUNT(*)::int FROM qr_scans s
           WHERE s.worker_id = w.id AND s.scanned_at > NOW() - INTERVAL '7 days') AS scans_7d,
        (SELECT MAX(s.scanned_at) FROM qr_scans s WHERE s.worker_id = w.id) AS last_scan_at,
        EXISTS(SELECT 1 FROM worker_qr_tokens t
                WHERE t.worker_id = w.id AND t.is_active = true) AS has_active_qr
      FROM workers w
      LEFT JOIN production_stages ps ON ps.id = w.default_stage
      WHERE ${conds.join(' AND ')}
      ORDER BY w.full_name
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('workers.create'), async (req: AuthRequest, res, next) => {
  try {
    const { employee_code, full_name, phone, position, default_stage,
            hire_date, photo_url, notes } = req.body || {};

    if (!employee_code || !full_name || !position) {
      throw BadRequest('Tabel raqami, F.I.O. va lavozim kerak');
    }
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(employee_code)) {
      throw BadRequest('Tabel raqami: 2-32 belgi, A-Z 0-9 _ -');
    }
    if (!VALID_POSITIONS.includes(position)) {
      throw BadRequest(`Noto'g'ri lavozim. Ruxsat etilgan: ${VALID_POSITIONS.join(', ')}`);
    }
    if (default_stage) {
      const stg = await pool.query(`SELECT 1 FROM production_stages WHERE id = $1 AND is_active`, [default_stage]);
      if (!stg.rows.length) throw BadRequest("Noto'g'ri bosqich");
    }
    const dup = await pool.query(`SELECT 1 FROM workers WHERE employee_code = $1`, [employee_code]);
    if (dup.rows.length) throw Conflict('Bu tabel raqami band');

    const { rows } = await pool.query(`
      INSERT INTO workers (employee_code, full_name, phone, position, default_stage,
                           hire_date, photo_url, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [employee_code, full_name, phone || null, position, default_stage || null,
        hire_date || null, photo_url || null, notes || null]);

    await auditLog({
      event_type: 'worker.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker', resource_id: rows[0].id, action: 'create',
      after_value: rows[0], ip_address: clientIp(req)
    });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('workers.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT w.*, ps.name_uz AS default_stage_name
      FROM workers w
      LEFT JOIN production_stages ps ON ps.id = w.default_stage
      WHERE w.id = $1 AND w.deleted_at IS NULL
    `, [req.params.id]);
    if (!rows.length) throw NotFound();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('workers.update'), async (req: AuthRequest, res, next) => {
  try {
    const { full_name, phone, position, default_stage,
            hire_date, photo_url, notes, is_active } = req.body || {};

    const sel = await pool.query(`SELECT * FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]);
    if (!sel.rows.length) throw NotFound();

    if (position && !VALID_POSITIONS.includes(position)) {
      throw BadRequest(`Noto'g'ri lavozim. Ruxsat etilgan: ${VALID_POSITIONS.join(', ')}`);
    }
    if (default_stage) {
      const stg = await pool.query(`SELECT 1 FROM production_stages WHERE id = $1 AND is_active`, [default_stage]);
      if (!stg.rows.length) throw BadRequest("Noto'g'ri bosqich");
    }

    await pool.query(`
      UPDATE workers SET
        full_name      = COALESCE($1, full_name),
        phone          = COALESCE($2, phone),
        position       = COALESCE($3, position),
        default_stage  = COALESCE($4, default_stage),
        hire_date      = COALESCE($5, hire_date),
        photo_url      = COALESCE($6, photo_url),
        notes          = COALESCE($7, notes),
        is_active      = COALESCE($8, is_active)
      WHERE id = $9
    `, [full_name, phone, position, default_stage, hire_date,
        photo_url, notes, is_active, req.params.id]);

    await auditLog({
      event_type: 'worker.update',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker', resource_id: req.params.id, action: 'update',
      before_value: sel.rows[0], after_value: req.body,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('workers.delete'), async (req: AuthRequest, res, next) => {
  try {
    const sel = await pool.query(`SELECT 1 FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]);
    if (!sel.rows.length) throw NotFound();

    await pool.query('BEGIN');
    // Soft delete worker
    await pool.query(`UPDATE workers SET deleted_at = NOW(), is_active = false WHERE id = $1`,
      [req.params.id]);
    // Revoke all QR tokens — old badges are now dead
    await pool.query(`UPDATE worker_qr_tokens SET is_active = false WHERE worker_id = $1`,
      [req.params.id]);
    await pool.query('COMMIT');

    await auditLog({
      event_type: 'worker.delete',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker', resource_id: req.params.id, action: 'delete',
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    next(e);
  }
});

// Worker's recent scans — for the detail panel
router.get('/:id/scans', requirePermission('workers.read'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const { rows } = await pool.query(`
      SELECT s.id, s.stage, s.qty, s.scan_type, s.is_suspicious,
             s.suspicious_reason, s.scanned_at, s.order_item_id,
             ps.name_uz AS stage_name,
             o.external_code AS order_code, o.order_type
      FROM qr_scans s
      LEFT JOIN production_stages ps ON ps.id = s.stage
      LEFT JOIN order_items oi ON oi.id = s.order_item_id
      LEFT JOIN orders o ON o.id = oi.order_id
      WHERE s.worker_id = $1
      ORDER BY s.scanned_at DESC
      LIMIT $2
    `, [req.params.id, limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Active QR token info (no token text — only metadata)
router.get('/:id/qr', requirePermission('workers.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT issued_at, expires_at, is_active
      FROM worker_qr_tokens
      WHERE worker_id = $1
      ORDER BY issued_at DESC
      LIMIT 5
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
