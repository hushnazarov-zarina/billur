import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('orders.read'), async (req, res, next) => {
  try {
    const { client_id, status, type } = req.query;
    const params: any[] = [];
    const conds: string[] = [`o.deleted_at IS NULL`];
    if (client_id) { params.push(client_id); conds.push(`o.client_id = $${params.length}`); }
    if (status)    { params.push(status);    conds.push(`o.status = $${params.length}`); }
    if (type)      { params.push(type);      conds.push(`o.order_type = $${params.length}`); }

    const { rows } = await pool.query(`
      SELECT o.*, c.name AS client_name, c.code AS client_code,
        (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS items_count
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE ${conds.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('orders.create'), async (req: AuthRequest, res, next) => {
  try {
    const { order_type, external_code, client_id, deadline, notes, priority, items } = req.body || {};
    if (!order_type || !['speka','set','standard'].includes(order_type)) {
      throw BadRequest('order_type: speka/set/standard');
    }
    if (!client_id) throw BadRequest('Klient tanlang');

    await pool.query('BEGIN');
    const ord = await pool.query(`
      INSERT INTO orders (order_type, external_code, client_id, deadline, notes, priority,
                          status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
      RETURNING *
    `, [order_type, external_code || null, client_id, deadline || null,
        notes || null, priority || 0, req.user!.id]);

    let totalPieces = 0;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it.model_id || !it.color_id || !it.size_id || !it.ordered_qty) continue;
        await pool.query(`
          INSERT INTO order_items (order_id, model_id, color_id, size_id, ordered_qty, unit_price_uzs)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (order_id, model_id, color_id, size_id) DO NOTHING
        `, [ord.rows[0].id, it.model_id, it.color_id, it.size_id, it.ordered_qty, it.unit_price_uzs || null]);
        totalPieces += it.ordered_qty;
      }
      await pool.query(`UPDATE orders SET total_pieces = $1 WHERE id = $2`,
        [totalPieces, ord.rows[0].id]);
    }
    await pool.query('COMMIT');

    await auditLog({
      event_type: 'order.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'order', resource_id: ord.rows[0].id,
      after_value: ord.rows[0], ip_address: clientIp(req)
    });
    res.json(ord.rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    next(e);
  }
});

router.get('/:id', requirePermission('orders.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, c.name AS client_name, c.code AS client_code
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `, [req.params.id]);
    if (!rows.length) throw NotFound();
    const items = await pool.query(`
      SELECT oi.*, m.code AS model_code, m.name AS model_name,
             cl.code AS color_code, cl.name_uz AS color_name,
             s.code AS size_code
      FROM order_items oi
      LEFT JOIN models m ON m.id = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes s ON s.id = oi.size_id
      WHERE oi.order_id = $1
      ORDER BY m.code, cl.name_uz, s.sort_order
    `, [req.params.id]);
    res.json({ ...rows[0], items: items.rows });
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('orders.update'), async (req: AuthRequest, res, next) => {
  try {
    const { external_code, deadline, notes, priority, status } = req.body || {};
    const r = await pool.query(`
      UPDATE orders SET
        external_code = COALESCE($1, external_code),
        deadline = COALESCE($2, deadline),
        notes = COALESCE($3, notes),
        priority = COALESCE($4, priority),
        status = COALESCE($5, status),
        updated_at = NOW()
      WHERE id = $6 AND deleted_at IS NULL
    `, [external_code, deadline, notes, priority, status, req.params.id]);
    if (!r.rowCount) throw NotFound();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('orders.delete'), async (req: AuthRequest, res, next) => {
  try {
    await pool.query(`UPDATE orders SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    await auditLog({
      event_type: 'order.delete',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'order', resource_id: req.params.id,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/cancel', requirePermission('orders.cancel'), async (req: AuthRequest, res, next) => {
  try {
    await pool.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [req.params.id]);
    await auditLog({
      event_type: 'order.cancel',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'order', resource_id: req.params.id,
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// SET parser
router.post('/set/parse', requirePermission('orders.read'), async (req, res, next) => {
  try {
    const { codes } = req.body || {};
    if (!Array.isArray(codes)) throw BadRequest('codes massivi kerak');
    const RX = /^SET(\d+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)$/i;
    const parsed = codes.map((c: string) => {
      const t = String(c || '').trim().toUpperCase();
      const m = t.match(RX);
      if (!m) return { raw: c, ok: false, error: 'Format noto\'g\'ri' };
      return { raw: c, ok: true, set_number: m[1], model_code: m[2], color_code: m[3], size_code: m[4] };
    });
    res.json({
      total: codes.length,
      valid: parsed.filter(p => p.ok).length,
      invalid: parsed.filter(p => !p.ok).length,
      items: parsed
    });
  } catch (e) { next(e); }
});

export default router;
