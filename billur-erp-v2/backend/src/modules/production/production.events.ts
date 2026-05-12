// Production event recording — single source of truth.
//
// Both the supervisor "manual advance" path (production.router) and the
// shop-floor "QR scan" path (qr.router) call `recordProductionEvent` so that:
//   1. production_events row is written
//   2. order_items.<stage>_qty is incremented
//   3. orders.status auto-flips from 'draft' to 'active' on first event
//   4. discrepancies are detected when downstream > upstream
//
// The function expects a PoolClient already inside a transaction — the caller
// controls commit/rollback. Use `withTransaction` from shared/database/pool.
import { PoolClient } from 'pg';
import { BadRequest, NotFound, Conflict } from '../../shared/types';

// Stages that have a per-item qty column we increment.
// Other stages (raw, finished, surplus) record an event but don't touch the
// item's columns — they're either pre-production or post-production.
export const STAGE_QTY_COLUMN: Record<string, string> = {
  cutting:  'cut_qty',
  printing: 'printed_qty',
  sewing:   'sewn_qty',
  quality:  'qc_passed_qty',
  ironing:  'ironed_qty',
  packing:  'packed_qty',
  boxing:   'boxed_qty',
  shipped:  'shipped_qty',
};

// Linear ordering used to detect "downstream > upstream" discrepancies.
// Stages not in this list are skipped during the check.
const TRACKED_FLOW: string[] = [
  'cutting', 'printing', 'sewing', 'quality', 'ironing', 'packing', 'boxing', 'shipped'
];

export interface RecordEventOptions {
  order_item_id: string;
  to_stage: string;
  qty: number;
  event_type?: string;             // default 'stage_advance'
  from_stage?: string | null;
  worker_id?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  client_event_uuid?: string | null;   // for idempotency
  notes?: string | null;
  metadata?: any;
}

export interface RecordEventResult {
  event_id: number;
  order_id: string;
  order_item_id: string;
  to_stage: string;
  qty_after: number | null;        // null for non-tracked stages
  ordered_qty: number;
  was_idempotent: boolean;          // true → returned existing row, no new write
  discrepancy_id?: string;          // set if a discrepancy row was created
}

