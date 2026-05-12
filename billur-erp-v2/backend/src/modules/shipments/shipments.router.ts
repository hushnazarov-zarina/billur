import { Router } from 'express';
import { pool, withTransaction } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';
import { syncShipmentCreate, syncShipmentUpdate } from '../boxapp/boxapp.service';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('box.read'), async (req, res, next) => {
  try {
    const { status, client_id } = req.query;
    const params: any[] = [];
    const conds: string[] = [];
    if (status)    { params.push(status);    conds.push(`s.status = $${params.length}`); }
    if (client_id) { params.push(client_id); conds.push(`s.client_id = $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT s.*, c.name AS client_name, c.code AS client_code,
             COALESCE(jsonb_array_length(s.box_uids), 0) AS box_count
      FROM shipments s
      LEFT JOIN clients c ON c.id = s.client_id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('box.update'), async (req: AuthRequest, res, next) => {
  try {
    const { id, client_id, truck_info, note, box_uids } = req.body || {};
    if (!id) throw BadRequest('id kerak');
    if (!Array.isArray(box_uids) || box_uids.length === 0) {
      throw BadRequest('box_uids massivi kerak (kamida 1 ta)');
    }

    const result = await withTransaction(async (client) => {
      const dup = await client.query(`SELECT 1 FROM shipments WHERE id = $1`, [id]);
      if (dup.rows.length) throw Conflict('Bu id band');

      const boxes = await client.query(`
        SELECT uid, status, model, color, sizes, items, kg, zakaz, box_num
        FROM boxes
        WHERE uid = ANY($1::text[])
        FOR UPDATE
      `, [box_uids]);

      if (boxes.rows.length !== box_uids.length) {
        throw BadRequest("Ba'zi box uid topilmadi");
      }
      const bad = boxes.rows.find(b => b.status === 'shipped');
      if (bad) throw Conflict(`Box ${bad.uid} allaqachon shipped`);

      const snapshot = boxes.rows.map(b => ({
        uid: b.uid, zakaz: b.zakaz, box_num: b.box_num,
        model: b.model, color: b.color, sizes: b.sizes, items: b.items,
        kg: Number(b.kg) || 0
      }));

      const ins = await client.query(`
        INSERT INTO shipments
          (id, truck_info, note, status, box_uids, snapshot,
           client_id, created_by, created_by_name)
        VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        id, truck_info || null, note || null,
        JSON.stringify(box_uids),
        JSON.stringify(snapshot),
        client_id || null,
        req.user!.id, req.user!.full_name
      ]);

      await client.query(`
        UPDATE boxes SET status = 'shipping', updated_at = NOW()
        WHERE uid = ANY($1::text[])
      `, [box_uids]);

      return ins.rows[0];
    });

    await auditLog({
      event_type: 'shipment.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'shipment', resource_id: id, action: 'create',
      metadata: { box_count: box_uids.length, client_id },
      ip_address: clientIp(req)
    });

    syncShipmentCreate(result, req.user!.id).catch(err =>
      console.error('[boxapp sync enqueue]', err));

    res.json(result);
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('box.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, c.name AS client_name, c.code AS client_code
      FROM shipments s
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.id = $1
    `, [req.params.id]);
    if (!rows.length) throw NotFound();

    const uids = rows[0].box_uids || [];
    let boxes: any[] = [];
    if (Array.isArray(uids) && uids.length > 0) {
      const b = await pool.query(`SELECT * FROM boxes WHERE uid = ANY($1::text[])`, [uids]);
      boxes = b.rows;
    }
    res.json({ ...rows[0], boxes });
  } catch (e) { next(e); }
});

router.post('/:id/close', requirePermission('box.update'), async (req: AuthRequest, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const sel = await client.query(
        `SELECT * FROM shipments WHERE id = $1 FOR UPDATE`, [req.params.id]
      );
      if (!sel.rows.length) throw NotFound();
      if (sel.rows[0].status === 'closed') throw Conflict('Shipment allaqachon yopilgan');

      const uids = sel.rows[0].box_uids || [];

      await client.query(`
        UPDATE shipments
        SET status = 'closed', closed_at = NOW(), closed_by = $1
        WHERE id = $2
      `, [req.user!.id, req.params.id]);

      if (Array.isArray(uids) && uids.length > 0) {
        await client.query(`
          UPDATE boxes SET status = 'shipped', updated_at = NOW()
          WHERE uid = ANY($1::text[])
        `, [uids]);
      }
      return { box_count: uids.length };
    });

    await auditLog({
      event_type: 'shipment.close',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'shipment', resource_id: req.params.id, action: 'close',
      metadata: result,
      ip_address: clientIp(req)
    });

    syncShipmentUpdate({ id: req.params.id, status: 'closed' }, req.user!.id).catch(err =>
      console.error('[boxapp sync enqueue]', err));

    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

export default router;
