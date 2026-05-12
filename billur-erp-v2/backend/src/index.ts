import express, { Request, Response, NextFunction } from 'express';
import { pool } from './shared/database/pool';
import { authMiddleware } from './shared/middleware/auth';
import { cookieParser, securityHeaders, corsMiddleware } from './shared/middleware/security';
import { HttpError, AuthRequest } from './shared/types';

import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import clientsRouter from './modules/clients/clients.router';
import ordersRouter from './modules/orders/orders.router';
import masterDataRouter from './modules/master-data/master-data.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import productionRouter from './modules/production/production.router';
import qualityRouter from './modules/quality/quality.router';
import inventoryRouter from './modules/inventory/inventory.router';
import surplusRouter from './modules/surplus/surplus.router';
import workersRouter from './modules/workers/workers.router';
import qrRouter from './modules/qr/qr.router';
import boxesRouter from './modules/boxes/boxes.router';
import shipmentsRouter from './modules/shipments/shipments.router';
import printRouter from './modules/print/print.router';
import reportsRouter from './modules/reports/reports.router';
import auditRouter from './modules/audit/audit.router';
import devicesRouter from './modules/devices/devices.router';
import scanningRouter from './modules/scanning/scanning.router';
import payrollRouter from './modules/payroll/payroll.router';
import workerProfileRouter from './modules/workers/worker-profile.router';
import boxappRouter from './modules/boxapp/boxapp.router';
import { startBackgroundSync } from './modules/boxapp/boxapp.service';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);

console.log('🌐 Allowed origins:', allowedOrigins);

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser);
app.use(securityHeaders(isProd));
app.use(corsMiddleware(allowedOrigins));
app.use(authMiddleware);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, env: isProd ? 'production' : 'dev' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'db' });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/master', masterDataRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/production', productionRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/surplus', surplusRouter);
app.use('/api/workers', workersRouter);
app.use('/api/qr', qrRouter);
app.use('/api/boxes', boxesRouter);
app.use('/api/shipments', shipmentsRouter);
app.use('/api/print', printRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/scanning', scanningRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/worker-profile', workerProfileRouter);
app.use('/api/boxapp', boxappRouter);

// 404
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server xatosi' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('  BILLUR ERP API');
  console.log(`  Port: ${PORT}`);
  console.log(`  Env:  ${isProd ? 'production' : 'development'}`);
  console.log('====================================');

  // BoxApp sync worker — runs every minute
  if (process.env.BOXAPP_API_URL && process.env.BOXAPP_API_KEY) {
    console.log('  BoxApp sync: ENABLED');
    startBackgroundSync(60_000);
  } else {
    console.log('  BoxApp sync: DISABLED (env not configured)');
  }
});
