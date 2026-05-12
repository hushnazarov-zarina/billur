-- Billur ERP — Default master data seed

-- ============== ROLES ==============
INSERT INTO roles (id, name_uz, is_system) VALUES
  ('owner',          'Egasi',           true),
  ('admin',          'Admin',           true),
  ('cutting',        'Bichuvchi',       true),
  ('printing',       'Printchi',        true),
  ('sewing',         'Tikuvchi',        true),
  ('quality',        'QC mutaxassisi', true),
  ('ironing',        'Dazmolchi',      true),
  ('packing',        'Upakovkachi',    true),
  ('boxing',         'BoxApp operator', true),
  ('warehouse',      'Omborchi',        true)
ON CONFLICT (id) DO NOTHING;

-- ============== PERMISSIONS ==============
INSERT INTO permissions (id, resource, action, description) VALUES
  -- Clients
  ('clients.read',    'clients', 'read',   'Klientlarni ko''rish'),
  ('clients.create',  'clients', 'create', 'Klient yaratish'),
  ('clients.update',  'clients', 'update', 'Klient tahrirlash'),
  ('clients.delete',  'clients', 'delete', 'Klient o''chirish'),
  -- Orders
  ('orders.read',     'orders',  'read',   'Zakazlarni ko''rish'),
  ('orders.create',   'orders',  'create', 'Zakaz yaratish'),
  ('orders.update',   'orders',  'update', 'Zakaz tahrirlash'),
  ('orders.delete',   'orders',  'delete', 'Zakaz o''chirish'),
  ('orders.cancel',   'orders',  'cancel', 'Zakaz bekor qilish'),
  -- Production
  ('production.read',         'production', 'read',         'Production ko''rish'),
  ('production.events.create','production', 'events.create','Stage event yaratish'),
  -- Quality
  ('quality.read',    'quality', 'read',   'QC ko''rish'),
  ('quality.create',  'quality', 'create', 'QC yozish'),
  ('quality.update',  'quality', 'update', 'QC tahrirlash'),
  -- Inventory
  ('inventory.read',  'inventory', 'read', 'Ombor ko''rish'),
  ('inventory.move',  'inventory', 'move', 'Ombor harakat'),
  -- Surplus
  ('surplus.read',    'surplus', 'read',   'Izlishka ko''rish'),
  ('surplus.update',  'surplus', 'update', 'Izlishka tahrirlash'),
  ('surplus.sell',    'surplus', 'sell',   'Izlishka sotish'),
  -- Workers
  ('workers.read',    'workers', 'read',   'Ishchilarni ko''rish'),
  ('workers.create',  'workers', 'create', 'Ishchi qo''shish'),
  ('workers.update',  'workers', 'update', 'Ishchi tahrirlash'),
  ('workers.delete',  'workers', 'delete', 'Ishchi o''chirish'),
  -- QR
  ('qr.scan',         'qr', 'scan',     'QR scan'),
  ('qr.generate',     'qr', 'generate', 'QR yaratish'),
  ('qr.approve',      'qr', 'approve',  'Suspicious approve'),
  -- Box
  ('box.read',        'box', 'read',   'Box ko''rish'),
  ('box.create',      'box', 'create', 'Box yaratish'),
  ('box.update',      'box', 'update', 'Box tahrirlash'),
  ('box.delete',      'box', 'delete', 'Box o''chirish'),
  -- Print
  ('print.read',      'print', 'read',   'Print ko''rish'),
  ('print.create',    'print', 'create', 'Print yaratish'),
  ('print.update',    'print', 'update', 'Print tahrirlash'),
  -- Reports
  ('reports.read',    'reports', 'read',     'Hisobotlarni ko''rish'),
  ('reports.export',  'reports', 'export',   'Eksport qilish'),
  ('reports.financial','reports', 'financial','Moliyaviy hisobotlar'),
  -- Users
  ('users.read',      'users', 'read',         'Foydalanuvchilarni ko''rish'),
  ('users.create',    'users', 'create',       'Yangi user'),
  ('users.update',    'users', 'update',       'User tahrirlash'),
  ('users.delete',    'users', 'delete',       'User o''chirish'),
  ('users.permissions','users','permissions',  'Permission boshqarish'),
  -- Audit & settings
  ('audit.read',      'audit', 'read',     'Audit log'),
  ('settings.manage', 'settings', 'manage', 'Sozlamalar')
