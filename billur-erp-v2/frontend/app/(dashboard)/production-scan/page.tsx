"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"
import { QrScanner } from "@/components/qr/qr-scanner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Scan, Play, CheckCircle, AlertTriangle, RefreshCw, Loader2, Clock,
  Camera, Zap, ShieldAlert,
} from "lucide-react"

export default function ProductionScanPage() {
  const { user, hasPermission } = useAuth()
  const qc = useQueryClient()

  // The selected worker (badge) for scanning — admin can pick, worker is auto
  const [workerId, setWorkerId] = useState<string>("")
  // The scanned/typed QR
  const [qrCode, setQrCode] = useState<string>("")
  // The stage being scanned (worker's default OR manually chosen)
  const [stage, setStage] = useState<string>("")
  // Whether scanner is locked while we process
  const [busy, setBusy] = useState(false)

  // Quality decision (only used when stage = 'quality')
  const [qualityDecision, setQualityDecision] = useState<string>("passed")
  const [defectType, setDefectType] = useState("")
  const [defectDescription, setDefectDescription] = useState("")
  const [responsibleStage, setResponsibleStage] = useState<string>("")

  const { data: stages = [] } = useQuery<any[]>({
    queryKey: ['stages'],
    queryFn: () => api.get('/api/master/stages'),
  })
  const { data: workers = [] } = useQuery<any[]>({
    queryKey: ['workers'],
    queryFn: () => api.get('/api/workers'),
  })

  // QR lookup — show what this code is BEFORE scanning
  const { data: qrInfo } = useQuery<any>({
    queryKey: ['qr-info', qrCode],
    queryFn: () => api.get(`/api/scanning/qr-codes/${encodeURIComponent(qrCode)}`),
    enabled: qrCode.length > 5,
    retry: false,
  })

  // My active scans (what I'm currently working on)
  const { data: myActive = [] } = useQuery<any[]>({
    queryKey: ['active-scans', workerId],
    queryFn: () => api.get(`/api/scanning/scans/active${workerId ? `?worker_id=${workerId}` : ''}`),
    enabled: !!workerId,
    refetchInterval: 5000,
  })

  const scanMut = useMutation({
    mutationFn: (action: 'START' | 'FINISH') => api.post('/api/scanning/scan', {
      qr_code: qrCode,
      worker_id: workerId,
      stage,
      action,
      quality: stage === 'quality' && action === 'FINISH' ? {
        decision: qualityDecision,
        defect_type: defectType || undefined,
        description: defectDescription || undefined,
        responsible_stage: responsibleStage || undefined,
      } : undefined,
    }),
    onSuccess: (res: any, action) => {
      if (res.is_suspicious) {
        toast.warning(`Bajarildi (shubhali): ${res.suspicious_reason}`)
      } else {
        toast.success(action === 'START' ? "✓ Ish boshlandi" : "✓ Ish tugatildi")
      }
      // Clear QR after FINISH (so next scan starts fresh)
      if (action === 'FINISH') {
        setQrCode("")
        setDefectType("")
        setDefectDescription("")
        setResponsibleStage("")
        setQualityDecision("passed")
      }
      qc.invalidateQueries({ queryKey: ['qr-info'] })
      qc.invalidateQueries({ queryKey: ['active-scans'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const handleQrResult = (text: string) => {
    setBusy(true)
    setQrCode(text.trim())
    toast.info(`QR: ${text.slice(0, 24)}${text.length > 24 ? '...' : ''}`)
    setTimeout(() => setBusy(false), 1000)
  }

  // Auto-set stage from QR (the QR is at a particular stage right now)
  const effectiveStage = stage || qrInfo?.current_stage || ""

  const isLocked = !!qrInfo?.current_worker_id && qrInfo?.current_worker_id !== workerId
  const canStart = qrInfo && !qrInfo.current_worker_id && qrInfo.status !== 'completed'
  const canFinish = qrInfo && qrInfo.current_worker_id === workerId

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scan className="h-7 w-7" /> Production Scanning
        </h1>
        <p className="text-sm text-muted-foreground">
          QR scan qiling: START — ishni oling, FINISH — ishni tugating
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Scanner + QR input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5"/> Scan QR</CardTitle>
            <CardDescription>Kamera yoki qo'lda kiriting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <QrScanner onResult={handleQrResult} ready={!busy} />

            <div className="space-y-2">
              <Label>QR code</Label>
              <div className="flex gap-2">
                <Input
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  placeholder="BILLUR-..." className="font-mono"
                />
                <Button variant="outline" onClick={() => setQrCode("")}>Tozalash</Button>
              </div>
            </div>

            {qrInfo ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zakaz:</span>
                  <span className="font-mono font-semibold">{qrInfo.order_code || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mahsulot:</span>
                  <span>{qrInfo.model_code} · {qrInfo.color_name} · {qrInfo.size_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-mono font-bold">{qrInfo.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hozirgi bosqich:</span>
                  <Badge variant="outline">{qrInfo.current_stage}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{qrInfo.status}</Badge>
                </div>
                {qrInfo.current_worker_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ishchi:</span>
                    <span className="text-amber-600 font-semibold">
                      {qrInfo.current_worker_name || qrInfo.current_worker_id}
                    </span>
                  </div>
                )}
              </div>
            ) : qrCode.length > 5 ? (
              <Alert variant="destructive">
                <AlertDescription>QR topilmadi yoki noto'g'ri</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {/* Right — Worker + Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5"/> Ish boshlash/tugatish</CardTitle>
            <CardDescription>Ishchini tanlang va amalni bosing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Ishchi *</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger><SelectValue placeholder="Ishchini tanlang" /></SelectTrigger>
                <SelectContent>
                  {workers.filter((w: any) => w.is_active).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.employee_code} — {w.full_name}
                      {w.default_stage_name && ` (${w.default_stage_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Bosqich *</Label>
              <Select value={effectiveStage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Bosqich tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name_uz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {qrInfo && stage && stage !== qrInfo.current_stage && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  QR hozir '{qrInfo.current_stage}' bosqichida — boshqacha scan rad etiladi
                </p>
              )}
            </div>

            {/* Quality decisions */}
            {effectiveStage === 'quality' && (
              <div className="space-y-3 rounded-lg border bg-amber-50/30 p-3">
                <Label className="text-amber-800">Quality Check qarori</Label>
                <Select value={qualityDecision} onValueChange={setQualityDecision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">✓ Passed</SelectItem>
                    <SelectItem value="sort_1">1st sort</SelectItem>
                    <SelectItem value="sort_2">2nd sort</SelectItem>
                    <SelectItem value="defect">⚠️ Defect</SelectItem>
                    <SelectItem value="rework">↺ Rework kerak</SelectItem>
                    <SelectItem value="reject">✗ Reject</SelectItem>
                  </SelectContent>
                </Select>

                {(qualityDecision === 'defect' || qualityDecision === 'rework' || qualityDecision === 'reject') && (
                  <>
                    <div>
                      <Label className="text-xs">Defekt turi</Label>
                      <Input value={defectType} onChange={(e) => setDefectType(e.target.value)}
                        placeholder="masalan: chok ko'chgan / dog' / o'lcham" />
                    </div>
                    <div>
                      <Label className="text-xs">Tavsif</Label>
                      <Textarea value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)}
                        rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Aybi qaysi bosqichda?</Label>
                      <Select value={responsibleStage} onValueChange={setResponsibleStage}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {stages.filter((s: any) => s.id !== 'quality').map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name_uz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            {isLocked && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Bu QR hozir <strong>{qrInfo.current_worker_name}</strong> ostida.
                  {hasPermission('production.qr.override') && " Admin override qiling."}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-16 text-base"
                onClick={() => scanMut.mutate('START')}
                disabled={!qrCode || !workerId || !effectiveStage || scanMut.isPending || !canStart}
              >
                {scanMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5"/>}
                START
              </Button>
              <Button
                size="lg" variant="default"
                className="h-16 text-base bg-green-600 hover:bg-green-700"
                onClick={() => scanMut.mutate('FINISH')}
                disabled={!qrCode || !workerId || !effectiveStage || scanMut.isPending || !canFinish}
              >
                {scanMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5"/>}
                FINISH
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Bir ishchi bir QR'ga bir bosqichda <strong>faqat 2 marta</strong> scan qila oladi: START + FINISH.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My active scans */}
      {workerId && myActive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Aktiv ishlar ({myActive.length})
            </CardTitle>
            <CardDescription>Tugatilmagan START scanlar</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QR</TableHead>
                  <TableHead>Zakaz</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Bosqich</TableHead>
                  <TableHead className="text-right">Vaqt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myActive.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.qr_code}</TableCell>
                    <TableCell className="font-mono text-xs">{s.order_code}</TableCell>
                    <TableCell className="text-xs">
                      {s.model_code} · {s.color_name} · {s.size_code}
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.stage}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {Math.floor(s.elapsed_seconds / 60)}m {s.elapsed_seconds % 60}s
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
