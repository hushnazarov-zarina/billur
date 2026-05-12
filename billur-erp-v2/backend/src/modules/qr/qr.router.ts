import { Router } from 'express';
import QRCode from 'qrcode';
import { pool, withTransaction } from '../../shared/database/pool';
import { generateQrToken, validateQrToken } from '../../shared/utils/crypto';
import { AuthRequest, BadRequest, NotFound, Forbidden } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp, rateLimit } from '../../shared/middleware/security';
import { recordProductionEvent } from '../production/production.events';

const router = Router();
router.use(requireAuth);

const TOKEN_TTL_DAYS = 365;
const DUPLICATE_WINDOW_SECONDS = 10;

// ── Generate / regenerate a worker's QR token ──────────────────────────────
router.post('/generate/:workerId',
  requirePermission('qr.generate'),
  async (req: AuthRequest, res, next) => {
  try {
    const w = await pool.query(
      `SELECT id, full_name, employee_code FROM workers
       WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [req.params.workerId]
    );
    if (!w.rows.length) throw NotFound('Ishchi topilmadi yoki aktiv emas');

    const token = generateQrToken(req.params.workerId);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86400 * 1000);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE worker_qr_tokens SET is_active = false WHERE worker_id = $1 AND is_active = true`,
        [req.params.workerId]
      );
      await client.query(
        `INSERT INTO worker_qr_tokens (worker_id, token, expires_at, is_active)
         VALUES ($1, $2, $3, true)`,
        [req.params.workerId, token, expiresAt]
      );
    });

    await auditLog({
      event_type: 'qr.generate',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'worker', resource_id: req.params.workerId,
      action: 'qr.generate',
      metadata: { issued_at: new Date(), expires_at: expiresAt },
      ip_address: clientIp(req)
    });

    // Generate PNG data URL for the token (300px, error correction H so it
    // tolerates partial damage when printed and worn on a badge).
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    res.json({
      token,
      worker_id: req.params.workerId,
      worker_name: w.rows[0].full_name,
      employee_code: w.rows[0].employee_code,
      expires_at: expiresAt,
      qr_png_data_url: dataUrl
    });
  } catch (e) { next(e); }
});

