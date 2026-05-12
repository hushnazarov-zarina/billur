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
import { DollarSign, Plus, Edit, Loader2, RefreshCw } from "lucide-react"

export default function PieceRatesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['piece-rates'],
    queryFn: () => api.get('/api/payroll/rates'),
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-7 w-7" /> Piece Rates
          </h1>
          <p className="text-muted-foreground">Model va bosqich bo'yicha dona narxlari</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['piece-rates'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('piece_rates.update') && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yangi narx
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faol narxlar</CardTitle>
          <CardDescription>{data.length} ta yozuv</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Narx yo'q. Piece rates qo'shing — bo'lmasa payroll hisoblanmaydi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bosqich</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Operatsiya</TableHead>
                    <TableHead className="text-right">Narx/dona (UZS)</TableHead>
                    <TableHead>Boshlandi</TableHead>
                    <TableHead>Tugaydi</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline">{r.stage_name || r.stage}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.model_code ? `${r.model_code} — ${r.model_name}` : (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">DEFAULT</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.operation_name || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{Number(r.rate_per_piece).toLocaleString('en')}</TableCell>
                      <TableCell className="text-xs">{r.active_from}</TableCell>
                      <TableCell className="text-xs">{r.active_to || '—'}</TableCell>
                      <TableCell>
                        {hasPermission('piece_rates.update') && (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && <RateDialog onClose={() => setShowAdd(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['piece-rates'] })} />}
      {editing && <RateDialog rate={editing} onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['piece-rates'] })} />}
    </div>
  )
}

function RateDialog({ rate, onClose, onSaved }: { rate?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!rate
  const { data: stages = [] } = useQuery<any[]>({
    queryKey: ['stages'], queryFn: () => api.get('/api/master/stages'),
  })
  const { data: models = [] } = useQuery<any[]>({
    queryKey: ['models'], queryFn: () => api.get('/api/master/models'),
  })

  const [form, setForm] = useState({
    model_id: rate?.model_id || 'default',
    stage: rate?.stage || (stages[0]?.id || ''),
    operation_name: rate?.operation_name || '',
    rate_per_piece: String(rate?.rate_per_piece || ''),
    active_from: rate?.active_from || new Date().toISOString().slice(0, 10),
    is_active: rate?.is_active ?? true,
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        model_id: form.model_id === 'default' ? null : form.model_id,
        stage: form.stage,
        operation_name: form.operation_name || null,
        rate_per_piece: parseFloat(form.rate_per_piece),
        active_from: form.active_from,
      }
      if (isEdit) {
        return api.put(`/api/payroll/rates/${rate.id}`, {
          rate_per_piece: payload.rate_per_piece,
          operation_name: payload.operation_name,
          is_active: form.is_active,
        })
      }
      return api.post('/api/payroll/rates', payload)
    },
    onSuccess: () => { toast.success(isEdit ? 'Yangilandi' : "Qo'shildi"); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Narx tahrirlash' : 'Yangi narx'}</DialogTitle>
          <DialogDescription>Model + bosqich uchun dona narxi</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Bosqich *</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({...form, stage: v})} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name_uz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={form.model_id} onValueChange={(v) => setForm({...form, model_id: v})} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">— DEFAULT (barcha modellar) —</SelectItem>
                {models.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              "DEFAULT" — modelga maxsus narx topilmasa, shu narx ishlatiladi
            </p>
          </div>
          <div>
            <Label>Operatsiya nomi (ixtiyoriy)</Label>
            <Input value={form.operation_name} onChange={(e) => setForm({...form, operation_name: e.target.value})}
              placeholder="masalan: tikuv (overlock + dvojnaya)" />
          </div>
          <div>
            <Label>Narx (UZS / dona) *</Label>
            <Input type="number" value={form.rate_per_piece}
              onChange={(e) => setForm({...form, rate_per_piece: e.target.value})}
              placeholder="1300" />
          </div>
          {!isEdit && (
            <div>
              <Label>Boshlanish sanasi *</Label>
              <Input type="date" value={form.active_from}
                onChange={(e) => setForm({...form, active_from: e.target.value})} />
            </div>
          )}
          {isEdit && (
            <div>
              <Label>Holat</Label>
              <Select value={String(form.is_active)} onValueChange={(v) => setForm({...form, is_active: v === 'true'})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Faol</SelectItem>
                  <SelectItem value="false">Nofaol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.stage || !form.rate_per_piece || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
