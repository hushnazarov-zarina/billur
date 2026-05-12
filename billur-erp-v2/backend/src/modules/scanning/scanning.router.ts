import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';
import { recordScan, overrideScan } from './scanning.service';

const router = Router();
router.use(requireAuth);

// ── Create production QR codes (typically called when an order goes to cutting) ─
router.post('/qr-codes',
  requirePermission('production.qr.create'),
  async (req: AuthRequest, res, next) => {
  try {
    const { order_id, order_item_id, model_id, color_id, size_id, quantity, qr_code } = req.body || {};
    if (!order_id || !quantity) throw BadRequest('order_id va quantity kerak');
    if (!Number.isInteger(quantity) || quantity < 1) throw BadRequest("quantity musbat butun son");

    // Generate a QR code value if not provided: BILLUR-<orderCode>-<rand>
    let code = qr_code;
    if (!code) {
      const ord = await pool.query(`SELECT external_code FROM orders WHERE id = $1`, [order_id]);
      const base = ord.rows[0]?.external_code || 'ORD';
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      code = `BILLUR-${base}-${rand}`;
    }

    const r = await pool.query(`
      INSERT INTO production_qr_codes
        (qr_code, order_id, order_item_id, model_id, color_id, size_id, quantity, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [code, order_id, order_item_id || null, model_id || null,
        color_id || null, size_id || null, quantity, req.user!.id]);

    await auditLog({
      event_type: 'production.qr.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'production_qr_code', resource_id: r.rows[0].id,
      action: 'create', after_value: r.rows[0],
      ip_address: clientIp(req),
    });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── Bulk QR generation for an order (one code per quantity unit OR per item) ──
router.post('/qr-codes/bulk',
  requirePermission('production.qr.create'),
  async (req: AuthRequest, res, next) => {
  try {
    const { order_id, mode = 'per_item' } = req.body || {};
    if (!order_id) throw BadRequest('order_id kerak');

    const items = await pool.query(`
      SELECT id, model_id, color_id, size_id, quantity
      FROM order_items WHERE order_id = $1
    `, [order_id]);

    const ordRes = await pool.query(`SELECT external_code FROM orders WHERE id = $1`, [order_id]);
    const base = ordRes.rows[0]?.external_code || 'ORD';

    const created: any[] = [];
    for (const item of items.rows) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `BILLUR-${base}-${rand}`;
      const r = await pool.query(`
        INSERT INTO production_qr_codes
          (qr_code, order_id, order_item_id, model_id, color_id, size_id, quantity, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (qr_code) DO NOTHING
        RETURNING *
      `, [code, order_id, item.id, item.model_id, item.color_id, item.size_id,
          item.quantity, req.user!.id]);
      if (r.rows[0]) created.push(r.rows[0]);
    }

    await auditLog({
      event_type: 'production.qr.bulk_create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'order', resource_id: order_id, action: 'bulk_create',
      metadata: { created_count: created.length },
      ip_address: clientIp(req),
    });
    res.json({ created: created.length, qr_codes: created });
  } catch (e) { next(e); }
});

// ── List production QR codes for an order ────────────────────────────────
router.get('/qr-codes',
  requirePermission('production.qr.create'),
  async (req, res, next) => {
  try {
    const { order_id, stage, status, q } = req.query;
    const params: any[] = [];
    const conds: string[] = [];
    if (order_id) { params.push(order_id); conds.push(`pqr.order_id = $${params.length}`); }
    if (stage)    { params.push(stage);    conds.push(`pqr.current_stage = $${params.length}`); }
    if (status)   { params.push(status);   conds.push(`pqr.status = $${params.length}`); }
    if (q)        { params.push(`%${q}%`); conds.push(`pqr.qr_code ILIKE $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT pqr.*,
             o.external_code AS order_code,
             m.code AS model_code, m.name AS model_name,
             c.name_uz AS color_name, s.code AS size_code,
             w.full_name AS current_worker_name
      FROM production_qr_codes pqr
      LEFT JOIN orders o  ON o.id = pqr.order_id
      LEFT JOIN models m  ON m.id = pqr.model_id
      LEFT JOIN colors c  ON c.id = pqr.color_id
      LEFT JOIN sizes  s  ON s.id = pqr.size_id
      LEFT JOIN workers w ON w.id = pqr.current_worker_id
      ${where}
      ORDER BY pqr.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Lookup a QR (for the scan UI before sending START/FINISH) ─────────────
router.get('/qr-codes/:qrCode',
  requirePermission('production.qr.scan'),
  async (req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT pqr.*, o.external_code AS order_code,
             m.code AS model_code, m.name AS model_name,
             c.name_uz AS color_name, s.code AS size_code,
             w.full_name AS current_worker_name
      FROM production_qr_codes pqr
      LEFT JOIN orders o  ON o.id = pqr.order_id
      LEFT JOIN models m  ON m.id = pqr.model_id
      LEFT JOIN colors c  ON c.id = pqr.color_id
      LEFT JOIN sizes  s  ON s.id = pqr.size_id
      LEFT JOIN workers w ON w.id = pqr.current_worker_id
      WHERE pqr.qr_code = $1
    `, [req.params.qrCode]);
    if (!r.rows.length) throw NotFound();
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── THE MAIN SCAN ENDPOINT ────────────────────────────────────────────────
router.post('/scan',
  requirePermission('production.qr.scan'),
  async (req: AuthRequest, res, next) => {
  try {
    const result = await recordScan({
      qr_code: req.body?.qr_code,
      worker_id: req.body?.worker_id,
      stage: req.body?.stage,
      action: req.body?.action,
      device_id: req.body?.device_id || req.headers['x-device-id'] as string,
      ip_address: clientIp(req),
      quality: req.body?.quality,
      notes: req.body?.notes,
    });

    await auditLog({
      event_type: `production.scan.${result.action.toLowerCase()}`,
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'production_qr_code', resource_id: result.qr_code_id,
      action: result.action,
      metadata: {
        stage: result.current_stage,
        next_stage: result.next_stage,
        worker_id: req.body.worker_id,
        is_suspicious: result.is_suspicious,
        suspicious_reason: result.suspicious_reason,
        duration_seconds: result.duration_seconds,
      },
      ip_address: clientIp(req),
    });

    res.json(result);
  } catch (e) { next(e); }
});

// ── Override (admin force-release lock) ───────────────────────────────────
router.post('/qr-codes/:id/override',
  requirePermission('production.qr.override'),
  async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason || reason.length < 5) throw BadRequest("'reason' kerak (kamida 5 belgi)");
    const r = await overrideScan({
      qr_code_id: req.params.id,
      override_by: req.user!.id,
      reason,
    });

    await auditLog({
      event_type: 'production.scan.override',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'production_qr_code', resource_id: req.params.id,
      action: 'override', metadata: { reason },
      ip_address: clientIp(req),
    });
    res.json(r);
  } catch (e) { next(e); }
});

// ── Scan history for a single QR code (Traceability) ─────────────────────
router.get('/qr-codes/:id/trace',
  requirePermission('production.trace.view'),
  async (req, res, next) => {
  try {
    const qr = await pool.query(`
      SELECT pqr.*, o.external_code AS order_code, o.order_type, o.client_id,
             cl.name AS client_name,
             m.code AS model_code, m.name AS model_name,
             c.name_uz AS color_name, s.code AS size_code
      FROM production_qr_codes pqr
      LEFT JOIN orders o   ON o.id = pqr.order_id
      LEFT JOIN clients cl ON cl.id = o.client_id
      LEFT JOIN models m   ON m.id = pqr.model_id
      LEFT JOIN colors c   ON c.id = pqr.color_id
      LEFT JOIN sizes s    ON s.id = pqr.size_id
      WHERE pqr.id = $1 OR pqr.qr_code = $1
    `, [req.params.id]);
    if (!qr.rows.length) throw NotFound();

    const scans = await pool.query(`
      SELECT pss.*, w.full_name AS worker_name, w.employee_code,
             ob.full_name AS override_by_name
      FROM production_stage_scans pss
      LEFT JOIN workers w ON w.id = pss.worker_id
      LEFT JOIN users ob  ON ob.id = pss.override_by
      WHERE pss.qr_code_id = $1
      ORDER BY pss.start_scan_at ASC
    `, [qr.rows[0].id]);

    const quality = await pool.query(`
      SELECT qd.*, w.full_name AS checked_by_name,
             rw.full_name AS responsible_worker_name
      FROM quality_decisions qd
      LEFT JOIN workers w  ON w.id = qd.checked_by
      LEFT JOIN workers rw ON rw.id = qd.responsible_worker_id
      WHERE qd.qr_code_id = $1
      ORDER BY qd.created_at ASC
    `, [qr.rows[0].id]);

    res.json({
      qr: qr.rows[0],
      scans: scans.rows,
      quality_decisions: quality.rows,
    });
  } catch (e) { next(e); }
});

// ── Trace by external box number (mahsulot qaysi boxdan kelgan) ──────────
router.get('/trace/by-box/:boxUid',
  requirePermission('production.trace.view'),
  async (req, res, next) => {
  try {
    // boxes can hold multiple items; we return all QR codes that are in this box
    const box = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [req.params.boxUid]);
    if (!box.rows.length) throw NotFound();
    // For now: return box meta. (Linking boxes to QR codes is in Stage C / BoxApp sync.)
    res.json({ box: box.rows[0], qr_codes: [] });
  } catch (e) { next(e); }
});

// ── List suspicious scans (admin) ────────────────────────────────────────
router.get('/scans/suspicious',
  requirePermission('production.qr.override'),
  async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT pss.*, w.full_name AS worker_name, w.employee_code,
             pqr.qr_code, o.external_code AS order_code
      FROM production_stage_scans pss
      LEFT JOIN workers w ON w.id = pss.worker_id
      LEFT JOIN production_qr_codes pqr ON pqr.id = pss.qr_code_id
      LEFT JOIN orders o ON o.id = pqr.order_id
      WHERE pss.is_suspicious = true
      ORDER BY pss.start_scan_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Current open scans per worker (for "what am I working on?") ──────────
router.get('/scans/active',
  requirePermission('production.qr.scan'),
  async (req, res, next) => {
  try {
    const { worker_id } = req.query;
    const params: any[] = [];
    let where = `WHERE pss.status = 'started'`;
    if (worker_id) { params.push(worker_id); where += ` AND pss.worker_id = $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT pss.*, pqr.qr_code, pqr.quantity,
             o.external_code AS order_code,
             m.code AS model_code, c.name_uz AS color_name, s.code AS size_code,
             w.full_name AS worker_name, w.employee_code,
             EXTRACT(EPOCH FROM (NOW() - pss.start_scan_at))::int AS elapsed_seconds
      FROM production_stage_scans pss
      JOIN production_qr_codes pqr ON pqr.id = pss.qr_code_id
      JOIN workers w ON w.id = pss.worker_id
      LEFT JOIN orders o ON o.id = pqr.order_id
      LEFT JOIN models m ON m.id = pqr.model_id
      LEFT JOIN colors c ON c.id = pqr.color_id
      LEFT JOIN sizes s  ON s.id = pqr.size_id
      ${where}
      ORDER BY pss.start_scan_at DESC
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
