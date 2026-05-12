import { Router } from 'express';
import { pool, withTransaction } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

const VALID_MOVEMENT_TYPES = ['receipt', 'issue', 'transfer', 'adjustment', 'return'];

router.get('/movements', requirePermission('inventory.read'), async (req, res, next) => {
  try {
    const { warehouse_id, model_id, raw_material_id, type, since, limit } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (warehouse_id)    { params.push(warehouse_id);    conds.push(`im.warehouse_id = $${params.length}`); }
    if (model_id)        { params.push(model_id);        conds.push(`im.model_id = $${params.length}`); }
    if (raw_material_id) { params.push(raw_material_id); conds.push(`im.raw_material_id = $${params.length}`); }
    if (type)            { params.push(type);            conds.push(`im.movement_type = $${params.length}`); }
    if (since)           { params.push(since);           conds.push(`im.occurred_at >= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(String(limit || '100'), 10) || 100, 500);

    const { rows } = await pool.query(`
      SELECT im.id, im.occurred_at, im.recorded_at, im.movement_type, im.qty,
             im.warehouse_id, w.name_uz AS warehouse_name,
             im.from_warehouse, im.to_warehouse,
             im.reference_type, im.reference_id, im.box_uid,
             im.model_id, m.code AS model_code,
             im.color_id, cl.name_uz AS color_name,
             im.size_id, sz.code AS size_code,
             im.raw_material_id, rm.code AS material_code, rm.name AS material_name, rm.unit AS material_unit,
             im.user_id, u.full_name AS user_name,
             im.notes
      FROM inventory_movements im
      LEFT JOIN warehouses w     ON w.id = im.warehouse_id
      LEFT JOIN models m         ON m.id = im.model_id
      LEFT JOIN colors cl        ON cl.id = im.color_id
      LEFT JOIN sizes sz         ON sz.id = im.size_id
      LEFT JOIN raw_materials rm ON rm.id = im.raw_material_id
      LEFT JOIN users u          ON u.id = im.user_id
      ${whereSql}
      ORDER BY im.occurred_at DESC
      LIMIT ${lim}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/movements', requirePermission('inventory.move'), async (req: AuthRequest, res, next) => {
  try {
    const {
      warehouse_id, movement_type, qty,
      model_id, color_id, size_id, raw_material_id,
      from_warehouse, to_warehouse,
      reference_type, reference_id, box_uid,
      worker_id, notes
    } = req.body || {};

    if (!warehouse_id) throw BadRequest('warehouse_id kerak');
    if (!movement_type || !VALID_MOVEMENT_TYPES.includes(movement_type)) {
      throw BadRequest(`movement_type: ${VALID_MOVEMENT_TYPES.join(', ')}`);
    }
    if (!Number.isFinite(qty) || qty === 0) {
      throw BadRequest("qty 0 dan farq qilishi kerak");
    }
    const hasGood = model_id && color_id && size_id;
    const hasMaterial = raw_material_id;
    if (!hasGood && !hasMaterial) {
      throw BadRequest('Yo (model_id, color_id, size_id) yoki raw_material_id kerak');
    }
    if (hasGood && hasMaterial) {
      throw BadRequest("Bir vaqtda ham mahsulot ham xom ashyo bo'lmaydi");
    }
    if (movement_type === 'transfer' && (!from_warehouse || !to_warehouse)) {
      throw BadRequest("Transfer uchun from_warehouse va to_warehouse kerak");
    }

    const result = await withTransaction(async (client) => {
      const wh = await client.query(
        `SELECT 1 FROM warehouses WHERE id = $1 AND is_active`, [warehouse_id]
      );
      if (!wh.rows.length) throw BadRequest("Noto'g'ri ombor");

      if (raw_material_id) {
        const mat = await client.query(
          `SELECT id, current_stock FROM raw_materials WHERE id = $1 AND is_active FOR UPDATE`,
          [raw_material_id]
        );
        if (!mat.rows.length) throw NotFound('Xom ashyo topilmadi');

        let signedQty = qty;
        if (movement_type === 'receipt' || movement_type === 'return') {
          if (qty < 0) throw BadRequest('Receipt/return uchun qty musbat bolishi kerak');
          signedQty = qty;
        } else if (movement_type === 'issue') {
          if (qty > 0) throw BadRequest('Issue uchun qty manfiy bolishi kerak');
          signedQty = qty;
        }

        const newStock = Number(mat.rows[0].current_stock) + signedQty;
        if (newStock < 0) {
          throw BadRequest(
            `Yetarli zaxira yo'q: ${mat.rows[0].current_stock} mavjud, ${Math.abs(signedQty)} kerak`
          );
        }
        await client.query(
          `UPDATE raw_materials SET current_stock = $1 WHERE id = $2`,
          [newStock, raw_material_id]
        );
      }

      const ins = await client.query(`
        INSERT INTO inventory_movements
          (warehouse_id, movement_type, reference_type, reference_id,
           model_id, color_id, size_id, raw_material_id, box_uid, qty,
           user_id, worker_id, from_warehouse, to_warehouse, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *
      `, [
        warehouse_id, movement_type,
        reference_type || null, reference_id || null,
        model_id || null, color_id || null, size_id || null, raw_material_id || null,
        box_uid || null, qty,
        req.user!.id, worker_id || null,
        from_warehouse || null, to_warehouse || null,
        notes || null
      ]);

      return ins.rows[0];
    });

    await auditLog({
      event_type: 'inventory.move',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'inventory_movement', resource_id: result.id,
      action: movement_type,
      metadata: { warehouse_id, qty, model_id, raw_material_id },
      ip_address: clientIp(req)
    });

    res.json(result);
  } catch (e) { next(e); }
});

router.get('/balance/goods', requirePermission('inventory.read'), async (req, res, next) => {
  try {
    const { warehouse_id, model_id } = req.query;
    const params: any[] = [];
    const conds: string[] = [`im.model_id IS NOT NULL`];

    if (warehouse_id) { params.push(warehouse_id); conds.push(`im.warehouse_id = $${params.length}`); }
    if (model_id)     { params.push(model_id);     conds.push(`im.model_id = $${params.length}`); }

    const { rows } = await pool.query(`
      SELECT im.warehouse_id, w.name_uz AS warehouse_name,
             im.model_id, m.code AS model_code, m.name AS model_name,
             im.color_id, cl.name_uz AS color_name,
             im.size_id, sz.code AS size_code,
             COALESCE(SUM(im.qty), 0)::int AS balance
      FROM inventory_movements im
      LEFT JOIN warehouses w ON w.id = im.warehouse_id
      LEFT JOIN models m     ON m.id = im.model_id
      LEFT JOIN colors cl    ON cl.id = im.color_id
      LEFT JOIN sizes sz     ON sz.id = im.size_id
      WHERE ${conds.join(' AND ')}
      GROUP BY im.warehouse_id, w.name_uz,
               im.model_id, m.code, m.name,
               im.color_id, cl.name_uz,
               im.size_id, sz.code
      HAVING COALESCE(SUM(im.qty), 0) <> 0
      ORDER BY w.name_uz, m.code, cl.name_uz, sz.code
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/materials', requirePermission('inventory.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, code, name, unit, current_stock, min_stock, default_price, is_active,
             (current_stock <= COALESCE(min_stock, 0)) AS is_low
      FROM raw_materials
      WHERE is_active = true
      ORDER BY name
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/materials', requirePermission('inventory.move'), async (req: AuthRequest, res, next) => {
  try {
    const { code, name, unit, current_stock, min_stock, default_price } = req.body || {};
    if (!code || !name || !unit) throw BadRequest("code, name, unit kerak");

    const dup = await pool.query(`SELECT 1 FROM raw_materials WHERE code = $1`, [code]);
    if (dup.rows.length) throw BadRequest('Bu kod band');

    const { rows } = await pool.query(`
      INSERT INTO raw_materials (code, name, unit, current_stock, min_stock, default_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [code, name, unit, current_stock || 0, min_stock || null, default_price || null]);

    await auditLog({
      event_type: 'inventory.material.create',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'raw_material', resource_id: rows[0].id, action: 'create',
      after_value: rows[0], ip_address: clientIp(req)
    });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/today', requirePermission('inventory.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT im.movement_type,
             COUNT(*)::int AS event_count,
             COALESCE(SUM(ABS(im.qty)), 0)::int AS total_qty
      FROM inventory_movements im
      WHERE im.occurred_at >= CURRENT_DATE
      GROUP BY im.movement_type
      ORDER BY event_count DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
