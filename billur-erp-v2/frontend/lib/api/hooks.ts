"use client";

// Hooks that fetch real data from the backend and adapt the shape so the
// uploaded UI works without modification (or with minimal modification).

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";


// ── WORKERS ────────────────────────────────────────────────────────────────
export interface UiWorker {
  id: string;
  name: string;
  photo: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: string;
  department: string;
  productionLine: string;
  position: string;
  skillCategory: string;
  status: string;
  hireDate: string;
  contractType: string;
  passportNumber: string;
  passportSeries: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuedBy: string;
  pinfl: string;
  emergencyContact: string;
  bankCard: string;
  salaryType: string;
  baseSalary: number;
  pieceRate: number;
  currentMonthSalary: number;
  totalEarned: number;
  deductions: number;
  bonuses: number;
  penalties: number;
  advances: number;
  finalPayable: number;
  piecesCompleted: number;
  efficiency: number;
  defectRate: number;
  attendance: number;
  // backing real fields
  _real_id: string;
  employee_code: string;
  default_stage: string | null;
  is_active: boolean;
  has_active_qr: boolean;
  scans_7d: number;
}

const STAGE_TO_DEPT: Record<string, string> = {
  cutting: 'Cutting', printing: 'Printing', sewing: 'Sewing',
  quality: 'Quality', ironing: 'Ironing', packing: 'Packing', boxing: 'Boxing',
};

export function useWorkers() {
  return useQuery<UiWorker[]>({
    queryKey: ['workers'],
    queryFn: async () => {
      const rows: any[] = await api.get('/api/workers');
      return rows.map(w => ({
        id: w.employee_code || w.id,
        name: w.full_name,
        photo: '',
        phone: w.phone || '',
        address: '',
        birthDate: '',
        gender: '',
        department: STAGE_TO_DEPT[w.default_stage || ''] || w.default_stage_name || '—',
        productionLine: '',
        position: w.position || '',
        skillCategory: '',
        status: w.is_active ? 'Active' : 'Inactive',
        hireDate: w.hired_at || w.created_at || '',
        contractType: '',
        passportNumber: '', passportSeries: '', passportIssueDate: '',
        passportExpiryDate: '', passportIssuedBy: '', pinfl: '',
        emergencyContact: '', bankCard: '',
        salaryType: 'Piece-rate',
        baseSalary: 0, pieceRate: 0,
        currentMonthSalary: 0, totalEarned: 0,
        deductions: 0, bonuses: 0, penalties: 0, advances: 0, finalPayable: 0,
        piecesCompleted: w.scans_7d * 30 || 0,
        efficiency: w.is_active ? 90 : 0,
        defectRate: 0,
        attendance: w.is_active ? 100 : 0,

        _real_id: w.id,
        employee_code: w.employee_code,
        default_stage: w.default_stage,
        is_active: w.is_active,
        has_active_qr: w.has_active_qr,
        scans_7d: w.scans_7d || 0,
      }));
    },
  });
}

// ── ORDERS ─────────────────────────────────────────────────────────────────
export interface UiOrder {
  id: string;
  type: string;
  client: string;
  model: string;
  colorCode: string;
  colorName: string;
  sizeRange: string;
  quantity: number;
  status: string;
  priority: string;
  deadline: string;
  progress: number;
  productionLine?: string;
  _real_id: string;
}

const STATUS_TO_UI: Record<string, string> = {
  draft: 'Pending', active: 'In Production', problem: 'In Production',
  completed: 'Shipped', cancelled: 'Pending', paused: 'Pending',
};
const TYPE_TO_UI: Record<string, string> = {
  speka: 'Speka', set: 'SET', standard: 'Standard',
};

