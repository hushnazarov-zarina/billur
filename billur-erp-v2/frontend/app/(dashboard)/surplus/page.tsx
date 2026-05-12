"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { useClients } from "@/lib/api/hooks"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Gift, DollarSign, Loader2, RefreshCw } from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
  in_warehouse: 'Omborda', reserved: 'Buyurtilgan', sold: 'Sotilgan', discarded: "Yo'q qilingan"
}
const STATUS_COLORS: Record<string, string> = {
  in_warehouse: 'border-green-500 text-green-600',
  reserved: 'border-amber-500 text-amber-600',
  sold: 'border-muted-foreground text-muted-foreground',
  discarded: 'border-red-500 text-red-600',
}

export default function SurplusPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('in_warehouse')
  const [selling, setSelling] = useState<any>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['surplus', statusFilter],
    queryFn: () => api.get(`/api/surplus${statusFilter ? `?status=${statusFilter}` : ''}`),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="h-7 w-7" /> Izlishka
          </h1>
          <p className="text-muted-foreground">Ortiqcha mahsulotlar va sotuvlar</p>
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['surplus'] })}>
          <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Izlishka ro'yxati</CardTitle>
              <CardDescription>{data.length} ta mahsulot</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Barcha</SelectItem>
                <SelectItem value="in_warehouse">Omborda</SelectItem>
                <SelectItem value="reserved">Buyurtilgan</SelectItem>
                <SelectItem value="sold">Sotilgan</SelectItem>
                <SelectItem value="discarded">Yo'q qilingan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Izlishka yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Mahsulot</TableHead>
                    <TableHead>Soni</TableHead>
                    <TableHead>Sabab</TableHead>
                    <TableHead>Manba</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-muted-foreground">{s.arrived_at}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">{s.model_code}</span>
                        <span className="text-muted-foreground"> · {s.color_name} · {s.size_code}</span>
                      </TableCell>
                      <TableCell className="font-mono font-bold">{s.qty}</TableCell>
                      <TableCell className="text-xs">{s.reason || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{s.source_order_code || '—'}</TableCell>
                      <TableCell className="text-xs">{s.client_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                          {STATUS_LABELS[s.status] || s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.status === 'in_warehouse' && hasPermission('surplus.sell') && (
                          <Button size="sm" variant="outline" onClick={() => setSelling(s)}>
                            <DollarSign className="h-3 w-3 mr-1" /> Sotish
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

      {selling && <SellDialog item={selling} onClose={() => setSelling(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ['surplus'] })} />}
    </div>
  )
}

function SellDialog({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const { data: clients = [] } = useClients()
  const [qty, setQty] = useState(String(item.qty))
  const [clientId, setClientId] = useState(item.client_id || 'none')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  const mut = useMutation({
    mutationFn: () => api.post(`/api/surplus/${item.id}/sell`, {
      sale_qty: parseInt(qty, 10),
      client_id: clientId === 'none' ? null : clientId,
      sale_price_uzs: price ? parseFloat(price) : null,
      notes: notes || null
    }),
    onSuccess: () => { toast.success('Sotildi'); onDone(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  const total = price && qty ? Number(price) * Number(qty) : 0

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Izlishka sotish</DialogTitle>
          <DialogDescription>{item.model_code} · {item.color_name} · {item.size_code} · {item.qty} ta mavjud</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Soni *</Label>
            <Input type="number" min={1} max={item.qty} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Klient</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— tanlanmagan —</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Birlik narxi (UZS)</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25000" />
            {total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Jami: <strong className="font-mono">{total.toLocaleString('en')}</strong> UZS</p>
            )}
          </div>
          <div>
            <Label>Izoh</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={!qty || Number(qty) < 1 || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sotildi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