ON CONFLICT (id) DO NOTHING;

-- ============== ROLE-PERMISSION MAPPING ==============
-- Owner: hammasi
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'owner', id FROM permissions
ON CONFLICT DO NOTHING;

-- Admin: hammasi - financial/permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'admin', id FROM permissions WHERE id NOT IN ('reports.financial','users.permissions','settings.manage')
ON CONFLICT DO NOTHING;

-- Stage workers — har biri faqat o'z zonasi
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('cutting', 'orders.read'), ('cutting', 'production.read'), ('cutting', 'production.events.create'),
  ('printing','orders.read'), ('printing','production.read'), ('printing','production.events.create'),
  ('sewing',  'orders.read'), ('sewing',  'production.read'), ('sewing',  'production.events.create'),
  ('quality', 'orders.read'), ('quality', 'production.read'), ('quality', 'production.events.create'),
  ('quality', 'quality.read'),('quality', 'quality.create'),  ('quality', 'quality.update'),
  ('ironing', 'orders.read'), ('ironing', 'production.read'), ('ironing', 'production.events.create'),
  ('packing', 'orders.read'), ('packing', 'production.read'), ('packing', 'production.events.create'),
  ('boxing',  'orders.read'), ('boxing',  'production.read'), ('boxing',  'production.events.create'),
  ('boxing',  'box.read'),    ('boxing',  'box.create'),
  ('warehouse','inventory.read'),('warehouse','inventory.move'),
  ('warehouse','box.read'),     ('warehouse','box.update'),
  ('warehouse','surplus.read')
ON CONFLICT DO NOTHING;

-- ============== PRODUCTION STAGES ==============
INSERT INTO production_stages (id, name_uz, sort_order, has_quality_check) VALUES
  ('raw',         'Xom ashyo ombori',   1,  false),
  ('cutting',     'Bichuv',             2,  false),
  ('printing',    'Print',              3,  true),
  ('sewing',      'Tikuv',              4,  false),
  ('quality',     'Quality Check',      5,  true),
  ('ironing',     'Dazmol',             6,  false),
  ('packing',     'Upakovka',           7,  false),
  ('boxing',      'BoxApp',             8,  false),
  ('finished',    'Tayyor mahsulot ombori', 9,  false),
  ('shipped',     'Yuborilgan',         10, false),
  ('surplus',     'Izlishka',           11, false)
ON CONFLICT (id) DO NOTHING;

-- ============== WAREHOUSES ==============
INSERT INTO warehouses (id, name_uz, type) VALUES
  ('raw',       'Xom ashyo ombori',         'raw'),
  ('wip',       'Yarim tayyor ombori',      'wip'),
  ('finished',  'Tayyor mahsulot ombori',   'finished'),
  ('surplus',   'Izlishka ombori',          'surplus'),
  ('print',     'Print ombori',             'wip')
ON CONFLICT (id) DO NOTHING;

-- ============== DEFAULT SIZES (kids + adult) ==============
INSERT INTO sizes (code, category, sort_order) VALUES
  ('92',  'kids', 1),
  ('98',  'kids', 2),
  ('104', 'kids', 3),
  ('110', 'kids', 4),
  ('116', 'kids', 5),
  ('122', 'kids', 6),
  ('128', 'kids', 7),
  ('134', 'kids', 8),
  ('140', 'kids', 9),
  ('146', 'kids', 10),
  ('152', 'kids', 11),
  ('158', 'kids', 12),
  ('164', 'kids', 13),
  ('170', 'kids', 14),
  ('176', 'kids', 15),
  ('XS',  'adult', 20),
  ('S',   'adult', 21),
  ('M',   'adult', 22),
  ('L',   'adult', 23),
  ('XL',  'adult', 24),
  ('XXL', 'adult', 25)
ON CONFLICT (code) DO NOTHING;
