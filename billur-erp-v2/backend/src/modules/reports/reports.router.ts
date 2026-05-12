import { Router } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../../shared/database/pool';
import { AuthRequest } from '../../shared/types';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { auditLog, clientIp } from '../../shared/middleware/security';

const router = Router();
router.use(requireAuth);

router.get('/worker-performance', requirePermission('reports.read'), async (req, res, next) => {
  try {
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;
    const params: any[] = [];
    const conds: string[] = [];
    if (since) { params.push(since); conds.push(`pe.occurred_at >= $${params.length}`); }
    if (until) { params.push(until); conds.push(`pe.occurred_at <= $${params.length}`); }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT pe.worker_id, w.full_name AS worker_name, w.employee_code, w.position,
             pe.to_stage, ps.name_uz AS stage_name,
             COUNT(*)::int AS event_count,
             COALESCE(SUM(pe.qty), 0)::int AS total_qty
      FROM production_events pe
      LEFT JOIN workers w ON w.id = pe.worker_id
      LEFT JOIN production_stages ps ON ps.id = pe.to_stage
      ${whereSql}
      GROUP BY pe.worker_id, w.full_name, w.employee_code, w.position,
               pe.to_stage, ps.name_uz
      ORDER BY total_qty DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/clients-summary', requirePermission('reports.read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.code, c.name, c.balance_uzs,
             (SELECT COUNT(*)::int FROM orders o
                WHERE o.client_id = c.id AND o.deleted_at IS NULL) AS total_orders,
             (SELECT COUNT(*)::int FROM orders o
                WHERE o.client_id = c.id AND o.deleted_at IS NULL
                  AND o.status IN ('active','problem')) AS active_orders,
             (SELECT COALESCE(SUM(o.total_pieces), 0)::int FROM orders o
                WHERE o.client_id = c.id AND o.deleted_at IS NULL) AS total_pieces
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/daily-production', requirePermission('reports.read'), async (req, res, next) => {
  try {
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;
    const params: any[] = [];
    const conds: string[] = [];
    if (since) { params.push(since); conds.push(`pe.occurred_at >= $${params.length}`); }
    if (until) { params.push(until); conds.push(`pe.occurred_at <= $${params.length}`); }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT DATE(pe.occurred_at) AS day,
             pe.to_stage,
             ps.name_uz AS stage_name,
             COUNT(*)::int AS event_count,
             COALESCE(SUM(pe.qty), 0)::int AS qty
      FROM production_events pe
      LEFT JOIN production_stages ps ON ps.id = pe.to_stage
      ${whereSql}
      GROUP BY DATE(pe.occurred_at), pe.to_stage, ps.name_uz
      ORDER BY day DESC, ps.sort_order
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/export/orders', requirePermission('reports.export'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.external_code, o.order_type, o.status,
             c.code AS client_code, c.name AS client_name,
             o.deadline, o.priority, o.total_pieces, o.notes,
             o.created_at,
             u.full_name AS created_by_name
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      LEFT JOIN users u   ON u.id = o.created_by
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT 5000
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Zakazlar');
    ws.columns = [
      { header: 'Kod',         key: 'external_code',  width: 14 },
      { header: 'Tur',         key: 'order_type',     width: 10 },
      { header: 'Status',      key: 'status',         width: 12 },
      { header: 'Klient kod',  key: 'client_code',    width: 12 },
      { header: 'Klient',      key: 'client_name',    width: 26 },
      { header: 'Deadline',    key: 'deadline',       width: 12 },
      { header: 'Priority',    key: 'priority',       width: 8 },
      { header: 'Mahsulot',    key: 'total_pieces',   width: 10 },
      { header: 'Eslatma',     key: 'notes',          width: 30 },
      { header: 'Yaratildi',   key: 'created_at',     width: 18 },
      { header: 'Kim',         key: 'created_by_name', width: 18 }
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));

    await auditLog({
      event_type: 'reports.export',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'report', resource_id: 'orders', action: 'export',
      metadata: { rows: rows.length },
      ip_address: clientIp(req)
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

router.get('/export/production', requirePermission('reports.export'), async (req: AuthRequest, res, next) => {
  try {
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;
    const params: any[] = [];
    const conds: string[] = [];
    if (since) { params.push(since); conds.push(`pe.occurred_at >= $${params.length}`); }
    if (until) { params.push(until); conds.push(`pe.occurred_at <= $${params.length}`); }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT pe.occurred_at, pe.to_stage, ps.name_uz AS stage_name, pe.qty,
             o.external_code AS order_code, o.order_type,
             m.code AS model_code, cl.name_uz AS color_name, sz.code AS size_code,
             w.full_name AS worker_name, w.employee_code,
             pe.notes
      FROM production_events pe
      LEFT JOIN production_stages ps ON ps.id = pe.to_stage
      LEFT JOIN orders o  ON o.id = pe.order_id
      LEFT JOIN order_items oi ON oi.id = pe.order_item_id
      LEFT JOIN models m  ON m.id = oi.model_id
      LEFT JOIN colors cl ON cl.id = oi.color_id
      LEFT JOIN sizes sz  ON sz.id = oi.size_id
      LEFT JOIN workers w ON w.id = pe.worker_id
      ${whereSql}
      ORDER BY pe.occurred_at DESC
      LIMIT 10000
    `, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Production');
    ws.columns = [
      { header: 'Vaqt',       key: 'occurred_at',   width: 18 },
      { header: 'Bosqich',    key: 'stage_name',    width: 14 },
      { header: 'Soni',       key: 'qty',           width: 8 },
      { header: 'Zakaz',      key: 'order_code',    width: 14 },
      { header: 'Tur',        key: 'order_type',    width: 10 },
      { header: 'Model',      key: 'model_code',    width: 12 },
      { header: 'Rang',       key: 'color_name',    width: 14 },
      { header: "O'lcham",    key: 'size_code',     width: 8 },
      { header: 'Ishchi',     key: 'worker_name',   width: 20 },
      { header: 'Tabel',      key: 'employee_code', width: 10 },
      { header: 'Eslatma',    key: 'notes',         width: 30 }
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));

    await auditLog({
      event_type: 'reports.export',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'report', resource_id: 'production', action: 'export',
      metadata: { rows: rows.length, since, until },
      ip_address: clientIp(req)
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="production-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

router.get('/export/workers', requirePermission('reports.export'), async (req: AuthRequest, res, next) => {
  try {
    const since = req.query.since as string | undefined;
    const params: any[] = [];
    let whereSql = '';
    if (since) { params.push(since); whereSql = `WHERE pe.occurred_at >= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT w.employee_code, w.full_name, w.position,
             ps.name_uz AS default_stage_name,
             COALESCE(stats.event_count, 0) AS event_count,
             COALESCE(stats.total_qty, 0) AS total_qty
      FROM workers w
      LEFT JOIN production_stages ps ON ps.id = w.default_stage
      LEFT JOIN (
        SELECT pe.worker_id,
               COUNT(*)::int AS event_count,
               COALESCE(SUM(pe.qty), 0)::int AS total_qty
        FROM production_events pe
        ${whereSql}
        GROUP BY pe.worker_id
      ) stats ON stats.worker_id = w.id
      WHERE w.deleted_at IS NULL
      ORDER BY total_qty DESC, w.full_name
    `, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ishchilar');
    ws.columns = [
      { header: 'Tabel',          key: 'employee_code',       width: 10 },
      { header: 'F.I.O.',         key: 'full_name',           width: 26 },
      { header: 'Lavozim',        key: 'position',            width: 14 },
      { header: 'Bosqich',        key: 'default_stage_name',  width: 14 },
      { header: 'Events',         key: 'event_count',         width: 10 },
      { header: 'Jami soni',      key: 'total_qty',           width: 12 }
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));

    await auditLog({
      event_type: 'reports.export',
      user_id: req.user!.id, username: req.user!.username,
      resource_type: 'report', resource_id: 'workers', action: 'export',
      metadata: { rows: rows.length, since },
      ip_address: clientIp(req)
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="workers-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

export default router;
