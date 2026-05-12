# BILLUR ERP — v2 (full production workflow)

AND BILLUR TEXTILE — Production ERP/MES with QR-driven workflow, real-time
traceability, piece-rate payroll, and BoxApp integration.

## Stack
- **Backend**: Node.js 20 + Express + TypeScript + PostgreSQL + qrcode + exceljs
- **Frontend**: Next.js 14 (App Router) + shadcn/ui + Tailwind + TanStack Query + html5-qrcode
- **Database**: PostgreSQL 16

## Imkoniyatlari

### Production workflow (asosiy)
1. **Order yaratish** — Speka/SET/Standard tiplari
2. **QR yaratish** — bichuvdan boshlanadi, har order_item uchun alohida
3. **Stage scanning** — ishchi har bosqichda **START** + **FINISH** qiladi
4. **Worker lock** — bitta QR bir vaqtning o'zida faqat bitta ishchiga biriktirilgan
5. **Anti-cheating** — juda tez (~stagega qarab 5-60 sek) scanlar **shubhali** deb belgilanadi
6. **Race-safe** — `SELECT ... FOR UPDATE` + UNIQUE indekslar bir vaqtda 2 scan'ni rad etadi
7. **Quality check** — Passed/1st sort/2nd sort/Defect/Rework/Reject + aybi qaysi bosqichda
8. **Traceability** — har QR uchun to'liq tarix (kim, qachon, qancha, defekt)
9. **Override** — admin lock buzishi mumkin (audit log bilan)

### Payroll
- **Piece rates** — model + bosqich bo'yicha, fallback DEFAULT bo'lgan rate
- **Real-time hisoblash** — finished scanlardan
- **Bonus/penalty/advance** — admin tomonidan qo'shiladi
- **Approve → Pay workflow** — draft → approved → paid

### BoxApp integratsiya
- **Async sync queue** — barcha box/shipment o'zgarishlar `boxapp_sync_jobs` ga tushadi
- **Exponential backoff** — 1m / 5m / 15m / 1h / 6h, 10 marta urinishdan keyin failed
- **Background worker** — har 60 sekundda pending'larni urinib ko'radi
- **Monitoring UI** — `/boxapp-sync` sahifa statlar + retry/cancel imkoniyati
- **Env**: `BOXAPP_API_URL=https://app.andbillur.com` va `BOXAPP_API_KEY=secret`

### Worker self-service
- **Mening Profilim** — telefon/address/photo o'zgartirish, productivity, scans, documents
- **Mening Oyligim** — scan asosida hisoblangan oylik tafsilotlari

### RBAC
- 16 yangi permission qo'shildi (production.qr.*, payroll.*, piece_rates.*, boxapp.*)
- Owner role — hammasi avtomatik
- Worker faqat o'zining ma'lumotlarini ko'radi (`workers.view_all` permission'i yo'q)

## Sahifalar (22 ta)

### Production
- `/production-scan` — START/FINISH scanner (kamera + manual)
- `/qr-codes` — production QR'lar boshqaruv
- `/trace` — QR/box bo'yicha to'liq tarix
- `/production` — bosqichlar pipeline
- `/quality` — defektlar
- `/scanning` — worker badge scanning (eski)
- `/print` — print buyurtmalari

### Ombor
- `/inventory` — material va goods balans
- `/surplus` — izlishka
- `/boxes` — BoxApp boxlar
- `/boxapp-sync` — sync monitoring
- `/shipments` — yetkazib berish

### Tashkilot
- `/workers` — ishchilar
- `/workers/[id]` — ishchi detallari
- `/my-profile` — worker self-service
- `/payroll` — admin payroll
- `/my-payroll` — worker payroll
- `/piece-rates` — narxlar
- `/users` — foydalanuvchilar
- `/reports` — Excel exports
- `/audit` — audit log

### Asosiy
- `/` — Dashboard
- `/clients` — Klientlar
- `/orders` — Zakazlar

## Lokal ishga tushirish

```bash
# 1. PostgreSQL
docker run -d --name billur-pg -e POSTGRES_PASSWORD=billur -p 5432:5432 postgres:16

# 2. Backend
cd backend
npm install
cp .env.example .env  # DATABASE_URL ni sozlang
npm run migrate       # 001+002+003 migrations
npm run dev           # http://localhost:3001

# 3. Frontend
cd frontend
npm install
npm run dev           # http://localhost:3000
```

Login: `admin / admin123`

## Env variables (production)

```
# Backend
NODE_ENV=production
DATABASE_URL=postgres://...
JWT_SECRET=<generated>
QR_SECRET=<generated>
ALLOWED_ORIGINS=https://your-frontend.com

# BoxApp integration (optional — if set, background sync runs)
BOXAPP_API_URL=https://app.andbillur.com
BOXAPP_API_KEY=<your-key>

# Frontend
BACKEND_URL=https://your-backend.com
PORT=3000
```

## Production workflow — qanday ishlaydi

1. **Order kelgan** → Orders sahifasida zakaz yaratiladi
2. **Bichuvga tushadi** → QR Codes sahifasida "Bulk generate" — har order_item uchun QR yaratiladi
3. **Bichuvchi badge'ini scan qiladi** → Production Scan sahifasida QR + worker + stage=cutting + **START**
   - Tizim QR'ni shu ishchiga lock qiladi
   - Boshqa hech kim shu QR'ga scan qila olmaydi
