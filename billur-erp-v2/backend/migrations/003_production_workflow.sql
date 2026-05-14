-- BILLUR ERP — Migration 003
-- Production QR codes with worker lock, START/FINISH scans, piece rates,
-- payroll entries, worker documents, BoxApp sync queue.

-- ── Production QR codes (bichuvdan boshlanadi) ───────────────────────────
CREATE TABLE IF NOT EXISTS production_qr_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code         TEXT NOT NULL UNIQUE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id   UUID REFERENCES order_items(id) ON DELETE SET NULL,
  model_id        UUID REFERENCES models(id),
  color_id        UUID REFERENCES colors(id),
  size_id         UUID REFERENCES sizes(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  current_stage   TEXT NOT NULL DEFAULT 'cutting' REFERENCES production_stages(id),
  current_worker_id UUID REFERENCES workers(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','rejected','reworking')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pqr_order      ON production_qr_codes(order_id);
CREATE INDEX IF NOT EXISTS idx_pqr_stage      ON production_qr_codes(current_stage);
CREATE INDEX IF NOT EXISTS idx_pqr_worker     ON production_qr_codes(current_worker_id) WHERE current_worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pqr_status     ON production_qr_codes(status);

-- ── Stage scan log (START / FINISH) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_stage_scans (
  id               BIGSERIAL PRIMARY KEY,
  qr_code_id       UUID NOT NULL REFERENCES production_qr_codes(id) ON DELETE CASCADE,
  stage            TEXT NOT NULL REFERENCES production_stages(id),
  worker_id        UUID NOT NULL REFERENCES workers(id),
  start_scan_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finish_scan_at   TIMESTAMPTZ,
  duration_seconds INTEGER,
  status           TEXT NOT NULL DEFAULT 'started'
                   CHECK (status IN ('started','finished','cancelled','override')),
  device_id        TEXT,
  ip_address       TEXT,
  is_suspicious    BOOLEAN NOT NULL DEFAULT false,
  suspicious_reason TEXT,
  override_by      UUID REFERENCES users(id),
  override_at      TIMESTAMPTZ,
  override_reason  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pss_qr       ON production_stage_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_pss_worker   ON production_stage_scans(worker_id);
CREATE INDEX IF NOT EXISTS idx_pss_stage    ON production_stage_scans(stage);
CREATE INDEX IF NOT EXISTS idx_pss_started  ON production_stage_scans(start_scan_at DESC);

-- Each worker can only have one "started" scan per (qr_code, stage) at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_pss_active_worker
  ON production_stage_scans (qr_code_id, stage, worker_id)
  WHERE status = 'started';

-- A worker can only complete a (qr_code, stage) pair ONCE (no rescanning)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pss_completed
  ON production_stage_scans (qr_code_id, stage, worker_id)
  WHERE status IN ('finished','override');

-- ── Quality decisions on scan finish ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_decisions (
  id                 BIGSERIAL PRIMARY KEY,
  scan_id            BIGINT NOT NULL REFERENCES production_stage_scans(id) ON DELETE CASCADE,
  qr_code_id         UUID NOT NULL REFERENCES production_qr_codes(id) ON DELETE CASCADE,
  decision           TEXT NOT NULL
                     CHECK (decision IN ('passed','sort_1','sort_2','defect','rework','reject')),
  defect_type        TEXT,
  description        TEXT,
  photo_url          TEXT,
  responsible_worker_id UUID REFERENCES workers(id),
  responsible_stage  TEXT REFERENCES production_stages(id),
  quantity_affected  INTEGER NOT NULL DEFAULT 0,
  checked_by         UUID NOT NULL REFERENCES workers(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qd_qr        ON quality_decisions(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qd_decision  ON quality_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_qd_resp      ON quality_decisions(responsible_worker_id);

-- ── Piece rates (operation-level pricing) ────────────────────────────────
CREATE TABLE IF NOT EXISTS piece_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        UUID REFERENCES models(id) ON DELETE CASCADE,
  stage           TEXT NOT NULL REFERENCES production_stages(id),
  operation_name  TEXT,
  rate_per_piece  NUMERIC(12, 2) NOT NULL CHECK (rate_per_piece >= 0),
  currency        TEXT NOT NULL DEFAULT 'UZS',
  active_from     DATE NOT NULL DEFAULT CURRENT_DATE,
  active_to       DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_model_stage ON piece_rates(model_id, stage) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pr_stage       ON piece_rates(stage) WHERE is_active = true;

-- Default fallback rate (when model_id IS NULL it applies to all models)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pr_default_per_stage
  ON piece_rates(stage)
  WHERE is_active = true AND model_id IS NULL;

-- ── Payroll entries (per worker per period) ─────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES workers(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  total_quantity  INTEGER NOT NULL DEFAULT 0,
  gross_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  bonus_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  penalty_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  advance_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'UZS',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_worker_period
  ON payroll_entries(worker_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_entries(status);

-- ── Payroll detail lines ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_details (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id  UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  scan_id           BIGINT REFERENCES production_stage_scans(id),
  qr_code_id        UUID REFERENCES production_qr_codes(id),
  order_id          UUID REFERENCES orders(id),
  model_id          UUID REFERENCES models(id),
  stage             TEXT NOT NULL,
  quantity          INTEGER NOT NULL,
  rate_per_piece    NUMERIC(12, 2) NOT NULL,
  amount            NUMERIC(14, 2) NOT NULL,
  finished_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pd_payroll ON payroll_details(payroll_entry_id);

-- ── Worker profile extension ─────────────────────────────────────────────
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS user_id          UUID UNIQUE REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS photo_url        TEXT,
  ADD COLUMN IF NOT EXISTS address          TEXT,
  ADD COLUMN IF NOT EXISTS birth_date       DATE,
  ADD COLUMN IF NOT EXISTS gender           TEXT,
  ADD COLUMN IF NOT EXISTS passport_series  TEXT,
  ADD COLUMN IF NOT EXISTS passport_number  TEXT,
  ADD COLUMN IF NOT EXISTS passport_issued_by TEXT,
  ADD COLUMN IF NOT EXISTS passport_issue_date  DATE,
  ADD COLUMN IF NOT EXISTS passport_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS pinfl            TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS bank_card        TEXT,
  ADD COLUMN IF NOT EXISTS contract_type    TEXT,
  ADD COLUMN IF NOT EXISTS base_salary      NUMERIC(14, 2);

CREATE INDEX IF NOT EXISTS idx_workers_user ON workers(user_id) WHERE user_id IS NOT NULL;

-- ── Worker documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  issued_date     DATE,
  expiry_date     DATE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','verified','expired','expiring_soon','rejected')),
  uploaded_by     UUID REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_wd_worker ON worker_documents(worker_id);
CREATE INDEX IF NOT EXISTS idx_wd_type   ON worker_documents(document_type);

-- ── BoxApp sync queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boxapp_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('box','shipment','order')),
  entity_id       TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
  payload         JSONB NOT NULL,
  sync_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (sync_status IN ('pending','syncing','synced','failed','cancelled')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error      TEXT,
  next_retry_at   TIMESTAMPTZ,
  remote_id       TEXT,
  remote_response JSONB,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bsj_status   ON boxapp_sync_jobs(sync_status);
CREATE INDEX IF NOT EXISTS idx_bsj_entity   ON boxapp_sync_jobs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_bsj_retry    ON boxapp_sync_jobs(next_retry_at)
  WHERE sync_status IN ('pending','failed');

-- ── New permissions ──────────────────────────────────────────────────────
INSERT INTO permissions (id, name_uz, description) VALUES
  ('production.qr.create',    'QR yaratish',                   'Production QR code yaratish'),
  ('production.qr.scan',      'QR scan qilish',                'Stage scan (START/FINISH)'),
  ('production.qr.override',  'Manual override',               'Adminga lock buzish huquqi'),
  ('production.trace.view',   'Traceability ko''rish',         'QR/Box history ko''rish'),
  ('payroll.view_own',        'O''z oyligini ko''rish',        'Worker o''z payrolli'),
  ('payroll.view_all',        'Hamma payrollni ko''rish',      'HR/Admin'),
  ('payroll.calculate',       'Payroll hisoblash',             'Period hisoblash'),
  ('payroll.approve',         'Payroll tasdiqlash',            'Admin/Owner'),
  ('piece_rates.read',        'Piece rates ko''rish',          ''),
  ('piece_rates.update',      'Piece rates o''zgartirish',     ''),
  ('workers.documents.view_own',  'O''z hujjatlarini ko''rish', ''),
  ('workers.documents.view_all',  'Hamma hujjatlarni ko''rish', 'HR'),
  ('workers.documents.upload',    'Hujjat yuklash',             ''),
  ('boxapp.view',             'BoxApp ko''rish',               ''),
  ('boxapp.sync',             'BoxApp sync qilish',            ''),
  ('boxapp.retry',            'BoxApp failed retry',           '')
ON CONFLICT (id) DO NOTHING;

-- Owner gets all new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'owner', id FROM permissions
WHERE id IN (
  'production.qr.create','production.qr.scan','production.qr.override','production.trace.view',
  'payroll.view_own','payroll.view_all','payroll.calculate','payroll.approve',
  'piece_rates.read','piece_rates.update',
  'workers.documents.view_own','workers.documents.view_all','workers.documents.upload',
  'boxapp.view','boxapp.sync','boxapp.retry'
)
ON CONFLICT DO NOTHING;

-- Stage worker roles get scan permission only on their stage
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin', 'production.qr.create'),
  ('admin', 'production.qr.scan'),
  ('admin', 'production.qr.override'),
  ('admin', 'production.trace.view'),
  ('admin', 'payroll.view_all'),
  ('admin', 'payroll.calculate'),
  ('admin', 'piece_rates.read'),
  ('admin', 'piece_rates.update'),
  ('admin', 'workers.documents.view_all'),
  ('admin', 'workers.documents.upload'),
  ('admin', 'boxapp.view'),
  ('admin', 'boxapp.sync'),
  ('admin', 'boxapp.retry')
ON CONFLICT DO NOTHING;

ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS name_uz TEXT,
ADD COLUMN IF NOT EXISTS name_ru TEXT,
ADD COLUMN IF NOT EXISTS name_en TEXT;

-- ── Trigger to keep updated_at fresh ─────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pqr_updated_at ON production_qr_codes;
CREATE TRIGGER pqr_updated_at BEFORE UPDATE ON production_qr_codes
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

DROP TRIGGER IF EXISTS pr_updated_at ON piece_rates;
CREATE TRIGGER pr_updated_at BEFORE UPDATE ON piece_rates
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

DROP TRIGGER IF EXISTS pe_updated_at ON payroll_entries;
CREATE TRIGGER pe_updated_at BEFORE UPDATE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
