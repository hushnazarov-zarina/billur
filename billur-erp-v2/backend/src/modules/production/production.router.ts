import { Router } from 'express';
import { pool, withTransaction } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';
import { recordProductionEvent, STAGE_QTY_COLUMN } from './production.events';

const router = Router();
router.use(requireAuth);

// ── POST /api/production/events — manual stage advance ─────────────────────
router.post('/events',
  requirePermission('production.events.create'),
  async (req: AuthRequest, res, next) => {
  try {
    const {
      order_item_id, to_stage, qty, from_stage,
      worker_id, device_id, client_event_uuid, notes
    } = req.body || {};

    const result = await withTransaction(async (client) => {
      return recordProductionEvent(client, {
        order_item_id,
        to_stage,
        qty: typeof qty === 'string' ? parseInt(qty, 10) : qty,
        from_stage: from_stage || null,
        worker_id: worker_id || null,
        user_id: req.user!.id,
        device_id: device_id || null,
        client_event_uuid: client_event_uuid || null,
        notes: notes || null,
      });
    });

    if (!result.was_idempotent) {
      await auditLog({
        event_type: 'production.event.create',
        user_id: req.user!.id, username: req.user!.username,
        resource_type: 'order_item', resource_id: result.order_item_id,
        action: 'stage_advance',
        metadata: {
          event_id: result.event_id,
          to_stage: result.to_stage,
          qty: result.qty_after !== null ? result.qty_after : qty,
          discrepancy_id: result.discrepancy_id,
        },
        ip_address: clientIp(req)
      });
    }

    res.json(result);
  } catch (e) { next(e); }
});

