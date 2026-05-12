import { Router } from 'express';
import { pool } from '../../shared/database/pool';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/event-types', requirePermission('audit.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT event_type, COUNT(*)::int AS count
      FROM audit_logs
      WHERE at >= NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY event_type
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/', requirePermission('audit.read'), async (req, res, next) => {
  try {
    const { event_type, user_id, resource_type, resource_id, since, until, limit } = req.query;
    const params: any[] = [];
    const conds: string[] = [];

    if (event_type)    { params.push(event_type);    conds.push(`event_type = $${params.length}`); }
    if (user_id)       { params.push(user_id);       conds.push(`user_id = $${params.length}`); }
    if (resource_type) { params.push(resource_type); conds.push(`resource_type = $${params.length}`); }
    if (resource_id)   { params.push(resource_id);   conds.push(`resource_id = $${params.length}`); }
    if (since)         { params.push(since);         conds.push(`at >= $${params.length}`); }
    if (until)         { params.push(until);         conds.push(`at <= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(String(limit || '200'), 10) || 200, 1000);

    const { rows } = await pool.query(`
      SELECT id, event_type, user_id, username, resource_type, resource_id,
             action, before_value, after_value, ip_address, user_agent, metadata, at
      FROM audit_logs
      ${whereSql}
      ORDER BY at DESC
      LIMIT ${lim}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
