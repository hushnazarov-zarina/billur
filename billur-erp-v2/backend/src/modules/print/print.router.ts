import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

router.get('/', requirePermission('print.read'), async (req, res, next) => {
  try {
    const { status, client_id, order_id } = req.query;
    const params: any[] = [];
    const conds: string[] = [];
    if (status)    { params.push(status);    conds.push(`pj.status = $${params.length}`); }
    if (client_id) { params.push(client_id); conds.push(`pj.client_id = $${params.length}`); }
    if (order_id)  { params.push(order_id);  conds.push(`pj.order_id = $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT pj.*, c.name AS client_name, c.code AS client_code,
             o.external_code AS order_code, o.order_type
      FROM print_jobs pj
      LEFT JOIN clients c ON c.id = pj.client_id
      LEFT JOIN orders o  ON o.id = pj.order_id
      ${whereSql}
      ORDER BY pj.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('print.create'), async (req: AuthRequest, res, next) => {
  try {
    const { client_id, order_id, print_type, design_url, qty, unit_price_uzs, deadline, operator_id, notes } = req.body || {};
    if (!Number.isInteger(qty) || qty < 1) throw BadRequest("qty 1 dan katta bo'lishi kerak");

    const { rows } = await pool.query(`
      INSERT INTO print_jobs
        (client_id, order_id, print_type, design_url, qty,
         unit_price_uzs, deadline, operator_id, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *
    `, [
      client_id || null, order_id || null, print_type || null, design_url || null, qty,
      unit_price_uzs || null, deadline || null, operator_id || null, notes || null
    ]);

    await auditLog({
      event_type: 'print.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'print_job', resource_id: rows[0].id, action: 'create',
      after_value: rows[0], ip_address: clientIp(req)
    });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('print.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT pj.*, c.name AS client_name, c.code AS client_code,
             o.external_code AS order_code
      FROM print_jobs pj
      LEFT JOIN clients c ON c.id = pj.client_id
      LEFT JOIN orders o  ON o.id = pj.order_id
      WHERE pj.id = $1
    `, [req.params.id]);
    if (!rows.length) throw NotFound();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('print.update'), async (req: AuthRequest, res, next) => {
  try {
    const { printed_qty, rejected_qty, status, notes, operator_id } = req.body || {};
    if (status && !VALID_STATUSES.includes(status)) {
      throw BadRequest(`status: ${VALID_STATUSES.join(', ')}`);
    }

    const r = await pool.query(`
      UPDATE print_jobs SET
        printed_qty  = COALESCE($1, printed_qty),
        rejected_qty = COALESCE($2, rejected_qty),
        status       = COALESCE($3, status),
        notes        = COALESCE($4, notes),
        operator_id  = COALESCE($5, operator_id)
      WHERE id = $6
      RETURNING *
    `, [printed_qty, rejected_qty, status, notes, operator_id, req.params.id]);
    if (!r.rowCount) throw NotFound();

    await auditLog({
      event_type: 'print.update',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'print_job', resource_id: req.params.id, action: 'update',
      after_value: req.body, ip_address: clientIp(req)
    });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

export default router;
