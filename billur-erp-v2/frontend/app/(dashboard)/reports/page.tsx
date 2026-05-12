"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, getToken } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

function todayStr() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function ReportsPage() {
  const [since, setSince] = useState(nDaysAgo(30))
  const [until, setUntil] = useState(todayStr())

  const downloadExcel = async (path: string, name: string) => {
    try {
      const url = `${path}?since=${since}&until=${until}`
      const token = getToken()
      const headers: Record<string, string> = {}
      if (token) headers['x-session-token'] = token
      const r = await fetch(url, { credentials: 'include', headers })
      if (!r.ok) { toast.error("Yuklab olib bo'lmadi: " + (await r.text())); return }
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = name; a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Yuklab olindi')
    } catch (e: any) { toast.error('Xato: ' + e?.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7" /> Hisobotlar
        </h1>
        <p className="text-muted-foreground">Excel eksport va aggregatsiyalar</p>
      </div>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">Excel eksport</TabsTrigger>
          <TabsTrigger value="workers">Ishchilar</TabsTrigger>
          <TabsTrigger value="clients">Klientlar</TabsTrigger>
          <TabsTrigger value="daily">Kunlik</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sana oraligi</CardTitle>
              <CardDescription>Production va worker hisobotlari uchun</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div><Label>Boshlanish</Label><Input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></div>
                <div><Label>Tugash</Label><Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <FileSpreadsheet className="h-10 w-10 text-blue-600 mb-3" />
                <h3 className="font-bold">Zakazlar</h3>
                <p className="text-xs text-muted-foreground mb-3">Hamma zakazlar (status, klient, soni)</p>
                <Button className="w-full" onClick={() => downloadExcel('/api/reports/export/orders', `orders-${todayStr()}.xlsx`)}>
                  <Download className="mr-2 h-4 w-4" /> Yuklab olish
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <FileSpreadsheet className="h-10 w-10 text-green-600 mb-3" />
                <h3 className="font-bold">Production events</h3>
                <p className="text-xs text-muted-foreground mb-3">Tanlangan oraliqdagi events</p>
                <Button className="w-full" onClick={() => downloadExcel('/api/reports/export/production', `production-${todayStr()}.xlsx`)}>
                  <Download className="mr-2 h-4 w-4" /> Yuklab olish
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <FileSpreadsheet className="h-10 w-10 text-purple-600 mb-3" />
                <h3 className="font-bold">Ishchilar</h3>
                <p className="text-xs text-muted-foreground mb-3">Ish hajmi statistikasi</p>
                <Button className="w-full" onClick={() => downloadExcel('/api/reports/export/workers', `workers-${todayStr()}.xlsx`)}>
                  <Download className="mr-2 h-4 w-4" /> Yuklab olish
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workers"><WorkersTab since={since} /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="daily"><DailyTab since={since} /></TabsContent>
      </Tabs>
    </div>
  )
}

function WorkersTab({ since }: { since: string }) {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['reports', 'workers', since],
    queryFn: () => api.get(`/api/reports/worker-performance?since=${since}`),
  })
  return (
    <Card>
      <CardHeader><CardTitle>Ishchilar samaradorligi</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> :
         !data.length ? <div className="text-center py-8 text-muted-foreground">Ma'lumot yo'q</div> :
        <Table>
          <TableHeader><TableRow>
            <TableHead>Ishchi</TableHead><TableHead>Tabel</TableHead><TableHead>Bosqich</TableHead>
            <TableHead className="text-right">Events</TableHead><TableHead className="text-right">Jami</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.map((w, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{w.worker_name || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{w.employee_code || '—'}</TableCell>
              <TableCell><Badge variant="outline">{w.stage_name || w.to_stage}</Badge></TableCell>
              <TableCell className="text-right font-mono">{w.event_count}</TableCell>
              <TableCell className="text-right font-mono font-bold">{w.total_qty}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>}
      </CardContent>
    </Card>
  )
}

function ClientsTab() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['reports', 'clients'],
    queryFn: () => api.get('/api/reports/clients-summary'),
  })
  return (
    <Card>
      <CardHeader><CardTitle>Klientlar bo'yicha</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> :
        <Table>
          <TableHeader><TableRow>
            <TableHead>Kod</TableHead><TableHead>Klient</TableHead>
            <TableHead className="text-right">Zakaz</TableHead><TableHead className="text-right">Faol</TableHead>
            <TableHead className="text-right">Mahsulot</TableHead><TableHead className="text-right">Balans</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.code}</TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-right font-mono">{c.total_orders}</TableCell>
              <TableCell className="text-right font-mono text-amber-600">{c.active_orders}</TableCell>
              <TableCell className="text-right font-mono">{c.total_pieces}</TableCell>
              <TableCell className={"text-right font-mono " + (Number(c.balance_uzs) > 0 ? 'text-green-600' : Number(c.balance_uzs) < 0 ? 'text-red-600' : '')}>
                {Number(c.balance_uzs).toLocaleString('en')}
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>}
      </CardContent>
    </Card>
  )
}

function DailyTab({ since }: { since: string }) {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['reports', 'daily', since],
    queryFn: () => api.get(`/api/reports/daily-production?since=${since}`),
  })
  const grouped = new Map<string, any[]>()
  for (const r of data) {
    const day = String(r.day).slice(0, 10)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day)!.push(r)
  }
  return (
    <div className="space-y-3">
      {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> :
       grouped.size === 0 ? <div className="text-center py-8 text-muted-foreground">Ma'lumot yo'q</div> :
       [...grouped.entries()].map(([day, rows]) => (
        <Card key={day}>
          <CardHeader><CardTitle className="text-base">📅 {day}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bosqich</TableHead><TableHead className="text-right">Events</TableHead><TableHead className="text-right">Soni</TableHead>
              </TableRow></TableHeader>
              <TableBody>{rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{r.stage_name || r.to_stage}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{r.event_count}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{r.qty}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
