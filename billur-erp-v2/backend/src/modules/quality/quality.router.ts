import { Router } from 'express';
import { pool, withTransaction } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

const VALID_DEFECT_SEVERITIES = ['minor', 'major', 'critical'];

router.get('/', requirePermission('quality.read'), async (req, res, next) => {
  try {
    const { order_id, order_item_id, stage, since, limit } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (order_id)      { params.push(order_id);      conds.push(`oi.order_id = $${params.length}`); }
    if (order_item_id) { params.push(order_item_id); conds.push(`qc.order_item_id = $${params.length}`); }
    if (stage)         { params.push(stage);         conds.push(`qc.stage = $${params.length}`); }
    if (since)         { params.push(since);         conds.push(`qc.created_at >= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(String(limit || '100'), 10) || 100, 500);

    const { rows } = await pool.query(`
      SELECT qc.id, qc.created_at, qc.stage, ps.name_uz AS stage_name,
             qc.checked_qty, qc.passed_qty,
             qc.defect_1st_qty, qc.defect_2nd_qty,
             qc.rejected_qty, qc.repair_qty, qc.surplus_qty,
             qc.notes,
             qc.order_item_id, oi.order_id,
             o.external_code AS order_code, o.order_type,
             m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code,
             qc.user_id, u.full_name AS user_name,
             (SELECT COUNT(*)::int FROM defects d WHERE d.quality_check_id = qc.id) AS defect_count
      FROM quality_checks qc
      LEFT JOIN production_stages ps ON ps.id = qc.stage
      LEFT JOIN order_items oi ON oi.id = qc.order_item_id
      LEFT JOIN orders o  ON o.id = oi.order_id
      LEFT JOIN models m  ON m.id = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      LEFT JOIN users u   ON u.id = qc.user_id
      ${whereSql}
      ORDER BY qc.created_at DESC
      LIMIT ${lim}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/discrepancies', requirePermission('quality.read'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const params: any[] = [];
    const conds: string[] = [];
    if (status) { params.push(status); conds.push(`d.status = $${params.length}`); }
    else conds.push(`d.status = 'open'`);

    const { rows } = await pool.query(`
      SELECT d.*, ps_from.name_uz AS from_stage_name, ps_to.name_uz AS to_stage_name,
             oi.order_id, o.external_code AS order_code,
             m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code,
             u.full_name AS resolved_by_name
      FROM discrepancies d
      LEFT JOIN production_stages ps_from ON ps_from.id = d.from_stage
      LEFT JOIN production_stages ps_to   ON ps_to.id = d.to_stage
      LEFT JOIN order_items oi ON oi.id = d.order_item_id
      LEFT JOIN orders o  ON o.id = oi.order_id
      LEFT JOIN models m  ON m.id = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      LEFT JOIN users u   ON u.id = d.resolved_by
      WHERE ${conds.join(' AND ')}
      ORDER BY d.detected_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/discrepancies/:id/resolve',
  requirePermission('quality.update'),
  async (req: AuthRequest, res, next) => {
  try {
    const { resolution, resolution_notes } = req.body || {};
    const validResolutions = ['confirmed_count', 'data_entry_error', 'lost', 'found_later', 'other'];
    if (!resolution || !validResolutions.includes(resolution)) {
      throw BadRequest(`resolution: ${validResolutions.join(', ')}`);
    }

    const r = await pool.query(`
      UPDATE discrepancies
      SET status = 'resolved',
          resolution = $1, resolution_notes = $2,
          resolved_by = $3, resolved_at = NOW()
      WHERE id = $4 AND status = 'open'
      RETURNING id, order_item_id
    `, [resolution, resolution_notes || null, req.user!.id, req.params.id]);
    if (!r.rowCount) throw NotFound('Discrepancy topilmadi yoki allaqachon hal qilingan');

    const orderItem = await pool.query(
      `SELECT order_id FROM order_items WHERE id = $1`, [r.rows[0].order_item_id]
    );
    if (orderItem.rows.length) {
      const stillOpen = await pool.query(`
        SELECT 1 FROM discrepancies d
        JOIN order_items oi ON oi.id = d.order_item_id
        WHERE oi.order_id = $1 AND d.status = 'open'
        LIMIT 1
      `, [orderItem.rows[0].order_id]);
      if (!stillOpen.rows.length) {
        await pool.query(`
          UPDATE orders SET status = 'active', updated_at = NOW()
          WHERE id = $1 AND status = 'problem'
        `, [orderItem.rows[0].order_id]);
      }
    }

    await auditLog({
      event_type: 'quality.discrepancy.resolve',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'discrepancy', resource_id: req.params.id,
      action: 'resolve',
      metadata: { resolution, resolution_notes },
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/defects/summary', requirePermission('quality.read'), async (req, res, next) => {
  try {
    const { since } = req.query;
    const params: any[] = [];
    let whereSql = '';
    if (since) { params.push(since); whereSql = `WHERE qc.created_at >= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        d.defect_type,
        d.severity,
        COUNT(*)::int AS occurrences,
        COALESCE(SUM(d.qty), 0)::int AS total_qty
      FROM defects d
      JOIN quality_checks qc ON qc.id = d.quality_check_id
      ${whereSql}
      GROUP BY d.defect_type, d.severity
      ORDER BY total_qty DESC
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('quality.read'), async (req, res, next) => {
  try {
    const qc = await pool.query(`
      SELECT qc.*, ps.name_uz AS stage_name,
             oi.order_id, o.external_code AS order_code,
             m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code,
             u.full_name AS user_name
      FROM quality_checks qc
      LEFT JOIN production_stages ps ON ps.id = qc.stage
      LEFT JOIN order_items oi ON oi.id = qc.order_item_id
      LEFT JOIN orders o  ON o.id = oi.order_id
      LEFT JOIN models m  ON m.id = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      LEFT JOIN users u   ON u.id = qc.user_id
      WHERE qc.id = $1
    `, [req.params.id]);
    if (!qc.rows.length) throw NotFound();

    const defects = await pool.query(`
      SELECT * FROM defects WHERE quality_check_id = $1 ORDER BY created_at
    `, [req.params.id]);

    res.json({ ...qc.rows[0], defects: defects.rows });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('quality.create'), async (req: AuthRequest, res, next) => {
  try {
    const {
      order_item_id, stage, checked_qty, passed_qty,
      defect_1st_qty, defect_2nd_qty, rejected_qty, repair_qty, surplus_qty,
      worker_id, notes, defects
    } = req.body || {};

    if (!order_item_id) throw BadRequest('order_item_id kerak');
    if (!stage)         throw BadRequest('stage kerak');
    if (!Number.isInteger(checked_qty) || checked_qty < 1) {
      throw BadRequest('checked_qty 1 dan katta butun son');
    }

    const passed = Number(passed_qty) || 0;
    const d1     = Number(defect_1st_qty) || 0;
    const d2     = Number(defect_2nd_qty) || 0;
    const rej    = Number(rejected_qty) || 0;
    const rep    = Number(repair_qty) || 0;
    const sur    = Number(surplus_qty) || 0;

    const total = passed + d1 + d2 + rej + rep + sur;
    if (total !== checked_qty) {
      throw BadRequest(
        `Sum mos kelmadi: passed(${passed}) + 1st(${d1}) + 2nd(${d2}) + ` +
        `rejected(${rej}) + repair(${rep}) + surplus(${sur}) = ${total}, ` +
        `lekin checked_qty=${checked_qty}`
      );
    }

    const result = await withTransaction(async (client) => {
      const itemRes = await client.query(
        `SELECT oi.*, o.status AS order_status, o.deleted_at AS order_deleted
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = $1
         FOR UPDATE OF oi`,
        [order_item_id]
      );
      if (!itemRes.rows.length) throw NotFound('order_item topilmadi');
      const item = itemRes.rows[0];
      if (item.order_deleted)              throw Conflict("Buyurtma o'chirilgan");
      if (item.order_status === 'cancelled') throw Conflict('Buyurtma bekor qilingan');

      const stg = await client.query(
        `SELECT 1 FROM production_stages WHERE id = $1 AND is_active`, [stage]
      );
      if (!stg.rows.length) throw BadRequest("Noto'g'ri bosqich");

      const qcRes = await client.query(`
        INSERT INTO quality_checks
          (order_item_id, stage, checked_qty, passed_qty,
           defect_1st_qty, defect_2nd_qty, rejected_qty, repair_qty, surplus_qty,
           worker_id, user_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        order_item_id, stage, checked_qty, passed,
        d1, d2, rej, rep, sur,
        worker_id || null, req.user!.id, notes || null
      ]);
      const qcId = qcRes.rows[0].id;

      if (Array.isArray(defects) && defects.length > 0) {
        for (const d of defects) {
          if (!d.qty || !Number.isInteger(d.qty) || d.qty < 1) continue;
          if (d.severity && !VALID_DEFECT_SEVERITIES.includes(d.severity)) {
            throw BadRequest(`Noto'g'ri severity: ${d.severity}`);
          }
          await client.query(`
            INSERT INTO defects
              (quality_check_id, defect_type, severity, qty,
               responsible_worker_id, responsible_stage, photo_urls, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            qcId,
            d.defect_type || null,
            d.severity || null,
            d.qty,
            d.responsible_worker_id || null,
            d.responsible_stage || null,
            Array.isArray(d.photo_urls) ? d.photo_urls : null,
            d.description || null
          ]);
        }
      }

      if (stage === 'quality') {
        await client.query(`
          UPDATE order_items SET
            qc_passed_qty = qc_passed_qty + $1,
            rejected_qty  = rejected_qty + $2,
            surplus_qty   = surplus_qty + $3
          WHERE id = $4
        `, [passed, rej, sur, order_item_id]);
      } else {
        await client.query(`
          UPDATE order_items SET
            rejected_qty = rejected_qty + $1,
            surplus_qty  = surplus_qty + $2
          WHERE id = $3
        `, [rej, sur, order_item_id]);
      }

      return { qc_id: qcId, order_id: item.order_id };
    });

    await auditLog({
      event_type: 'quality.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'quality_check', resource_id: result.qc_id,
      action: 'create',
      metadata: { stage, checked_qty, passed, defects: defects?.length ?? 0 },
      ip_address: clientIp(req)
    });

    res.json(result);
  } catch (e) { next(e); }
});

export default router;
