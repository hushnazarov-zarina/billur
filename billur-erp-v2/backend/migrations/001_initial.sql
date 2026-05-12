-- Billur ERP — Initial schema
-- Hamma jadvallarni IF NOT EXISTS bilan yaratamiz, idempotent

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============== ROLES & PERMISSIONS ==============
CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,
  name_uz     TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          TEXT PRIMARY KEY,
  resource    TEXT NOT NULL,
  action      TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============== USERS ==============
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role_id         TEXT REFERENCES roles(id),
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  is_active       BOOLEAN DEFAULT true,
  failed_attempts INTEGER DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  last_login_ip   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  granted       BOOLEAN NOT NULL,
  granted_by    UUID REFERENCES users(id),
  granted_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_history (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  username        TEXT,
  success         BOOLEAN NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  failure_reason  TEXT,
  at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, at DESC);

-- ============== CLIENTS (Firmalar) ==============
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  pricing_type    TEXT,
  default_pricing JSONB,
  services        TEXT[],
  is_active       BOOLEAN DEFAULT true,
  balance_uzs     NUMERIC(15,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS client_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id),
  type            TEXT NOT NULL,
  amount_uzs      NUMERIC(15,2) NOT NULL,
  reference_id    UUID,
  description     TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctx_client ON client_transactions(client_id, created_at DESC);

-- ============== MASTER DATA ==============
CREATE TABLE IF NOT EXISTS models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  client_id       UUID REFERENCES clients(id),
  product_type    TEXT,
  has_top_bottom  BOOLEAN DEFAULT false,
  default_image_url TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS colors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name_uz     TEXT NOT NULL,
  hex         TEXT,
  is_active   BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS sizes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  category    TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL,
  current_stock   NUMERIC(12,3) DEFAULT 0,
  min_stock       NUMERIC(12,3),
  default_price   NUMERIC(12,2),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============== PRODUCTION STAGES ==============
CREATE TABLE IF NOT EXISTS production_stages (
  id            TEXT PRIMARY KEY,
  name_uz       TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  has_quality_check BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true
);

