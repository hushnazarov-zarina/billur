import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Forbidden } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

/** Returns the worker linked to the current user (if any). */
async function workerForUser(userId: string) {
  const r = await pool.query(`SELECT id FROM workers WHERE user_id = $1`, [userId]);
  return r.rows[0]?.id as string | undefined;
}

function canSeeWorker(req: AuthRequest, workerUserId: string | null): boolean {
  if (req.user!.permissions.includes('workers.view_all')) return true;
  return workerUserId === req.user!.id;
}

// ── My profile (current user's worker record) ────────────────────────────
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      SELECT w.*, ps.name_uz AS default_stage_name
      FROM workers w
      LEFT JOIN production_stages ps ON ps.id = w.default_stage
      WHERE w.user_id = $1 AND w.deleted_at IS NULL
    `, [req.user!.id]);
    if (!r.rows.length) return res.json(null);
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── My productivity summary (current month) ──────────────────────────────
router.get('/me/productivity', async (req: AuthRequest, res, next) => {
  try {
    const wid = await workerForUser(req.user!.id);
    if (!wid) return res.json({ items: [], total_quantity: 0, total_scans: 0 });

    const { rows } = await pool.query(`
      SELECT pss.stage, ps.name_uz AS stage_name,
             COUNT(*)::int AS scans,
             COALESCE(SUM(pqr.quantity), 0)::int AS total_quantity,
             COALESCE(AVG(pss.duration_seconds), 0)::int AS avg_duration_seconds
      FROM production_stage_scans pss
      JOIN production_qr_codes pqr ON pqr.id = pss.qr_code_id
      LEFT JOIN production_stages ps ON ps.id = pss.stage
      WHERE pss.worker_id = $1 AND pss.status = 'finished'
        AND pss.finish_scan_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY pss.stage, ps.name_uz
    `, [wid]);

    const totalQty = rows.reduce((a, r) => a + Number(r.total_quantity), 0);
    const totalScans = rows.reduce((a, r) => a + Number(r.scans), 0);
    res.json({ items: rows, total_quantity: totalQty, total_scans: totalScans });
  } catch (e) { next(e); }
});

// ── My recent finished scans (last 50) ───────────────────────────────────
router.get('/me/scans', async (req: AuthRequest, res, next) => {
  try {
    const wid = await workerForUser(req.user!.id);
    if (!wid) return res.json([]);

    const { rows } = await pool.query(`
      SELECT pss.*, pqr.qr_code, pqr.quantity,
             o.external_code AS order_code,
             m.code AS model_code, c.name_uz AS color_name, s.code AS size_code,
             ps.name_uz AS stage_name
      FROM production_stage_scans pss
      JOIN production_qr_codes pqr ON pqr.id = pss.qr_code_id
      LEFT JOIN orders o ON o.id = pqr.order_id
      LEFT JOIN models m ON m.id = pqr.model_id
      LEFT JOIN colors c ON c.id = pqr.color_id
      LEFT JOIN sizes s  ON s.id = pqr.size_id
      LEFT JOIN production_stages ps ON ps.id = pss.stage
      WHERE pss.worker_id = $1
      ORDER BY pss.start_scan_at DESC
      LIMIT 50
    `, [wid]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Get specific worker profile (admin OR self) ──────────────────────────
router.get('/:id/profile', async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      SELECT w.*, ps.name_uz AS default_stage_name,
             u.username, u.role_id, u.last_login_at
      FROM workers w
      LEFT JOIN production_stages ps ON ps.id = w.default_stage
      LEFT JOIN users u  ON u.id = w.user_id
      WHERE w.id = $1 AND w.deleted_at IS NULL
    `, [req.params.id]);
    if (!r.rows.length) throw NotFound();

    if (!canSeeWorker(req, r.rows[0].user_id)) throw Forbidden();
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── Update profile fields (admin or self for limited fields) ─────────────
router.put('/:id/profile', async (req: AuthRequest, res, next) => {
  try {
    const sel = await pool.query(`SELECT user_id FROM workers WHERE id = $1`, [req.params.id]);
    if (!sel.rows.length) throw NotFound();

    const isAdmin = req.user!.permissions.includes('workers.update');
    const isSelf = sel.rows[0].user_id === req.user!.id;
    if (!isAdmin && !isSelf) throw Forbidden();

    const b = req.body || {};
    const allowedSelf = ['phone', 'address', 'photo_url', 'emergency_contact'];
    const allowedAdmin = [
      ...allowedSelf,
      'full_name', 'position', 'default_stage', 'birth_date', 'gender',
      'passport_series', 'passport_number', 'passport_issued_by',
      'passport_issue_date', 'passport_expiry_date', 'pinfl',
      'bank_card', 'contract_type', 'base_salary', 'hired_at',
    ];
    const allowed = isAdmin ? allowedAdmin : allowedSelf;

    const updates: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (b[k] !== undefined) { params.push(b[k]); updates.push(`${k} = $${params.length}`); }
    }
    if (!updates.length) return res.json({ ok: true, message: 'No-op' });

    params.push(req.params.id);
    const r = await pool.query(`
      UPDATE workers SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    await auditLog({
      event_type: 'worker.profile.update',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker', resource_id: req.params.id,
      action: 'update', after_value: req.body, ip_address: clientIp(req),
    });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── Documents ────────────────────────────────────────────────────────────
router.get('/:id/documents', async (req: AuthRequest, res, next) => {
  try {
    const sel = await pool.query(`SELECT user_id FROM workers WHERE id = $1`, [req.params.id]);
    if (!sel.rows.length) throw NotFound();

    const canViewAll = req.user!.permissions.includes('workers.documents.view_all');
    const isSelf = sel.rows[0].user_id === req.user!.id;
    if (!canViewAll && !isSelf) throw Forbidden();

    const { rows } = await pool.query(`
      SELECT wd.*, u.full_name AS uploaded_by_name
      FROM worker_documents wd
      LEFT JOIN users u ON u.id = wd.uploaded_by
      WHERE wd.worker_id = $1
      ORDER BY wd.uploaded_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/:id/documents',
  requirePermission('workers.documents.upload'),
  async (req: AuthRequest, res, next) => {
  try {
    const { document_type, file_name, file_path, file_size, mime_type,
            issued_date, expiry_date, notes } = req.body || {};
    if (!document_type || !file_name || !file_path) {
      throw BadRequest('document_type, file_name, file_path kerak');
    }

    const r = await pool.query(`
      INSERT INTO worker_documents
        (worker_id, document_type, file_name, file_path, file_size, mime_type,
         issued_date, expiry_date, notes, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10)
      RETURNING *
    `, [
      req.params.id, document_type, file_name, file_path, file_size || null,
      mime_type || null, issued_date || null, expiry_date || null,
      notes || null, req.user!.id,
    ]);

    await auditLog({
      event_type: 'worker.document.upload',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker_document', resource_id: r.rows[0].id,
      action: 'create', metadata: { worker_id: req.params.id, document_type },
      ip_address: clientIp(req),
    });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:workerId/documents/:docId',
  requirePermission('workers.documents.view_all'),
  async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      DELETE FROM worker_documents WHERE id = $1 AND worker_id = $2 RETURNING *
    `, [req.params.docId, req.params.workerId]);
    if (!r.rowCount) throw NotFound();

    await auditLog({
      event_type: 'worker.document.delete',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker_document', resource_id: req.params.docId,
      action: 'delete', before_value: r.rows[0], ip_address: clientIp(req),
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