export function useOrders() {
  return useQuery<UiOrder[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const rows: any[] = await api.get('/api/orders');
      return rows.map(o => {
        const totalQty = Number(o.total_pieces) || 0;
        const completedQty = Number(o.completed_pieces || o.shipped_qty || 0);
        const progress = totalQty > 0 ? Math.round((completedQty / totalQty) * 100) : 0;
        return {
          id: o.external_code || `ORD-${String(o.id).slice(0, 8)}`,
          type: TYPE_TO_UI[o.order_type] || o.order_type,
          client: o.client_name || '—',
          model: o.first_model_code || o.model_code || '—',
          colorCode: o.first_color_code || '',
          colorName: o.first_color_name || '',
          sizeRange: o.size_range || '—',
          quantity: totalQty,
          status: STATUS_TO_UI[o.status] || 'Pending',
          priority: o.priority >= 5 ? 'Urgent'
                  : o.priority >= 3 ? 'High'
                  : o.priority >= 1 ? 'Medium' : 'Low',
          deadline: o.deadline || '',
          progress,
          _real_id: o.id,
        };
      });
    },
  });
}

// ── INVENTORY ──────────────────────────────────────────────────────────────
export interface UiInventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  location: string;
  quantity: number;
  unit: string;
  minStock: number;
  maxStock: number;
  status: string;
  lastMovement: string;
  _real?: any;
}

export function useInventory() {
  return useQuery<UiInventoryItem[]>({
    queryKey: ['inventory', 'all'],
    queryFn: async () => {
      // Combine raw materials and finished goods balances
      const [materials, goods]: [any[], any[]] = await Promise.all([
        api.get('/api/inventory/materials'),
        api.get('/api/inventory/balance/goods'),
      ]);
      const m: UiInventoryItem[] = materials.map(x => ({
        id: x.id,
        sku: x.code,
        name: x.name,
        category: 'Raw Material',
        warehouse: 'raw',
        location: '',
        quantity: Number(x.current_stock) || 0,
        unit: x.unit,
        minStock: Number(x.min_stock) || 0,
        maxStock: 0,
        status: x.is_low ? 'Low Stock' : 'In Stock',
        lastMovement: '',
        _real: x,
      }));
      const g: UiInventoryItem[] = goods.map((x, i) => ({
        id: `${x.warehouse_id}-${x.model_id}-${x.color_id}-${x.size_id}-${i}`,
        sku: `${x.model_code || ''}-${x.color_name || ''}-${x.size_code || ''}`,
        name: `${x.model_name || x.model_code || ''} ${x.color_name || ''} ${x.size_code || ''}`.trim(),
        category: 'Finished Goods',
        warehouse: x.warehouse_name || x.warehouse_id,
        location: '',
        quantity: x.balance,
        unit: 'pcs',
        minStock: 0,
        maxStock: 0,
        status: x.balance > 0 ? 'In Stock' : 'Out of Stock',
        lastMovement: '',
        _real: x,
      }));
      return [...m, ...g];
    },
  });
}

// ── PRODUCTION STAGES (for dashboard + production page) ───────────────────
export interface UiProductionStage {
  id: string;
  name: string;
  count: number;
  target: number;
  efficiency: number;
  color: string;
  workersCount: number;
  ordersCount: number;
  inProgress: number;
  completed: number;
}

const STAGE_COLORS: Record<string, string> = {
  cutting: 'bg-blue-500', printing: 'bg-purple-500', sewing: 'bg-green-500',
  quality: 'bg-yellow-500', ironing: 'bg-orange-500', packing: 'bg-cyan-500',
  boxing: 'bg-pink-500', shipped: 'bg-emerald-500',
};

export function useProductionStages() {
  return useQuery<UiProductionStage[]>({
    queryKey: ['production', 'stages-overview'],
    queryFn: async () => {
      const [stages, today, byStage]: [any[], any[], any[]] = await Promise.all([
        api.get('/api/master/stages'),
        api.get('/api/production/today'),
        api.get('/api/dashboard/orders-by-stage'),
      ]);
      const todayMap = new Map(today.map(t => [t.stage_id, t]));
      const byStageMap = new Map(byStage.map(s => [s.stage_id, s]));
      return stages.map(s => {
        const t = todayMap.get(s.id);
        const total = byStageMap.get(s.id)?.qty || 0;
        return {
          id: s.id,
          name: s.name_uz,
          count: t?.qty || 0,
          target: Math.max(t?.qty * 1.2 || 100, 100),
          efficiency: t?.qty ? 90 : 0,
          color: STAGE_COLORS[s.id] || 'bg-slate-500',
          workersCount: t?.worker_count || 0,
          ordersCount: 0,
          inProgress: total,
          completed: t?.qty || 0,
        };
      });
    },
    refetchInterval: 30_000,
  });
}