-- ============== ORDERS ==============
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type            TEXT NOT NULL CHECK (order_type IN ('speka','set','standard')),
  external_code         TEXT,
  client_id             UUID REFERENCES clients(id),
  responsible_user_id   UUID REFERENCES users(id),
  deadline              DATE,
  priority              INTEGER DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'draft',
  notes                 TEXT,
  total_pieces          INTEGER DEFAULT 0,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_code
  ON orders(order_type, external_code)
  WHERE external_code IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  model_id        UUID REFERENCES models(id),
  color_id        UUID REFERENCES colors(id),
  size_id         UUID REFERENCES sizes(id),
  ordered_qty     INTEGER NOT NULL,
  cut_qty         INTEGER DEFAULT 0,
  printed_qty     INTEGER DEFAULT 0,
  sewn_qty        INTEGER DEFAULT 0,
  qc_passed_qty   INTEGER DEFAULT 0,
  ironed_qty      INTEGER DEFAULT 0,
  packed_qty      INTEGER DEFAULT 0,
  boxed_qty       INTEGER DEFAULT 0,
  shipped_qty     INTEGER DEFAULT 0,
  rejected_qty    INTEGER DEFAULT 0,
  surplus_qty     INTEGER DEFAULT 0,
  unit_price_uzs  NUMERIC(12,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, model_id, color_id, size_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_model ON order_items(model_id);

CREATE TABLE IF NOT EXISTS set_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_code        TEXT NOT NULL,
  set_number      TEXT NOT NULL,
  model_code      TEXT NOT NULL,
  color_code      TEXT NOT NULL,
  size_code       TEXT NOT NULL,
  order_item_id   UUID REFERENCES order_items(id),
  parsed_ok       BOOLEAN DEFAULT true,
  parse_error     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============== PRODUCTION EVENTS (Heart of MES) ==============
CREATE TABLE IF NOT EXISTS production_events (
  id                  BIGSERIAL PRIMARY KEY,
  event_type          TEXT NOT NULL,
  order_id            UUID REFERENCES orders(id),
  order_item_id       UUID REFERENCES order_items(id),
  from_stage          TEXT REFERENCES production_stages(id),
  to_stage            TEXT REFERENCES production_stages(id),
  qty                 INTEGER NOT NULL,
  worker_id           UUID,
  user_id             UUID REFERENCES users(id),
  device_id           TEXT,
  client_event_uuid   TEXT,
  notes               TEXT,
  metadata            JSONB,
  occurred_at         TIMESTAMPTZ DEFAULT NOW(),
  recorded_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_order ON production_events(order_id);
CREATE INDEX IF NOT EXISTS idx_events_item ON production_events(order_item_id);
CREATE INDEX IF NOT EXISTS idx_events_worker ON production_events(worker_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_stage ON production_events(to_stage, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency
  ON production_events(client_event_uuid)
  WHERE client_event_uuid IS NOT NULL;

-- ============== QUALITY ==============
CREATE TABLE IF NOT EXISTS quality_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   UUID REFERENCES order_items(id),
  stage           TEXT REFERENCES production_stages(id),
  checked_qty     INTEGER NOT NULL,
  passed_qty      INTEGER NOT NULL,
  defect_1st_qty  INTEGER DEFAULT 0,
  defect_2nd_qty  INTEGER DEFAULT 0,
  rejected_qty    INTEGER DEFAULT 0,
  repair_qty      INTEGER DEFAULT 0,
  surplus_qty     INTEGER DEFAULT 0,
  worker_id       UUID,
  user_id         UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS defects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_check_id      UUID REFERENCES quality_checks(id),
  defect_type           TEXT,
  severity              TEXT,
  qty                   INTEGER NOT NULL,
  responsible_worker_id UUID,
  responsible_stage     TEXT,
  photo_urls            TEXT[],
  description           TEXT,
  status                TEXT DEFAULT 'open',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discrepancies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     UUID REFERENCES order_items(id),
  from_stage        TEXT,
  to_stage          TEXT,
  out_qty           INTEGER NOT NULL,
  in_qty            INTEGER NOT NULL,
  diff_qty          INTEGER NOT NULL,
  status            TEXT DEFAULT 'open',
  resolution        TEXT,
  resolution_notes  TEXT,
  resolved_by       UUID REFERENCES users(id),
  resolved_at       TIMESTAMPTZ,
  detected_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disc_status ON discrepancies(status, detected_at DESC);

-- ============== INVENTORY ==============
CREATE TABLE IF NOT EXISTS warehouses (
  id          TEXT PRIMARY KEY,
  name_uz     TEXT NOT NULL,
  type        TEXT NOT NULL,
  location    TEXT,
  is_active   BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    TEXT REFERENCES warehouses(id),
  movement_type   TEXT NOT NULL,
  reference_type  TEXT,
  reference_id    UUID,
  model_id        UUID REFERENCES models(id),
  color_id        UUID REFERENCES colors(id),
  size_id         UUID REFERENCES sizes(id),
  raw_material_id UUID REFERENCES raw_materials(id),
  box_uid         TEXT,
  qty             INTEGER NOT NULL,
  user_id         UUID REFERENCES users(id),
  worker_id       UUID,
  from_warehouse  TEXT,
  to_warehouse    TEXT,
  notes           TEXT,
  occurred_at     TIMESTAMPTZ DEFAULT NOW(),
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_warehouse ON inventory_movements(warehouse_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_model ON inventory_movements(model_id, color_id, size_id);

-- ============== SURPLUS (Izlishka) ==============
CREATE TABLE IF NOT EXISTS surplus_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id   UUID REFERENCES orders(id),
  source_item_id    UUID REFERENCES order_items(id),
  client_id         UUID REFERENCES clients(id),
  model_id          UUID REFERENCES models(id),
  color_id          UUID REFERENCES colors(id),
  size_id           UUID REFERENCES sizes(id),
  qty               INTEGER NOT NULL,
  reason            TEXT,
  has_top           BOOLEAN,
  has_bottom        BOOLEAN,
  status            TEXT DEFAULT 'in_warehouse',
  arrived_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surplus_status ON surplus_items(status);
CREATE INDEX IF NOT EXISTS idx_surplus_model ON surplus_items(model_id, color_id, size_id);

-- ============== WORKERS ==============
CREATE TABLE IF NOT EXISTS workers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code   TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  position        TEXT NOT NULL,
  default_stage   TEXT REFERENCES production_stages(id),
  hire_date       DATE,
  is_active       BOOLEAN DEFAULT true,
  photo_url       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS worker_qr_tokens (
  worker_id     UUID REFERENCES workers(id) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true,
  PRIMARY KEY (worker_id, token)
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id                  BIGSERIAL PRIMARY KEY,
  worker_id           UUID REFERENCES workers(id),
  token               TEXT,
  device_id           TEXT,
  stage               TEXT REFERENCES production_stages(id),
  order_item_id       UUID REFERENCES order_items(id),
  qty                 INTEGER,
  scan_type           TEXT,
  is_suspicious       BOOLEAN DEFAULT false,
  suspicious_reason   TEXT,
  approved_by         UUID REFERENCES users(id),
  ip_address          TEXT,
  user_agent          TEXT,
  scanned_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_worker ON qr_scans(worker_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_suspicious
  ON qr_scans(is_suspicious, scanned_at DESC) WHERE is_suspicious;

-- ============== BOXES (BoxApp from v3) ==============
CREATE TABLE IF NOT EXISTS boxes (
  uid             TEXT PRIMARY KEY,
  box_num         TEXT NOT NULL,
  zakaz           TEXT NOT NULL,
  order_id        UUID REFERENCES orders(id),
  type            TEXT NOT NULL CHECK (type IN ('simple','mix')),
  kg              NUMERIC(8,2) DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('packed','warehouse','shipping','shipped')),
  model           TEXT,
  color           TEXT,
  sizes           JSONB,
  items           JSONB,
  created_by      UUID REFERENCES users(id),
  created_by_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_date    DATE,
  updated_at      TIMESTAMPTZ,
  status_history  JSONB DEFAULT '[]'::jsonb,
  UNIQUE(zakaz, box_num)
);

CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes(status);
CREATE INDEX IF NOT EXISTS idx_boxes_zakaz ON boxes(zakaz);

CREATE TABLE IF NOT EXISTS shipments (
  id              TEXT PRIMARY KEY,
  truck_info      TEXT,
  note            TEXT,
  status          TEXT NOT NULL CHECK (status IN ('open','closed')),
  box_uids        JSONB DEFAULT '[]'::jsonb,
  snapshot        JSONB,
  client_id       UUID REFERENCES clients(id),
  created_by      UUID REFERENCES users(id),
  created_by_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  closed_by       UUID REFERENCES users(id)
);

-- ============== PRINT ==============
CREATE TABLE IF NOT EXISTS print_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id),
  order_id        UUID REFERENCES orders(id),
  print_type      TEXT,
  design_url      TEXT,
  qty             INTEGER NOT NULL,
  printed_qty     INTEGER DEFAULT 0,
  rejected_qty    INTEGER DEFAULT 0,
  unit_price_uzs  NUMERIC(12,2),
  status          TEXT DEFAULT 'pending',
  deadline        DATE,
  operator_id     UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============== DEVICES ==============
CREATE TABLE IF NOT EXISTS devices (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  type            TEXT,
  assigned_stage  TEXT REFERENCES production_stages(id),
  fingerprint     TEXT,
  is_approved     BOOLEAN DEFAULT false,
  approved_by     UUID REFERENCES users(id),
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============== AUDIT LOG ==============
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,
  user_id         UUID REFERENCES users(id),
  username        TEXT,
  resource_type   TEXT,
  resource_id     TEXT,
  action          TEXT,
  before_value    JSONB,
  after_value     JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  device_id       TEXT,
  metadata        JSONB,
  at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
