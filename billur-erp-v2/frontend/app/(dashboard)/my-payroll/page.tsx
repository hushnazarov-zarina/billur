"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, Loader2 } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  draft: 'border-amber-500 text-amber-600',
  approved: 'border-blue-500 text-blue-600',
  paid: 'border-green-500 text-green-600',
  cancelled: 'border-red-500 text-red-600',
}

export default function MyPayrollPage() {
  const [activeEntry, setActiveEntry] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-payroll'],
    queryFn: () => api.get('/api/payroll/entries'),
  })

  const { data: detail } = useQuery<any>({
    queryKey: ['my-payroll-detail', activeEntry],
    queryFn: () => api.get(`/api/payroll/entries/${activeEntry}`),
    enabled: !!activeEntry,
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-7 w-7" /> Mening Oyligim
        </h1>
        <p className="text-muted-foreground">Scan qilingan ishlaringizga asoslangan oylik</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll tarixi</CardTitle>
          <CardDescription>{entries.length} ta davr</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !entries.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Hozircha yozuv yo'q. Admin hisoblaganidan keyin ko'rinadi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Davr</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Penalty/Advance</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id} className="cursor-pointer"
                      onClick={() => setActiveEntry(activeEntry === e.id ? null : e.id)}>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(e.period_start).toLocaleDateString('uz-UZ')} → {new Date(e.period_end).toLocaleDateString('uz-UZ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{e.total_quantity}</TableCell>
                      <TableCell className="text-right font-mono">{Number(e.gross_amount).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        +{Number(e.bonus_amount).toLocaleString('en')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        -{(Number(e.penalty_amount) + Number(e.advance_amount)).toLocaleString('en')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">
                        {Number(e.net_amount).toLocaleString('en')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[e.status]}>{e.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.approved_by_name && <div>✓ {e.approved_by_name}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {detail?.details?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detallar — {new Date(detail.entry.period_start).toLocaleDateString('uz-UZ')} → {new Date(detail.entry.period_end).toLocaleDateString('uz-UZ')}</CardTitle>
            <CardDescription>Har bir scan uchun hisoblangan summa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>QR</TableHead>
                    <TableHead>Zakaz</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Bosqich</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Narx/dona</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.details.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">
                        {d.finished_at ? new Date(d.finished_at).toLocaleDateString('uz-UZ') : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{d.qr_code}</TableCell>
                      <TableCell className="text-xs font-mono">{d.order_code}</TableCell>
                      <TableCell className="text-xs font-mono">{d.model_code}</TableCell>
                      <TableCell><Badge variant="outline">{d.stage_name || d.stage}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{d.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{Number(d.rate_per_piece).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{Number(d.amount).toLocaleString('en')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
