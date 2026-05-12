// Migration runner — migrations/ papkasidagi .sql fayllarni tartib bilan ishga tushiradi
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';
import { hashPassword } from '../utils/crypto';

const MIGRATIONS_DIR = join(__dirname, '../../../migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT filename FROM migrations`);
  return new Set(rows.map(r => r.filename));
}

async function runMigration(filename: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8');
  console.log(`▶ Migrating: ${filename}`);
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query(`INSERT INTO migrations (filename) VALUES ($1)`, [filename]);
    await pool.query('COMMIT');
    console.log(`✓ Applied: ${filename}`);
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function ensureAdminUser() {
  const { rows } = await pool.query(`SELECT 1 FROM users WHERE username = 'admin' LIMIT 1`);
  if (rows.length > 0) return;
  const hash = await hashPassword('admin123');
  await pool.query(
    `INSERT INTO users (username, password_hash, role_id, full_name)
     VALUES ($1, $2, $3, $4)`,
    ['admin', hash, 'owner', 'System Administrator']
  );
  console.log('✓ Default admin yaratildi: admin / admin123');
  console.log('⚠️  XAVFSIZLIK: birinchi loginda parolni o\'zgartiring!');
}

async function main() {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const f of files) {
    if (!applied.has(f)) {
      await runMigration(f);
      count++;
    }
  }

  if (count === 0) {
    console.log('✓ Hamma migratsiyalar allaqachon qo\'llanilgan');
  } else {
    console.log(`✓ ${count} ta migratsiya qo'llanildi`);
  }

  await ensureAdminUser();
  await pool.end();
}

main().catch(e => {
  console.error('❌ Migration error:', e);
  process.exit(1);
});