// ── Get active token for worker (for re-printing without regenerating) ────
router.get('/worker/:workerId/active',
  requirePermission('qr.generate'),
  async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      SELECT t.token, t.expires_at, t.created_at,
             w.full_name, w.employee_code
      FROM worker_qr_tokens t
      JOIN workers w ON w.id = t.worker_id
      WHERE t.worker_id = $1 AND t.is_active = true
        AND (t.expires_at IS NULL OR t.expires_at > NOW())
      ORDER BY t.created_at DESC
      LIMIT 1
    `, [req.params.workerId]);
    if (!r.rows.length) throw NotFound('Aktiv QR token yo\'q. Avval generate qiling.');

    const dataUrl = await QRCode.toDataURL(r.rows[0].token, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    res.json({
      token: r.rows[0].token,
      worker_id: req.params.workerId,
      worker_name: r.rows[0].full_name,
      employee_code: r.rows[0].employee_code,
      expires_at: r.rows[0].expires_at,
      created_at: r.rows[0].created_at,
      qr_png_data_url: dataUrl
    });
  } catch (e) { next(e); }
});

// ── Get raw QR PNG for direct download/printing ───────────────────────────
router.get('/worker/:workerId/png',
  requirePermission('qr.generate'),
  async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`
      SELECT token FROM worker_qr_tokens
      WHERE worker_id = $1 AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 1
    `, [req.params.workerId]);
    if (!r.rows.length) throw NotFound('Aktiv QR token yo\'q');

    const buf = await QRCode.toBuffer(r.rows[0].token, {
      errorCorrectionLevel: 'H',
      width: 600,
      margin: 4,
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${req.params.workerId}.png"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ── Lookup worker by token (badge check, no scan recorded) ─────────────────
router.post('/lookup',
  rateLimit(60, 60_000),
  requirePermission('qr.scan'),
  async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') throw BadRequest('Token kerak');

    const v = validateQrToken(token);
    if (!v.valid) throw BadRequest(`QR yaroqsiz: ${v.error}`);

    const t = await pool.query(
      `SELECT t.is_active, t.expires_at,
              w.id, w.full_name, w.employee_code, w.position, w.default_stage,
              w.is_active AS worker_active, w.deleted_at,
              ps.name_uz AS default_stage_name
       FROM worker_qr_tokens t
       JOIN workers w ON w.id = t.worker_id
       LEFT JOIN production_stages ps ON ps.id = w.default_stage
       WHERE t.token = $1`,
      [token]
    );
    if (!t.rows.length)        throw BadRequest("QR ro'yxatda yo'q");
    if (t.rows[0].deleted_at)  throw Forbidden("Ishchi o'chirilgan");
    if (!t.rows[0].worker_active) throw Forbidden('Ishchi faol emas');
    if (!t.rows[0].is_active)  throw Forbidden('QR bekor qilingan');
    if (t.rows[0].expires_at && new Date(t.rows[0].expires_at) < new Date()) {
      throw Forbidden('QR muddati tugagan');
    }

    res.json({
      worker_id: t.rows[0].id,
      employee_code: t.rows[0].employee_code,
      full_name: t.rows[0].full_name,
      position: t.rows[0].position,
      default_stage: t.rows[0].default_stage,
      default_stage_name: t.rows[0].default_stage_name
    });
  } catch (e) { next(e); }
});

// ── Record a scan ──────────────────────────────────────────────────────────
// Phase 3 update: when scan_type='stage_advance' AND not suspicious, write
// a production_event in the same transaction. Suspicious scans defer the
// event until supervisor approval (see /scans/:id/approve).
router.post('/scan',
  rateLimit(120, 60_000),
  requirePermission('qr.scan'),
  async (req: AuthRequest, res, next) => {
  try {
    const { token, stage, order_item_id, qty, scan_type, device_id, client_event_uuid } = req.body || {};
    if (!token || typeof token !== 'string') throw BadRequest('Token kerak');

    const validScanTypes = ['check_in', 'stage_advance', 'box_seal', 'inspection'];
    const sType = scan_type || 'stage_advance';
    if (!validScanTypes.includes(sType)) {
      throw BadRequest(`Noto'g'ri scan_type. Ruxsat: ${validScanTypes.join(', ')}`);
    }
    if (sType === 'stage_advance') {
      if (!stage)               throw BadRequest('Bosqich kerak');
      if (!order_item_id)       throw BadRequest('Mahsulot satri (order_item_id) kerak');
      if (!Number.isFinite(qty) || qty < 1 || qty > 100_000) {
        throw BadRequest("qty 1-100000 oraliqda bo'lishi kerak");
      }
    }

    // Cryptographic check
    const v = validateQrToken(token);
    if (!v.valid) throw BadRequest(`QR yaroqsiz: ${v.error}`);

    // DB check — token active, worker active
    const t = await pool.query(
      `SELECT t.is_active AS token_active, t.expires_at,
              w.id AS worker_id, w.full_name, w.default_stage,
              w.is_active AS worker_active, w.deleted_at
       FROM worker_qr_tokens t
       JOIN workers w ON w.id = t.worker_id
       WHERE t.token = $1`,
      [token]
    );
    if (!t.rows.length)             throw BadRequest("QR ro'yxatda yo'q");
    if (t.rows[0].deleted_at)       throw Forbidden("Ishchi o'chirilgan");
    if (!t.rows[0].worker_active)   throw Forbidden('Ishchi faol emas');
    if (!t.rows[0].token_active)    throw Forbidden('QR bekor qilingan');
    if (t.rows[0].expires_at && new Date(t.rows[0].expires_at) < new Date()) {
      throw Forbidden('QR muddati tugagan');
    }
    const workerId = t.rows[0].worker_id;
    const defaultStage = t.rows[0].default_stage;

    if (stage) {
      const stg = await pool.query(`SELECT 1 FROM production_stages WHERE id = $1`, [stage]);
      if (!stg.rows.length) throw BadRequest("Noto'g'ri bosqich");
    }
    if (order_item_id) {
      const oi = await pool.query(`SELECT 1 FROM order_items WHERE id = $1`, [order_item_id]);
      if (!oi.rows.length) throw BadRequest('Mahsulot satri topilmadi');
    }

    // Suspicious detection (unchanged from Phase 2)
    let isSuspicious = false;
    let reason: string | null = null;
    if (sType === 'stage_advance') {
      const dup = await pool.query(`
        SELECT 1 FROM qr_scans
        WHERE worker_id = $1 AND stage = $2 AND order_item_id = $3
          AND scanned_at > NOW() - INTERVAL '${DUPLICATE_WINDOW_SECONDS} seconds'
      `, [workerId, stage, order_item_id]);
      if (dup.rows.length) {
        isSuspicious = true;
        reason = 'Takroriy scan (10 soniya ichida)';
      } else if (defaultStage && stage !== defaultStage) {
        isSuspicious = true;
        reason = `Ishchining doimiy bosqichi: ${defaultStage}, scan: ${stage}`;
      }
    }

    // Atomic: scan + (when applicable) production_event together
    const result = await withTransaction(async (client) => {
      const ins = await client.query(`
        INSERT INTO qr_scans
          (worker_id, token, device_id, stage, order_item_id, qty, scan_type,
           is_suspicious, suspicious_reason, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, scanned_at
      `, [
        workerId, token, device_id || null, stage || null,
        order_item_id || null, qty || null, sType,
        isSuspicious, reason,
        clientIp(req), req.headers['user-agent']?.toString().slice(0, 500) || null
      ]);

      let eventResult = null;
      if (sType === 'stage_advance' && !isSuspicious) {
        eventResult = await recordProductionEvent(client, {
          order_item_id,
          to_stage: stage,
          qty,
          worker_id: workerId,
          user_id: req.user!.id,
          device_id: device_id || null,
          client_event_uuid: client_event_uuid || null,
          metadata: { source: 'qr_scan', scan_id: ins.rows[0].id },
        });
      }

      return {
        scan_id: ins.rows[0].id,
        scanned_at: ins.rows[0].scanned_at,
        event: eventResult,
      };
    });

    await auditLog({
      event_type: 'qr.scan',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'qr_scan', resource_id: String(result.scan_id),
      action: 'scan',
      metadata: {
        worker_id: workerId, stage, order_item_id, qty,
        scan_type: sType, suspicious: isSuspicious,
        event_id: result.event?.event_id,
        discrepancy_id: result.event?.discrepancy_id,
      },
      ip_address: clientIp(req)
    });

    res.json({
      id: result.scan_id,
      scanned_at: result.scanned_at,
      worker_id: workerId,
      worker_name: t.rows[0].full_name,
      is_suspicious: isSuspicious,
      suspicious_reason: reason,
      event_recorded: !!result.event,
      qty_after: result.event?.qty_after ?? null,
      ordered_qty: result.event?.ordered_qty ?? null,
      discrepancy_id: result.event?.discrepancy_id ?? null,
    });
  } catch (e) { next(e); }
});

// ── List scans ─────────────────────────────────────────────────────────────
router.get('/scans', requirePermission('qr.scan'), async (req, res, next) => {
  try {
    const { worker_id, stage, suspicious, since } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (worker_id) { params.push(worker_id); conds.push(`s.worker_id = $${params.length}`); }
    if (stage)     { params.push(stage);     conds.push(`s.stage = $${params.length}`); }
    if (suspicious === 'true')  conds.push(`s.is_suspicious = true`);
    if (suspicious === 'false') conds.push(`s.is_suspicious = false`);
    if (since)     { params.push(since);     conds.push(`s.scanned_at >= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT s.id, s.scanned_at, s.stage, s.qty, s.scan_type,
             s.is_suspicious, s.suspicious_reason, s.approved_by,
             s.worker_id, w.full_name AS worker_name, w.employee_code,
             ps.name_uz AS stage_name,
             s.order_item_id, o.external_code AS order_code, o.order_type
      FROM qr_scans s
      LEFT JOIN workers w ON w.id = s.worker_id
      LEFT JOIN production_stages ps ON ps.id = s.stage
      LEFT JOIN order_items oi ON oi.id = s.order_item_id
      LEFT JOIN orders o ON o.id = oi.order_id
      ${whereSql}
      ORDER BY s.scanned_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Approve a suspicious scan — also commits the deferred event ────────────
router.post('/scans/:id/approve',
  requirePermission('qr.approve'),
  async (req: AuthRequest, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const scn = await client.query(
        `SELECT * FROM qr_scans WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (!scn.rows.length) throw NotFound('Scan topilmadi');
      const s = scn.rows[0];
      if (!s.is_suspicious) throw NotFound('Bu scan shubhali emas');
      if (s.approved_by) throw NotFound('Allaqachon tasdiqlangan');

      await client.query(`
        UPDATE qr_scans
        SET is_suspicious = false, approved_by = $1,
            suspicious_reason = COALESCE(suspicious_reason, '') || ' | tasdiqladi: ' || $2
        WHERE id = $3
      `, [req.user!.id, req.user!.username, req.params.id]);

      let eventResult = null;
      if (s.scan_type === 'stage_advance' && s.stage && s.order_item_id && s.qty) {
        eventResult = await recordProductionEvent(client, {
          order_item_id: s.order_item_id,
          to_stage: s.stage,
          qty: s.qty,
          worker_id: s.worker_id,
          user_id: req.user!.id,
          device_id: s.device_id,
          metadata: { source: 'qr_scan_approved', scan_id: s.id, approved_by: req.user!.username },
        });
      }
      return { scan_id: s.id, event: eventResult };
    });

    await auditLog({
      event_type: 'qr.scan.approve',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'qr_scan', resource_id: req.params.id, action: 'approve',
      metadata: { event_id: result.event?.event_id },
      ip_address: clientIp(req)
    });
    res.json({
      ok: true,
      event_recorded: !!result.event,
      event_id: result.event?.event_id ?? null,
    });
  } catch (e) { next(e); }
});

export default router;