// ── GET /api/production/events — recent events feed ────────────────────────
router.get('/events', requirePermission('production.read'), async (req, res, next) => {
  try {
    const { order_id, order_item_id, worker_id, stage, since, limit } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (order_id)      { params.push(order_id);      conds.push(`pe.order_id = $${params.length}`); }
    if (order_item_id) { params.push(order_item_id); conds.push(`pe.order_item_id = $${params.length}`); }
    if (worker_id)     { params.push(worker_id);     conds.push(`pe.worker_id = $${params.length}`); }
    if (stage)         { params.push(stage);         conds.push(`pe.to_stage = $${params.length}`); }
    if (since)         { params.push(since);         conds.push(`pe.occurred_at >= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(String(limit || '100'), 10) || 100, 500);

    const { rows } = await pool.query(`
      SELECT pe.id, pe.event_type, pe.qty, pe.occurred_at,
             pe.from_stage, pe.to_stage,
             ps_to.name_uz   AS to_stage_name,
             ps_from.name_uz AS from_stage_name,
             pe.order_id, o.external_code AS order_code, o.order_type,
             pe.order_item_id,
             m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code,
             pe.worker_id, w.full_name AS worker_name, w.employee_code,
             pe.notes
      FROM production_events pe
      LEFT JOIN production_stages ps_to   ON ps_to.id   = pe.to_stage
      LEFT JOIN production_stages ps_from ON ps_from.id = pe.from_stage
      LEFT JOIN orders o     ON o.id  = pe.order_id
      LEFT JOIN order_items oi ON oi.id = pe.order_item_id
      LEFT JOIN models m     ON m.id  = oi.model_id
      LEFT JOIN colors cl    ON cl.id = oi.color_id
      LEFT JOIN sizes sz     ON sz.id = oi.size_id
      LEFT JOIN workers w    ON w.id  = pe.worker_id
      ${whereSql}
      ORDER BY pe.occurred_at DESC
      LIMIT ${lim}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/production/orders/:id/progress ────────────────────────────────
// Per-item, per-stage progress matrix for one order.
router.get('/orders/:id/progress',
  requirePermission('production.read'),
  async (req, res, next) => {
  try {
    const ord = await pool.query(`
      SELECT id, order_type, external_code, status, deadline, total_pieces,
             client_id, created_at
      FROM orders WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);
    if (!ord.rows.length) throw NotFound();

    const items = await pool.query(`
      SELECT oi.id, oi.ordered_qty,
             oi.cut_qty, oi.printed_qty, oi.sewn_qty, oi.qc_passed_qty,
             oi.ironed_qty, oi.packed_qty, oi.boxed_qty, oi.shipped_qty,
             oi.rejected_qty, oi.surplus_qty,
             m.code AS model_code, m.name AS model_name,
             cl.code AS color_code, cl.name_uz AS color_name, cl.hex AS color_hex,
             sz.code AS size_code, sz.sort_order AS size_sort
      FROM order_items oi
      LEFT JOIN models m  ON m.id  = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      WHERE oi.order_id = $1
      ORDER BY m.code, cl.name_uz, sz.sort_order, sz.code
    `, [req.params.id]);

    // Aggregate totals across all items
    const totals: Record<string, number> = {
      ordered_qty: 0, cut_qty: 0, printed_qty: 0, sewn_qty: 0,
      qc_passed_qty: 0, ironed_qty: 0, packed_qty: 0, boxed_qty: 0,
      shipped_qty: 0, rejected_qty: 0, surplus_qty: 0
    };
    for (const it of items.rows) {
      for (const k of Object.keys(totals)) {
        totals[k] += it[k] ?? 0;
      }
    }

    // Open discrepancies for this order
    const disc = await pool.query(`
      SELECT d.*, m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code
      FROM discrepancies d
      JOIN order_items oi ON oi.id = d.order_item_id
      LEFT JOIN models m  ON m.id  = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      WHERE oi.order_id = $1 AND d.status = 'open'
      ORDER BY d.detected_at DESC
    `, [req.params.id]);

    res.json({
      order: ord.rows[0],
      items: items.rows,
      totals,
      open_discrepancies: disc.rows,
    });
  } catch (e) { next(e); }
});

// ── GET /api/production/stages/:stage/queue ────────────────────────────────
// What's "in flight" at a given stage: items where current stage > 0 and
// next stage hasn't caught up.
router.get('/stages/:stage/queue',
  requirePermission('production.read'),
  async (req, res, next) => {
  try {
    const stage = req.params.stage;
    const col = STAGE_QTY_COLUMN[stage];
    if (!col) throw BadRequest("Bu bosqich uchun queue ko'rsatilmaydi");

    const FLOW = ['cutting','printing','sewing','quality','ironing','packing','boxing','shipped'];
    const idx = FLOW.indexOf(stage);
    const nextCol = idx >= 0 && idx < FLOW.length - 1 ? STAGE_QTY_COLUMN[FLOW[idx + 1]] : null;
    const remainingExpr = nextCol ? `(oi.${col} - oi.${nextCol})` : `oi.${col}`;

    const { rows } = await pool.query(`
      SELECT oi.id AS order_item_id,
             oi.ordered_qty,
             oi.${col} AS in_qty,
             ${nextCol ? `oi.${nextCol} AS out_qty,` : `0 AS out_qty,`}
             ${remainingExpr} AS remaining,
             o.id AS order_id, o.external_code AS order_code, o.order_type,
             o.deadline, o.priority,
             c.name AS client_name, c.code AS client_code,
             m.code AS model_code, m.name AS model_name,
             cl.name_uz AS color_name, cl.hex AS color_hex,
             sz.code AS size_code
      FROM order_items oi
      JOIN orders o      ON o.id = oi.order_id AND o.deleted_at IS NULL
      LEFT JOIN clients c ON c.id = o.client_id
      LEFT JOIN models m  ON m.id  = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      WHERE o.status IN ('active', 'problem')
        AND ${remainingExpr} > 0
      ORDER BY o.priority DESC, o.deadline NULLS LAST, o.created_at
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/production/today ──────────────────────────────────────────────
router.get('/today', requirePermission('production.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT pe.to_stage AS stage_id,
             ps.name_uz AS stage_name,
             ps.sort_order,
             COUNT(*)::int AS event_count,
             COALESCE(SUM(pe.qty), 0)::int AS qty,
             COUNT(DISTINCT pe.worker_id)::int AS worker_count
      FROM production_events pe
      LEFT JOIN production_stages ps ON ps.id = pe.to_stage
      WHERE pe.occurred_at >= CURRENT_DATE
      GROUP BY pe.to_stage, ps.name_uz, ps.sort_order
      ORDER BY ps.sort_order
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