export async function recordProductionEvent(
  client: PoolClient,
  opts: RecordEventOptions,
): Promise<RecordEventResult> {
  // ── Validation ─────────────────────────────────────────────────────
  if (!opts.order_item_id) throw BadRequest('order_item_id kerak');
  if (!opts.to_stage)      throw BadRequest('to_stage kerak');
  if (!Number.isInteger(opts.qty) || opts.qty <= 0 || opts.qty > 1_000_000) {
    throw BadRequest("qty 1-1000000 oraliqda butun son bo'lishi kerak");
  }

  // ── Idempotency check ──────────────────────────────────────────────
  if (opts.client_event_uuid) {
    const dup = await client.query(
      `SELECT pe.id, pe.order_id, pe.qty, oi.ordered_qty
         FROM production_events pe
         JOIN order_items oi ON oi.id = pe.order_item_id
        WHERE pe.client_event_uuid = $1`,
      [opts.client_event_uuid],
    );
    if (dup.rows.length) {
      const r = dup.rows[0];
      const col = STAGE_QTY_COLUMN[opts.to_stage];
      let qty_after: number | null = null;
      if (col) {
        const itemNow = await client.query(
          `SELECT ${col} AS q FROM order_items WHERE id = $1`,
          [opts.order_item_id],
        );
        qty_after = itemNow.rows[0]?.q ?? null;
      }
      return {
        event_id: r.id,
        order_id: r.order_id,
        order_item_id: opts.order_item_id,
        to_stage: opts.to_stage,
        qty_after,
        ordered_qty: r.ordered_qty,
        was_idempotent: true,
      };
    }
  }

  // ── Validate stage exists ──────────────────────────────────────────
  const stg = await client.query(
    `SELECT 1 FROM production_stages WHERE id = $1 AND is_active`,
    [opts.to_stage],
  );
  if (!stg.rows.length) throw BadRequest(`Noto'g'ri bosqich: ${opts.to_stage}`);

  if (opts.from_stage) {
    const fs = await client.query(
      `SELECT 1 FROM production_stages WHERE id = $1`, [opts.from_stage]
    );
    if (!fs.rows.length) throw BadRequest(`Noto'g'ri from_stage: ${opts.from_stage}`);
  }

  // ── Load order item & lock row for update ──────────────────────────
  const itemRes = await client.query(
    `SELECT oi.*, o.status AS order_status, o.deleted_at AS order_deleted
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = $1
      FOR UPDATE OF oi`,
    [opts.order_item_id],
  );
  if (!itemRes.rows.length) throw NotFound('order_item topilmadi');
  const item = itemRes.rows[0];
  if (item.order_deleted) throw Conflict("Buyurtma o'chirilgan");
  if (item.order_status === 'cancelled') throw Conflict('Buyurtma bekor qilingan');
  if (item.order_status === 'completed') throw Conflict('Buyurtma allaqachon tugagan');

  const col = STAGE_QTY_COLUMN[opts.to_stage];
  let qtyAfter: number | null = null;
  let discrepancyId: string | undefined;

  if (col) {
    const currentQty: number = item[col] ?? 0;
    const newQty = currentQty + opts.qty;
    const ordered: number = item.ordered_qty;

    // Hard cap — allow 10% surplus headroom (textile reality: cutting often
    // produces extras), but never more than that.
    const SURPLUS_BUFFER = 1.1;
    if (newQty > Math.ceil(ordered * SURPLUS_BUFFER)) {
      throw Conflict(
        `Bu satr uchun "${opts.to_stage}" bosqichida ` +
        `${currentQty} mavjud, ${opts.qty} qo'shilsa ${newQty} bo'ladi, ` +
        `lekin buyurtma ${ordered} (max ${Math.ceil(ordered * SURPLUS_BUFFER)}). ` +
        `Ortiqchani izlishkaga yozing.`
      );
    }
    qtyAfter = newQty;

    // Discrepancy detection — if any *upstream* tracked stage has lower qty
    // than the new value, we've got a "downstream > upstream" mismatch.
    const targetIdx = TRACKED_FLOW.indexOf(opts.to_stage);
    if (targetIdx > 0) {
      for (let i = targetIdx - 1; i >= 0; i--) {
        const upStage = TRACKED_FLOW[i];
        const upCol = STAGE_QTY_COLUMN[upStage];
        const upQty: number = item[upCol] ?? 0;
        if (upQty > 0 && upQty < newQty) {
          // Upstream had some qty (so it's a stage this product uses) but
          // less than what we're now claiming. Open a discrepancy.
          const dr = await client.query(
            `INSERT INTO discrepancies
               (order_item_id, from_stage, to_stage, out_qty, in_qty, diff_qty, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'open')
             RETURNING id`,
            [opts.order_item_id, upStage, opts.to_stage, upQty, newQty, newQty - upQty],
          );
          discrepancyId = dr.rows[0].id;
          // Also flip the order to 'problem' so supervisors notice.
          await client.query(
            `UPDATE orders SET status = 'problem', updated_at = NOW()
              WHERE id = $1 AND status = 'active'`,
            [item.order_id],
          );
          break; // one discrepancy is enough; first upstream gap is the one to investigate
        }
      }
    }
  }

  // ── Insert production_events ───────────────────────────────────────
  const evRes = await client.query(
    `INSERT INTO production_events
       (event_type, order_id, order_item_id, from_stage, to_stage, qty,
        worker_id, user_id, device_id, client_event_uuid, notes, metadata, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     RETURNING id`,
    [
      opts.event_type ?? 'stage_advance',
      item.order_id, opts.order_item_id,
      opts.from_stage ?? null, opts.to_stage, opts.qty,
      opts.worker_id ?? null, opts.user_id ?? null, opts.device_id ?? null,
      opts.client_event_uuid ?? null,
      opts.notes ?? null,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
    ],
  );
  const eventId: number = evRes.rows[0].id;

  // ── Update item qty column ─────────────────────────────────────────
  if (col) {
    await client.query(
      `UPDATE order_items SET ${col} = ${col} + $1 WHERE id = $2`,
      [opts.qty, opts.order_item_id],
    );
  }

  // ── Auto-promote draft → active on first event ────────────────────
  if (item.order_status === 'draft') {
    await client.query(
      `UPDATE orders SET status = 'active', updated_at = NOW()
        WHERE id = $1 AND status = 'draft'`,
      [item.order_id],
    );
  }

  return {
    event_id: eventId,
    order_id: item.order_id,
    order_item_id: opts.order_item_id,
    to_stage: opts.to_stage,
    qty_after: qtyAfter,
    ordered_qty: item.ordered_qty,
    was_idempotent: false,
    discrepancy_id: discrepancyId,
  };
}
