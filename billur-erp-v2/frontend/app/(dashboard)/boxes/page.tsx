"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, Loader2, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

const STATUS_LABELS: Record<string, string> = {
  packed: "Bog'landi", warehouse: 'Omborda', shipping: "Yo'lda", shipped: 'Yetkazildi'
}
const STATUS_COLORS: Record<string, string> = {
  packed: 'border-amber-500 text-amber-600',
  warehouse: 'border-blue-500 text-blue-600',
  shipping: 'border-purple-500 text-purple-600',
  shipped: 'border-green-500 text-green-600',
}

export default function BoxesPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('packed')

  const { data: stats = [] } = useQuery<any[]>({
    queryKey: ['boxes', 'stats'],
    queryFn: () => api.get('/api/boxes/_stats/by-status'),
    refetchInterval: 30000,
  })
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['boxes', statusFilter],
    queryFn: () => api.get(`/api/boxes${statusFilter ? `?status=${statusFilter}` : ''}`),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7" /> BoxApp
          </h1>
          <p className="text-muted-foreground">Qadoqlangan boxlar va shipment status</p>
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['boxes'] })}>
          <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <button key={s.status} onClick={() => setStatusFilter(s.status)}
            className={
              "rounded-lg border bg-card p-4 text-left transition hover:shadow-md " +
              (statusFilter === s.status ? 'ring-2 ring-primary border-primary' : '')
            }>
            <div className="text-xs uppercase font-semibold text-muted-foreground">
              {STATUS_LABELS[s.status] || s.status}
            </div>
            <div className="text-3xl font-bold mt-1">{s.count}</div>
            <div className="text-xs text-muted-foreground mt-1">{Number(s.total_kg).toFixed(1)} kg</div>
          </button>
        ))}
        <button onClick={() => setStatusFilter('')}
          className={
            "rounded-lg border bg-card p-4 text-left transition hover:shadow-md " +
            (statusFilter === '' ? 'ring-2 ring-primary border-primary' : '')
          }>
          <div className="text-xs uppercase font-semibold text-muted-foreground">Barchasi</div>
          <div className="text-3xl font-bold mt-1">{stats.reduce((a, b) => a + b.count, 0)}</div>
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Boxlar ro'yxati</CardTitle>
          <CardDescription>{data.length} ta box</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Box yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>Zakaz / №</TableHead>
                    <TableHead>Tur</TableHead>
                    <TableHead>Model · Rang</TableHead>
                    <TableHead className="text-right">Vazn</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Yaratdi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((b: any) => (
                    <TableRow key={b.uid}>
                      <TableCell className="font-mono text-xs">{b.uid}</TableCell>
                      <TableCell>
                        <div className="font-mono font-semibold">{b.zakaz}</div>
                        <div className="text-xs text-muted-foreground">№ {b.box_num}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          b.type === 'mix' ? 'border-purple-500 text-purple-600' : ''
                        }>{b.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">{b.model || '—'}</span>
                        {b.color && <span className="text-muted-foreground"> · {b.color}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{Number(b.kg || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[b.status] || ''}>
                          {STATUS_LABELS[b.status] || b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.created_by_name}</TableCell>
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
