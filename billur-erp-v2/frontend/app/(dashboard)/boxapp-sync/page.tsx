"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Loader2, Zap, RotateCw, XCircle, Package } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-amber-500 text-amber-600',
  syncing: 'border-blue-500 text-blue-600',
  synced: 'border-green-500 text-green-600',
  failed: 'border-red-500 text-red-600',
  cancelled: 'border-muted-foreground text-muted-foreground',
}

export default function BoxAppSyncPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState("")
  const [entityFilter, setEntityFilter] = useState("")

  const { data: stats = [] } = useQuery<any[]>({
    queryKey: ['boxapp-stats'],
    queryFn: () => api.get('/api/boxapp/jobs/_stats'),
    refetchInterval: 10000,
  })

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['boxapp-jobs', statusFilter, entityFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (statusFilter) qs.set('status', statusFilter)
      if (entityFilter) qs.set('entity_type', entityFilter)
      return api.get(`/api/boxapp/jobs?${qs.toString()}`)
    },
    refetchInterval: 15000,
  })

  const retryMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/boxapp/jobs/${id}/retry`),
    onSuccess: () => { toast.success("Qaytadan jo'natildi"); qc.invalidateQueries({ queryKey: ['boxapp-jobs'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const flushMut = useMutation({
    mutationFn: () => api.post('/api/boxapp/jobs/_flush'),
    onSuccess: (res: any) => {
      toast.success(`${res.processed} ta job ishlandi, ${res.succeeded} ta muvaffaqiyatli`)
      qc.invalidateQueries({ queryKey: ['boxapp-jobs'] })
      qc.invalidateQueries({ queryKey: ['boxapp-stats'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/boxapp/jobs/${id}/cancel`),
    onSuccess: () => { toast.success("Bekor qilindi"); qc.invalidateQueries({ queryKey: ['boxapp-jobs'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const statsByStatus = Object.fromEntries(stats.map(s => [s.sync_status, s.count]))

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7" /> BoxApp Sync
          </h1>
          <p className="text-muted-foreground">app.andbillur.com bilan integratsiya</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['boxapp-jobs'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('boxapp.sync') && (
            <Button onClick={() => flushMut.mutate()} disabled={flushMut.isPending}>
              {flushMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Sync hozir
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {['pending', 'syncing', 'synced', 'failed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={
              "rounded-lg border bg-card p-4 text-left transition hover:shadow-md " +
              (statusFilter === s ? 'ring-2 ring-primary border-primary' : '')
            }>
            <div className="text-xs uppercase font-semibold text-muted-foreground">{s}</div>
            <div className={
              "text-3xl font-bold mt-1 " +
              (s === 'synced' ? 'text-green-600' : s === 'failed' ? 'text-red-600' :
               s === 'pending' ? 'text-amber-600' : s === 'syncing' ? 'text-blue-600' : '')
            }>{statsByStatus[s] || 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle>Sync jobs</CardTitle>
              <CardDescription>{data.length} ta yozuv</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={entityFilter || 'all'} onValueChange={(v) => setEntityFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="shipment">Shipment</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Job yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Operatsiya</TableHead>
                    <TableHead>Urinishlar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Xato</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs font-mono">
                        {new Date(j.created_at).toLocaleString('uz-UZ', { hour12: false })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{j.entity_type}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{j.entity_id}</TableCell>
                      <TableCell><Badge variant="outline">{j.operation}</Badge></TableCell>
                      <TableCell className="text-center font-mono">
                        {j.attempts}
                        {j.attempts >= 10 && <span className="text-red-600"> (max)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[j.sync_status]}>{j.sync_status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-red-600 max-w-xs truncate">{j.last_error || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(j.sync_status === 'failed' || j.sync_status === 'pending') && hasPermission('boxapp.retry') && (
                            <Button size="icon" variant="ghost" onClick={() => retryMut.mutate(j.id)}>
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          )}
                          {j.sync_status !== 'synced' && j.sync_status !== 'cancelled' && hasPermission('boxapp.retry') && (
                            <Button size="icon" variant="ghost" onClick={() => cancelMut.mutate(j.id)}>
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