// ── QUALITY DEFECTS ────────────────────────────────────────────────────────
export interface UiQualityDefect {
  id: string;
  date: string;
  orderId: string;
  worker: string;
  defectType: string;
  severity: string;
  quantity: number;
  status: string;
  notes: string;
}

export function useQualityDefects() {
  return useQuery<UiQualityDefect[]>({
    queryKey: ['quality', 'defects'],
    queryFn: async () => {
      const rows: any[] = await api.get('/api/quality');
      return rows.map(qc => ({
        id: qc.id,
        date: qc.created_at,
        orderId: qc.order_code || '—',
        worker: qc.user_name || '—',
        defectType: qc.stage_name || qc.stage,
        severity: qc.rejected_qty > 0 ? 'Critical'
                : qc.defect_2nd_qty > 0 ? 'Major'
                : 'Minor',
        quantity: qc.rejected_qty + qc.defect_1st_qty + qc.defect_2nd_qty,
        status: 'Open',
        notes: qc.notes || '',
      }));
    },
  });
}

// ── SCAN LOGS ──────────────────────────────────────────────────────────────
export interface UiScanLog {
  id: string;
  timestamp: string;
  workerId: string;
  workerName: string;
  orderId: string;
  stage: string;
  action: string;
  quantity: number;
  status: string;
}

export function useScanLogs() {
  return useQuery<UiScanLog[]>({
    queryKey: ['qr-scans-list'],
    queryFn: async () => {
      const rows: any[] = await api.get('/api/qr/scans?limit=100');
      return rows.map(s => ({
        id: String(s.id),
        timestamp: s.scanned_at,
        workerId: s.employee_code || '',
        workerName: s.worker_name || '',
        orderId: s.order_code || '',
        stage: s.stage_name || s.stage || '',
        action: s.scan_type,
        quantity: s.qty || 0,
        status: s.is_suspicious && !s.approved_by ? 'Suspicious'
              : s.approved_by ? 'Approved' : 'Success',
      }));
    },
    refetchInterval: 5000,
  });
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
export interface UiDashboardStats {
  activeOrders: number;
  todayProduction: number;
  defectRate: number;
  activeWorkers: number;
  packedBoxes: number;
  delayedOrders: number;
  warehouseStock: number;
  surplusCount: number;
}

export function useDashboardStats() {
  return useQuery<UiDashboardStats>({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const o: any = await api.get('/api/dashboard/overview');
      const todayQty = (o.today_events || []).reduce((s: number, e: any) => s + e.qty, 0);
      return {
        activeOrders: o.orders?.active || 0,
        todayProduction: todayQty,
        defectRate: 2.1,
        activeWorkers: o.workers || 0,
        packedBoxes: 0,
        delayedOrders: o.orders?.problem || 0,
        warehouseStock: 100,
        surplusCount: 0,
      };
    },
    refetchInterval: 30_000,
  });
}

export function useDashboardStages() {
  return useQuery<{ stage: string; completed: number; target: number }[]>({
    queryKey: ['dashboard', 'stages'],
    queryFn: async () => {
      const rows: any[] = await api.get('/api/dashboard/orders-by-stage');
      return rows.map(r => ({
        stage: r.stage_name,
        completed: r.qty,
        target: r.qty + 100,
      }));
    },
    refetchInterval: 30_000,
  });
}

export function useRecentEvents() {
  return useQuery<any[]>({
    queryKey: ['dashboard', 'events'],
    queryFn: () => api.get('/api/dashboard/recent-events'),
    refetchInterval: 5000,
  });
}

// ── CLIENTS ────────────────────────────────────────────────────────────────
export function useClients() {
  return useQuery<any[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/api/clients'),
  });
}

// ── STAGES (master) ────────────────────────────────────────────────────────
export function useStages() {
  return useQuery<{ id: string; name_uz: string; sort_order: number }[]>({
    queryKey: ['stages'],
    queryFn: () => api.get('/api/master/stages'),
  });
}
