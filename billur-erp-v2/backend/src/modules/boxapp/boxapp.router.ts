import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';
import { processJob, processQueue } from './boxapp.service';

const router = Router();
router.use(requireAuth);

// ── Sync job queue inspection ────────────────────────────────────────────
router.get('/jobs', requirePermission('boxapp.view'), async (req, res, next) => {
  try {
    const { status, entity_type, limit = '100' } = req.query;
    const params: any[] = [];
    const conds: string[] = [];
    if (status) { params.push(status); conds.push(`sync_status = $${params.length}`); }
    if (entity_type) { params.push(entity_type); conds.push(`entity_type = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT * FROM boxapp_sync_jobs
      ${where}
      ORDER BY created_at DESC
      LIMIT ${Math.min(parseInt(String(limit), 10) || 100, 500)}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/jobs/_stats', requirePermission('boxapp.view'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT sync_status, COUNT(*)::int AS count
      FROM boxapp_sync_jobs
      GROUP BY sync_status
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Manual retry of a single job ─────────────────────────────────────────
router.post('/jobs/:id/retry',
  requirePermission('boxapp.retry'),
  async (req: AuthRequest, res, next) => {
  try {
    // Reset to pending immediately so it gets picked up
    await pool.query(`
      UPDATE boxapp_sync_jobs SET sync_status = 'pending', next_retry_at = NOW()
      WHERE id = $1
    `, [req.params.id]);

    const ok = await processJob(req.params.id);

    await auditLog({
      event_type: 'boxapp.retry',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'boxapp_sync_job', resource_id: req.params.id,
      action: 'retry', metadata: { ok }, ip_address: clientIp(req),
    });
    res.json({ ok });
  } catch (e) { next(e); }
});

// ── Manual flush (process queue now) ─────────────────────────────────────
router.post('/jobs/_flush',
  requirePermission('boxapp.sync'),
  async (req: AuthRequest, res, next) => {
  try {
    const r = await processQueue(50);
    await auditLog({
      event_type: 'boxapp.flush',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'boxapp_sync_job', resource_id: 'queue',
      action: 'flush', metadata: r, ip_address: clientIp(req),
    });
    res.json(r);
  } catch (e) { next(e); }
});

// ── Cancel a stuck job ──────────────────────────────────────────────────
router.post('/jobs/:id/cancel',
  requirePermission('boxapp.retry'),
  async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      UPDATE boxapp_sync_jobs SET sync_status = 'cancelled' WHERE id = $1
      RETURNING *
    `, [req.params.id]);
    if (!r.rowCount) throw NotFound();
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

export default router;
