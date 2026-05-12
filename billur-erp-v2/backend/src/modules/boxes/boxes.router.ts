import { Router } from 'express';
import { pool, withTransaction } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';
import { syncBoxCreate } from '../boxapp/boxapp.service';

const router = Router();
router.use(requireAuth);

const VALID_TYPES = ['simple', 'mix'];
const VALID_STATUSES = ['packed', 'warehouse', 'shipping', 'shipped'];

router.get('/_stats/by-status', requirePermission('box.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(kg), 0)::numeric AS total_kg
      FROM boxes
      GROUP BY status
      ORDER BY status
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/', requirePermission('box.read'), async (req, res, next) => {
  try {
    const { status, zakaz, order_id } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (status)    { params.push(status);    conds.push(`b.status = $${params.length}`); }
    if (zakaz)     { params.push(zakaz);     conds.push(`b.zakaz = $${params.length}`); }
    if (order_id)  { params.push(order_id);  conds.push(`b.order_id = $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT b.*, o.external_code AS order_code
      FROM boxes b
      LEFT JOIN orders o ON o.id = b.order_id
      ${whereSql}
      ORDER BY b.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('box.create'), async (req: AuthRequest, res, next) => {
  try {
    const { uid, box_num, zakaz, order_id, type, kg, model, color, sizes, items, status } = req.body || {};

    if (!uid || !box_num || !zakaz) throw BadRequest('uid, box_num, zakaz kerak');
    if (!type || !VALID_TYPES.includes(type)) throw BadRequest(`type: ${VALID_TYPES.join(', ')}`);
    const st = status || 'packed';
    if (!VALID_STATUSES.includes(st)) throw BadRequest(`status: ${VALID_STATUSES.join(', ')}`);

    const dup = await pool.query(`SELECT 1 FROM boxes WHERE uid = $1`, [uid]);
    if (dup.rows.length) throw Conflict('Bu uid band');

    const dup2 = await pool.query(
      `SELECT 1 FROM boxes WHERE zakaz = $1 AND box_num = $2`,
      [zakaz, box_num]
    );
    if (dup2.rows.length) throw Conflict("Bu zakaz'da shu box_num bor");

    const { rows } = await pool.query(`
      INSERT INTO boxes
        (uid, box_num, zakaz, order_id, type, kg, status,
         model, color, sizes, items,
         created_by, created_by_name, created_date,
         status_history)
      VALUES ($1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13, CURRENT_DATE,
              $14)
      RETURNING *
    `, [
      uid, box_num, zakaz, order_id || null, type, kg || 0, st,
      model || null, color || null,
      sizes ? JSON.stringify(sizes) : null,
      items ? JSON.stringify(items) : null,
      req.user!.id, req.user!.full_name,
      JSON.stringify([{ status: st, at: new Date(), by: req.user!.username }])
    ]);

    await auditLog({
      event_type: 'box.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'box', resource_id: uid, action: 'create',
      after_value: rows[0], ip_address: clientIp(req)
    });

    // Push to BoxApp asynchronously (queued — won't block response)
    syncBoxCreate(rows[0], req.user!.id).catch(err => {
      console.error('[boxapp sync enqueue]', err);
    });

    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/:uid', requirePermission('box.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, o.external_code AS order_code
      FROM boxes b
      LEFT JOIN orders o ON o.id = b.order_id
      WHERE b.uid = $1
    `, [req.params.uid]);
    if (!rows.length) throw NotFound();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:uid', requirePermission('box.update'), async (req: AuthRequest, res, next) => {
  try {
    const { kg, status, model, color, sizes, items } = req.body || {};
    if (status && !VALID_STATUSES.includes(status)) {
      throw BadRequest(`status: ${VALID_STATUSES.join(', ')}`);
    }

    const result = await withTransaction(async (client) => {
      const sel = await client.query(
        `SELECT * FROM boxes WHERE uid = $1 FOR UPDATE`, [req.params.uid]
      );
      if (!sel.rows.length) throw NotFound();
      const cur = sel.rows[0];

      let history = cur.status_history;
      if (status && status !== cur.status) {
        if (!Array.isArray(history)) history = [];
        history.push({ status, at: new Date(), by: req.user!.username });
      }

      await client.query(`
        UPDATE boxes SET
          kg     = COALESCE($1, kg),
          status = COALESCE($2, status),
          model  = COALESCE($3, model),
          color  = COALESCE($4, color),
          sizes  = COALESCE($5, sizes),
          items  = COALESCE($6, items),
          status_history = $7,
          updated_at = NOW()
        WHERE uid = $8
      `, [
        kg, status, model, color,
        sizes ? JSON.stringify(sizes) : null,
        items ? JSON.stringify(items) : null,
        JSON.stringify(history),
        req.params.uid
      ]);
      return { ok: true };
    });

    await auditLog({
      event_type: 'box.update',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'box', resource_id: req.params.uid, action: 'update',
      after_value: req.body, ip_address: clientIp(req)
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.delete('/:uid', requirePermission('box.delete'), async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(`DELETE FROM boxes WHERE uid = $1 AND status = 'packed' RETURNING uid`,
      [req.params.uid]);
    if (!r.rowCount) throw Conflict("Faqat 'packed' statusdagi boxni o'chirish mumkin");

    await auditLog({
      event_type: 'box.delete',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'box', resource_id: req.params.uid, action: 'delete',
      ip_address: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
