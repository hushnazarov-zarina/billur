"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QrCode, Plus, RefreshCw, Loader2, Search, Zap, ExternalLink } from "lucide-react"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-blue-500 text-blue-600',
  in_progress: 'border-amber-500 text-amber-600',
  completed: 'border-green-500 text-green-600',
  rejected: 'border-red-500 text-red-600',
  reworking: 'border-purple-500 text-purple-600',
}

export default function QrCodesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['qr-codes', stageFilter, statusFilter, search],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (stageFilter !== 'all') qs.set('stage', stageFilter)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (search) qs.set('q', search)
      return api.get(`/api/scanning/qr-codes?${qs.toString()}`)
    },
  })

  const { data: stages = [] } = useQuery<any[]>({
    queryKey: ['stages'],
    queryFn: () => api.get('/api/master/stages'),
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <QrCode className="h-7 w-7" /> Production QR Codes
          </h1>
          <p className="text-muted-foreground">Bichuvdan boshlanadigan QR codelar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['qr-codes'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('production.qr.create') && (
            <>
              <Button variant="outline" onClick={() => setShowBulk(true)}>
                <Zap className="mr-2 h-4 w-4" /> Bulk generate
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" /> Yangi QR
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="QR code yoki order kod..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha bosqichlar</SelectItem>
                {stages.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name_uz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="reworking">Reworking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">QR code yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Zakaz</TableHead>
                    <TableHead>Mahsulot</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Bosqich</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ishchi</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((qr: any) => (
                    <TableRow key={qr.id}>
                      <TableCell className="font-mono text-xs font-semibold">{qr.qr_code}</TableCell>
                      <TableCell className="font-mono text-xs">{qr.order_code}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{qr.model_code}</span>
                        <span className="text-muted-foreground"> · {qr.color_name} · {qr.size_code}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">{qr.quantity}</TableCell>
                      <TableCell><Badge variant="outline">{qr.current_stage}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[qr.status]}>{qr.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {qr.current_worker_name || '—'}
                      </TableCell>
                      <TableCell>
                        <Link href={`/trace?qr=${qr.qr_code}`}>
                          <Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['qr-codes'] })} />}
      {showBulk && <BulkDialog onClose={() => setShowBulk(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['qr-codes'] })} />}
    </div>
  )
}

function CreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [orderId, setOrderId] = useState("")
  const [quantity, setQuantity] = useState("")

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['orders'],
    queryFn: () => api.get('/api/orders'),
  })

  const mut = useMutation({
    mutationFn: () => api.post('/api/scanning/qr-codes', {
      order_id: orderId, quantity: parseInt(quantity, 10),
    }),
    onSuccess: () => { toast.success("QR yaratildi"); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yangi production QR</DialogTitle>
          <DialogDescription>Bichuvdan boshlanadi</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Zakaz *</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger><SelectValue placeholder="Zakaz tanlang" /></SelectTrigger>
              <SelectContent>
                {orders.filter((o: any) => o.status === 'active' || o.status === 'draft').map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.external_code} — {o.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input type="number" min={1} value={quantity}
              onChange={(e) => setQuantity(e.target.value)} placeholder="50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={!orderId || !quantity || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yaratish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [orderId, setOrderId] = useState("")

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['orders'],
    queryFn: () => api.get('/api/orders'),
  })

  const mut = useMutation({
    mutationFn: () => api.post('/api/scanning/qr-codes/bulk', { order_id: orderId }),
    onSuccess: (res: any) => { toast.success(`${res.created} ta QR yaratildi`); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk QR generate</DialogTitle>
          <DialogDescription>Zakaz'ning har bir order_item uchun QR yaratiladi</DialogDescription></DialogHeader>
        <div>
          <Label>Zakaz *</Label>
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger><SelectValue placeholder="Zakaz tanlang" /></SelectTrigger>
            <SelectContent>
              {orders.filter((o: any) => o.status !== 'completed' && o.status !== 'cancelled').map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.external_code} — {o.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={!orderId || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
