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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Wallet, Loader2, Zap, CheckCircle, DollarSign } from "lucide-react"

function firstDayOfMonth() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
}
function lastDayOfMonth() {
  const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0)
  return d.toISOString().slice(0, 10)
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'border-amber-500 text-amber-600',
  approved: 'border-blue-500 text-blue-600',
  paid: 'border-green-500 text-green-600',
  cancelled: 'border-red-500 text-red-600',
}

export default function PayrollPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [periodStart, setPeriodStart] = useState(firstDayOfMonth())
  const [periodEnd, setPeriodEnd] = useState(lastDayOfMonth())
  const [editing, setEditing] = useState<any>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['payroll', 'entries', periodStart, periodEnd],
    queryFn: () => api.get(`/api/payroll/entries?period_start=${periodStart}&period_end=${periodEnd}`),
  })

  const calcMut = useMutation({
    mutationFn: () => api.post('/api/payroll/calculate-all', {
      period_start: periodStart, period_end: periodEnd,
    }),
    onSuccess: (res: any) => {
      toast.success(`${res.workers_count} ta ishchi uchun hisoblandi`)
      qc.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/payroll/entries/${id}/approve`),
    onSuccess: () => { toast.success("Tasdiqlandi"); qc.invalidateQueries({ queryKey: ['payroll'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const payMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/payroll/entries/${id}/pay`),
    onSuccess: () => { toast.success("To'landi"); qc.invalidateQueries({ queryKey: ['payroll'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const totalGross = data.reduce((s, e) => s + Number(e.gross_amount), 0)
  const totalNet = data.reduce((s, e) => s + Number(e.net_amount), 0)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-7 w-7" /> Payroll
        </h1>
        <p className="text-muted-foreground">Ishchilar oylik hisoboti — real scan data asosida</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Davr</CardTitle>
          <CardDescription>Hisoblash uchun davrni tanlang</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div><Label>Boshlanish</Label><Input type="date" value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)} /></div>
            <div><Label>Tugash</Label><Input type="date" value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)} /></div>
            {hasPermission('payroll.calculate') && (
              <Button onClick={() => calcMut.mutate()} disabled={calcMut.isPending}>
                {calcMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Hammaga hisoblash
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Jami ishchilar</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Gross (UZS)</p>
          <p className="text-2xl font-bold font-mono">{totalGross.toLocaleString('en')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Net (UZS)</p>
          <p className="text-2xl font-bold font-mono text-green-600">{totalNet.toLocaleString('en')}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll entries</CardTitle>
          <CardDescription>{data.length} ta yozuv</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Yozuv yo'q. "Hammaga hisoblash" tugmasini bosing.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ishchi</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.worker_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{e.employee_code}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{e.total_quantity}</TableCell>
                      <TableCell className="text-right font-mono">{Number(e.gross_amount).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{Number(e.bonus_amount).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{Number(e.penalty_amount).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{Number(e.advance_amount).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{Number(e.net_amount).toLocaleString('en')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[e.status]}>{e.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.status === 'draft' && hasPermission('payroll.approve') && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditing(e)}>
                                <DollarSign className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={() => approveMut.mutate(e.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Tasdiq
                              </Button>
                            </>
                          )}
                          {e.status === 'approved' && hasPermission('payroll.approve') && (
                            <Button size="sm" variant="outline" onClick={() => payMut.mutate(e.id)}>
                              💵 To'landi
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

      {editing && <BonusDialog entry={editing} onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['payroll'] })} />}
    </div>
  )
}

function BonusDialog({ entry, onClose, onSaved }: { entry: any; onClose: () => void; onSaved: () => void }) {
  const [bonus, setBonus] = useState(String(entry.bonus_amount))
  const [penalty, setPenalty] = useState(String(entry.penalty_amount))
  const [advance, setAdvance] = useState(String(entry.advance_amount))
  const [notes, setNotes] = useState(entry.notes || '')

  const mut = useMutation({
    mutationFn: () => api.patch(`/api/payroll/entries/${entry.id}`, {
      bonus_amount: Number(bonus),
      penalty_amount: Number(penalty),
      advance_amount: Number(advance),
      notes,
    }),
    onSuccess: () => { toast.success('Saqlandi'); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  const previewNet = Number(entry.gross_amount) + Number(bonus || 0) - Number(penalty || 0) - Number(advance || 0)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.worker_name} — bonus/penalty</DialogTitle>
          <DialogDescription>Gross: {Number(entry.gross_amount).toLocaleString('en')} UZS</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Bonus (+)</Label><Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} /></div>
          <div><Label>Penalty (-)</Label><Input type="number" value={penalty} onChange={(e) => setPenalty(e.target.value)} /></div>
          <div><Label>Advance / Avans (-)</Label><Input type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} /></div>
          <div><Label>Izoh</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            Net = <span className="font-mono font-bold">{previewNet.toLocaleString('en')}</span> UZS
          </div>
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
