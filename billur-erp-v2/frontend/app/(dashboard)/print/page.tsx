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
import { Printer, Plus, Edit, Loader2, RefreshCw } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-muted-foreground text-muted-foreground',
  in_progress: 'border-amber-500 text-amber-600',
  completed: 'border-green-500 text-green-600',
  cancelled: 'border-red-500 text-red-600',
}

export default function PrintPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['print'],
    queryFn: () => api.get('/api/print'),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="h-7 w-7" /> Print buyurtmalari
          </h1>
          <p className="text-muted-foreground">Print ishlari va statuslar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['print'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('print.create') && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yangi print
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Print buyurtmalari</CardTitle>
          <CardDescription>{data.length} ta buyurtma</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Print buyurtma yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Klient/Zakaz</TableHead>
                    <TableHead>Tur</TableHead>
                    <TableHead className="text-right">Soni</TableHead>
                    <TableHead className="text-right">Bajarildi</TableHead>
                    <TableHead className="text-right">Brak</TableHead>
                    <TableHead className="text-right">Birlik narxi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(j.created_at).toLocaleDateString('uz-UZ')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {j.client_name && <div>{j.client_name}</div>}
                        {j.order_code && <div className="text-xs font-mono text-muted-foreground">{j.order_code}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{j.print_type || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{j.qty}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{j.printed_qty}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{j.rejected_qty}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {j.unit_price_uzs ? Number(j.unit_price_uzs).toLocaleString('en') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[j.status] || ''}>
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasPermission('print.update') && j.status !== 'completed' && (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(j)}>
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

      {showAdd && <AddDialog onClose={() => setShowAdd(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['print'] })} />}
      {editing && <EditDialog job={editing} onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['print'] })} />}
    </div>
  )
}

function AddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ print_type: '', qty: '100', unit_price_uzs: '', deadline: '', notes: '' })
  const mut = useMutation({
    mutationFn: () => api.post('/api/print', {
      print_type: form.print_type || null,
      qty: parseInt(form.qty, 10),
      unit_price_uzs: form.unit_price_uzs ? parseFloat(form.unit_price_uzs) : null,
      deadline: form.deadline || null, notes: form.notes || null,
    }),
    onSuccess: () => { toast.success("Qo'shildi"); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yangi print buyurtma</DialogTitle><DialogDescription>Ma'lumotlar</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Print turi</Label><Input value={form.print_type} onChange={(e) => setForm({...form, print_type: e.target.value})} placeholder="dtf / silikon / sublim" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Soni *</Label><Input type="number" min={1} value={form.qty} onChange={(e) => setForm({...form, qty: e.target.value})} /></div>
            <div><Label>Narxi (UZS)</Label><Input type="number" value={form.unit_price_uzs} onChange={(e) => setForm({...form, unit_price_uzs: e.target.value})} /></div>
          </div>
          <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({...form, deadline: e.target.value})} /></div>
          <div><Label>Eslatma</Label><Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.qty || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ job, onClose, onSaved }: { job: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    printed_qty: String(job.printed_qty),
    rejected_qty: String(job.rejected_qty),
    status: job.status,
    notes: job.notes || ''
  })
  const mut = useMutation({
    mutationFn: () => api.put(`/api/print/${job.id}`, {
      printed_qty: parseInt(form.printed_qty, 10),
      rejected_qty: parseInt(form.rejected_qty, 10),
      status: form.status, notes: form.notes,
    }),
    onSuccess: () => { toast.success('Saqlandi'); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Print tahrirlash</DialogTitle><DialogDescription>Buyurtma: {job.qty} ta</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Bajarildi</Label><Input type="number" value={form.printed_qty} onChange={(e) => setForm({...form, printed_qty: e.target.value})} /></div>
            <div><Label>Brak</Label><Input type="number" value={form.rejected_qty} onChange={(e) => setForm({...form, rejected_qty: e.target.value})} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Eslatma</Label><Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