4. **Bichuvchi ishni tugatadi** → yana QR'ni scan qiladi + **FINISH**
   - Tizim duration hisoblaydi
   - QR keyingi bosqichga (`printing`) o'tadi, lock bo'shaydi
5. **Printing → Sewing → Quality → Ironing → Tagging → Packing**
6. **Quality bosqichida** — FINISH bosilganda QC qarori talab qilinadi:
   - `passed` → keyingi bosqichga
   - `rework` → `sewing` ga qaytadi (status `reworking`)
   - `reject` → tugatildi, `status='rejected'`
7. **Packing tugagandan keyin** → BoxApp ga jo'natiladi
8. **Shipment yopilganda** → BoxApp ga sync bo'ladi

## Anti-cheating mexanizmlari

- **Lock uniqueness**: PostgreSQL UNIQUE indeks (`uq_pss_active_worker`) bir vaqtda 2 START scan'ni rad etadi
- **Duplicate finish**: UNIQUE indeks (`uq_pss_completed`) bir ishchi bir QR'ga shu bosqichni 2 marta tugata olmaydi
- **Race condition**: `SELECT ... FOR UPDATE` bilan QR satr lock qilinadi
- **Min duration**: stage'ga qarab 5-60 sek, undan tez bo'lsa `is_suspicious=true`
- **Wrong stage**: ishchining `default_stage` mos kelmasa, suspicious flag
- **Suspicious feed**: `/api/scanning/scans/suspicious` — admin ko'radi
- **Audit log**: barcha scan'lar va override'lar `audit_logs` ga yoziladi

## Migration 003 yangi jadvallar

- `production_qr_codes` — QR ownership (current_worker_id, current_stage)
- `production_stage_scans` — har START/FINISH yozuv (race-safe UNIQUE indekslar bilan)
- `quality_decisions` — QC qarorlari
- `piece_rates` — model+stage narxlari
- `payroll_entries` — har worker × period
- `payroll_details` — har scan uchun hisoblangan summa
- `worker_documents` — passport/contract/photo
- `boxapp_sync_jobs` — async queue

## API endpoints (yangi)

### Production scanning
- `POST /api/scanning/qr-codes` — yaratish
- `POST /api/scanning/qr-codes/bulk` — order bo'yicha bulk
- `GET /api/scanning/qr-codes` — ro'yxat
- `GET /api/scanning/qr-codes/:qr` — lookup
- **`POST /api/scanning/scan`** — START/FINISH (asosiy endpoint)
- `POST /api/scanning/qr-codes/:id/override` — admin
- `GET /api/scanning/qr-codes/:id/trace` — to'liq tarix
- `GET /api/scanning/scans/suspicious` — shubhali scanlar
- `GET /api/scanning/scans/active` — hozir bajarilayotgan ishlar

### Payroll
- `GET/POST/PUT /api/payroll/rates` — piece rates
- `POST /api/payroll/calculate` — bitta worker
- `POST /api/payroll/calculate-all` — barchasi
- `GET /api/payroll/entries` — (worker o'zinikini ko'radi)
- `GET /api/payroll/entries/:id` — detallar
- `PATCH /api/payroll/entries/:id` — bonus/penalty/advance
- `POST /api/payroll/entries/:id/approve` — tasdiqlash
- `POST /api/payroll/entries/:id/pay` — to'langan

### Worker profile
- `GET /api/worker-profile/me` — o'z profili
- `GET /api/worker-profile/me/productivity` — bu oy
- `GET /api/worker-profile/me/scans` — oxirgi 50
- `GET/PUT /api/worker-profile/:id/profile` — admin/self
- `GET/POST /api/worker-profile/:id/documents` — hujjatlar
- `DELETE /api/worker-profile/:wid/documents/:did` — admin

### BoxApp
- `GET /api/boxapp/jobs` — sync jobs
- `GET /api/boxapp/jobs/_stats` — statlar
- `POST /api/boxapp/jobs/:id/retry` — qaytadan urinish
- `POST /api/boxapp/jobs/_flush` — hozir ishga tushir
- `POST /api/boxapp/jobs/:id/cancel` — bekor qilish

## BoxApp API talablari (boxapp tomonida)

ERP quyidagi endpoint'larni chaqiradi:

```
POST   /api/erp/boxes
PUT    /api/erp/boxes/:uid
DELETE /api/erp/boxes/:uid

POST   /api/erp/shipments
PUT    /api/erp/shipments/:id
DELETE /api/erp/shipments/:id
```

Auth: `Authorization: Bearer <BOXAPP_API_KEY>`

Box payload misoli:
```json
{
  "uid": "BX-123",
  "box_number": "001",
  "order_id": "uuid",
  "order_number": "ORD-001",
  "type": "single",
  "model": "LRTT-275",
  "color_code": "BLU",
  "kg": 12.5,
  "status": "packed",
  "sizes": { "M": 10, "L": 15 },
  "items": [...],
  "packed_by": "Aliyev A.",
  "packed_at": "2025-01-15T10:30:00Z"
}
```

## Render deploy

`render.yaml` mavjud — Blueprint sifatida import qiling.

## Auth tuzatishlari

- ✅ `/api/auth/login` `permissions` array qaytaradi
- ✅ `/api/auth/me` to'g'ridan-to'g'ri user qaytaradi
- ✅ Sidebar `owner` rol uchun avtomatik hammasini ko'rsatadi
- ✅ `x-session-token` header + cookie ikkalasi ham
