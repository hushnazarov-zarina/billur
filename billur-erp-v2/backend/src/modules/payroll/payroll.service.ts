// Payroll service.
// Walks all finished scans within the period for a given worker, looks up the
// appropriate piece-rate (model-specific OR stage default), and produces a
// payroll_entry + detail lines.

import { withTransaction } from '../../shared/database/pool';
import { pool } from '../../shared/database/pool';
import { BadRequest, NotFound } from '../../shared/types';

export async function calculatePayroll(opts: {
  worker_id: string;
  period_start: string;     // YYYY-MM-DD
  period_end: string;
  created_by: string;
}) {
  const { worker_id, period_start, period_end } = opts;
  if (!worker_id || !period_start || !period_end) {
    throw BadRequest('worker_id, period_start, period_end kerak');
  }

  return withTransaction(async (client) => {
    // Verify worker
    const wr = await client.query(
      `SELECT id, full_name FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [worker_id]
    );
    if (!wr.rows.length) throw NotFound('Ishchi topilmadi');

    // Find all FINISHED scans in this period
    // (override scans don't count — those are admin-forced)
    const scans = await client.query(`
      SELECT pss.id AS scan_id, pss.qr_code_id, pss.stage, pss.finish_scan_at,
             pqr.order_id, pqr.model_id, pqr.quantity
      FROM production_stage_scans pss
      JOIN production_qr_codes pqr ON pqr.id = pss.qr_code_id
      WHERE pss.worker_id = $1
        AND pss.status = 'finished'
        AND pss.finish_scan_at >= $2::date
        AND pss.finish_scan_at <  ($3::date + INTERVAL '1 day')
    `, [worker_id, period_start, period_end]);

    if (!scans.rows.length) {
      return { entry: null, scans_count: 0, message: 'Bu davrda finished scan yo\'q' };
    }

    // Look up rates for each (model, stage) — fall back to default per stage
    const detailRows: any[] = [];
    let totalQty = 0;
    let totalAmt = 0;

    for (const s of scans.rows) {
      const rateRes = await client.query(`
        SELECT rate_per_piece FROM piece_rates
        WHERE is_active = true
          AND stage = $1
          AND (model_id = $2 OR model_id IS NULL)
          AND (active_from IS NULL OR active_from <= $3::date)
          AND (active_to IS NULL OR active_to >= $3::date)
        ORDER BY model_id NULLS LAST, active_from DESC
        LIMIT 1
      `, [s.stage, s.model_id, period_end]);

      const rate = Number(rateRes.rows[0]?.rate_per_piece || 0);
      const qty  = Number(s.quantity) || 0;
      const amt  = rate * qty;

      detailRows.push({
        scan_id: s.scan_id,
        qr_code_id: s.qr_code_id,
        order_id: s.order_id,
        model_id: s.model_id,
        stage: s.stage,
        quantity: qty,
        rate_per_piece: rate,
        amount: amt,
        finished_at: s.finish_scan_at,
      });
      totalQty += qty;
      totalAmt += amt;
    }

    // Upsert payroll_entry
    const entryRes = await client.query(`
      INSERT INTO payroll_entries
        (worker_id, period_start, period_end, total_quantity, gross_amount, net_amount, status)
      VALUES ($1, $2, $3, $4, $5, $5, 'draft')
      ON CONFLICT (worker_id, period_start, period_end) DO UPDATE
      SET total_quantity = EXCLUDED.total_quantity,
          gross_amount   = EXCLUDED.gross_amount,
          net_amount     = EXCLUDED.gross_amount + payroll_entries.bonus_amount
                          - payroll_entries.penalty_amount - payroll_entries.advance_amount,
          updated_at = NOW()
      RETURNING *
    `, [worker_id, period_start, period_end, totalQty, totalAmt]);

    const entry = entryRes.rows[0];

    // Replace details
    await client.query(`DELETE FROM payroll_details WHERE payroll_entry_id = $1`, [entry.id]);
    for (const d of detailRows) {
      await client.query(`
        INSERT INTO payroll_details
          (payroll_entry_id, scan_id, qr_code_id, order_id, model_id,
           stage, quantity, rate_per_piece, amount, finished_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        entry.id, d.scan_id, d.qr_code_id, d.order_id, d.model_id,
        d.stage, d.quantity, d.rate_per_piece, d.amount, d.finished_at,
      ]);
    }

    return { entry, scans_count: scans.rows.length, total_quantity: totalQty, total_amount: totalAmt };
  });
}

/** Bulk-calculate payroll for ALL workers in a period. */
export async function calculateAllPayroll(opts: {
  period_start: string;
  period_end: string;
  created_by: string;
}) {
  // Find all workers who had finished scans in the period
  const workers = await pool.query(`
    SELECT DISTINCT pss.worker_id
    FROM production_stage_scans pss
    WHERE pss.status = 'finished'
      AND pss.finish_scan_at >= $1::date
      AND pss.finish_scan_at <  ($2::date + INTERVAL '1 day')
  `, [opts.period_start, opts.period_end]);

  const results = [];
  for (const w of workers.rows) {
    const r = await calculatePayroll({
      worker_id: w.worker_id,
      period_start: opts.period_start,
      period_end: opts.period_end,
      created_by: opts.created_by,
    });
    results.push({ worker_id: w.worker_id, ...r });
  }
  return { workers_count: results.length, results };
}
