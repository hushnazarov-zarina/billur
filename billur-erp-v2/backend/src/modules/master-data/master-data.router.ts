import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { AuthRequest, BadRequest, NotFound, Conflict } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';

const router = Router();
router.use(requireAuth);

// MODELS
router.get('/models', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.*, c.name AS client_name
      FROM models m
      LEFT JOIN clients c ON c.id = m.client_id
      WHERE m.deleted_at IS NULL
      ORDER BY m.code
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/models', requirePermission('clients.update'), async (req: AuthRequest, res, next) => {
  try {
    const { code, name, description, client_id, product_type, has_top_bottom } = req.body || {};
    if (!code || !name) throw BadRequest('Kod va nom kerak');
    const dup = await pool.query(`SELECT 1 FROM models WHERE code = $1`, [code]);
    if (dup.rows.length) throw Conflict('Bu kod band');
    const { rows } = await pool.query(`
      INSERT INTO models (code, name, description, client_id, product_type, has_top_bottom)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [code, name, description || null, client_id || null, product_type || null, !!has_top_bottom]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/models/:id', requirePermission('clients.update'), async (req: AuthRequest, res, next) => {
  try {
    const { name, description, client_id, product_type, has_top_bottom, is_active } = req.body || {};
    const r = await pool.query(`
      UPDATE models SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        client_id = COALESCE($3, client_id),
        product_type = COALESCE($4, product_type),
        has_top_bottom = COALESCE($5, has_top_bottom),
        is_active = COALESCE($6, is_active)
      WHERE id = $7 AND deleted_at IS NULL
    `, [name, description, client_id, product_type, has_top_bottom, is_active, req.params.id]);
    if (!r.rowCount) throw NotFound();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/models/:id', requirePermission('clients.delete'), async (req, res, next) => {
  try {
    await pool.query(`UPDATE models SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// COLORS
router.get('/colors', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM colors WHERE is_active ORDER BY name_uz`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/colors', requirePermission('clients.update'), async (req, res, next) => {
  try {
    const { code, name_uz, hex } = req.body || {};
    if (!code || !name_uz) throw BadRequest('Kod va nom kerak');
    const dup = await pool.query(`SELECT 1 FROM colors WHERE code = $1`, [code]);
    if (dup.rows.length) throw Conflict('Bu kod band');
    const { rows } = await pool.query(
      `INSERT INTO colors (code, name_uz, hex) VALUES ($1,$2,$3) RETURNING *`,
      [code, name_uz, hex || null]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// SIZES
router.get('/sizes', async (req, res, next) => {
  try {
    const { category } = req.query;
    const params: any[] = [];
    let q = `SELECT * FROM sizes`;
    if (category) {
      params.push(category);
      q += ` WHERE category = $${params.length}`;
    }
    q += ` ORDER BY sort_order, code`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/sizes', requirePermission('clients.update'), async (req, res, next) => {
  try {
    const { code, category, sort_order } = req.body || {};
    if (!code) throw BadRequest('Kod kerak');
    const { rows } = await pool.query(
      `INSERT INTO sizes (code, category, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET category = EXCLUDED.category, sort_order = EXCLUDED.sort_order
       RETURNING *`,
      [code, category || null, sort_order || 0]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// PRODUCTION STAGES (read-only)
router.get('/stages', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM production_stages WHERE is_active ORDER BY sort_order`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// WAREHOUSES (read-only)
router.get('/warehouses', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM warehouses WHERE is_active ORDER BY name_uz`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
