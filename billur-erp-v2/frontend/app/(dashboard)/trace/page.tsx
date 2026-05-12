"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api/client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Search, ScrollText, Clock, CheckCircle, AlertTriangle, User,
  Loader2, Package,
} from "lucide-react"

const STAGE_ICONS: Record<string, string> = {
  cutting: '✂️', printing: '🎨', sewing: '🪡', quality: '✓',
  ironing: '♨️', tagging: '🏷️', packing: '📦', boxing: '📦', shipped: '🚛',
};

const DECISION_COLORS: Record<string, string> = {
  passed: 'border-green-500 text-green-600',
  sort_1: 'border-blue-500 text-blue-600',
  sort_2: 'border-amber-500 text-amber-600',
  defect: 'border-orange-500 text-orange-600',
  rework: 'border-purple-500 text-purple-600',
  reject: 'border-red-500 text-red-600',
};

export default function TracePage() {
  const params = useSearchParams()
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")

  useEffect(() => {
    const initial = params.get('qr') || ""
    if (initial) {
      setQuery(initial)
      setActiveQuery(initial)
    }
  }, [params])

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['trace', activeQuery],
    queryFn: () => api.get(`/api/scanning/qr-codes/${encodeURIComponent(activeQuery)}/trace`),
    enabled: !!activeQuery,
    retry: false,
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-7 w-7" /> Traceability
        </h1>
        <p className="text-sm text-muted-foreground">
          QR yoki box raqami orqali to'liq production tarixini ko'ring
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="BILLUR-XXX yoki UUID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setActiveQuery(query.trim())}
                className="pl-9 font-mono"
              />
            </div>
            <Button onClick={() => setActiveQuery(query.trim())} disabled={!query.trim()}>
              Qidirish
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>QR topilmadi: {(error as any).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <Card><CardContent className="pt-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent></Card>
      )}

      {data && (
        <>
          {/* QR meta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5"/> {data.qr.qr_code}
              </CardTitle>
              <CardDescription>
                Zakaz: <strong className="font-mono">{data.qr.order_code}</strong>
                {data.qr.client_name && <> · Klient: <strong>{data.qr.client_name}</strong></>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Model</div>
                  <div className="font-mono font-semibold">{data.qr.model_code || '—'}</div>
                  <div className="text-xs text-muted-foreground">{data.qr.model_name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Rang</div>
                  <div className="font-semibold">{data.qr.color_name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">O'lcham</div>
                  <div className="font-mono font-semibold">{data.qr.size_code || '—'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Quantity</div>
                  <div className="font-mono font-bold text-lg">{data.qr.quantity}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Hozirgi bosqich</div>
                  <Badge variant="outline">{data.qr.current_stage}</Badge>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Status</div>
                  <Badge variant="outline">{data.qr.status}</Badge>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Yaratildi</div>
                  <div className="text-xs">{new Date(data.qr.created_at).toLocaleString('uz-UZ', { hour12: false })}</div>
                </div>
                {data.qr.completed_at && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Tugatildi</div>
                    <div className="text-xs">{new Date(data.qr.completed_at).toLocaleString('uz-UZ', { hour12: false })}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Scan history timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5"/> Scan tarixi
              </CardTitle>
              <CardDescription>{data.scans.length} ta scan</CardDescription>
            </CardHeader>
            <CardContent>
              {data.scans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Scan yo'q</div>
              ) : (
                <div className="space-y-3">
                  {data.scans.map((s: any) => {
                    const dur = s.duration_seconds
                      ? `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s`
                      : null
                    return (
                      <div key={s.id} className={
                        "rounded-lg border p-4 " +
                        (s.is_suspicious ? 'border-amber-500/50 bg-amber-50/20' : '')
                      }>
                        <div className="flex items-start gap-4">
                          <div className="text-2xl">{STAGE_ICONS[s.stage] || '•'}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-bold">{s.stage}</Badge>
                              <Badge variant="outline" className={
                                s.status === 'finished' ? 'border-green-500 text-green-600' :
                                s.status === 'started'  ? 'border-amber-500 text-amber-600' :
                                'border-red-500 text-red-600'
                              }>{s.status}</Badge>
                              {s.is_suspicious && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Shubhali
                                </Badge>
                              )}
                              {dur && <Badge variant="outline">{dur}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {(s.worker_name || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{s.worker_name}</span>
                              <span className="text-xs text-muted-foreground">({s.employee_code})</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              {new Date(s.start_scan_at).toLocaleString('uz-UZ', { hour12: false })}
                              {s.finish_scan_at && ` → ${new Date(s.finish_scan_at).toLocaleTimeString('uz-UZ', { hour12: false })}`}
                            </div>
                            {s.suspicious_reason && (
                              <div className="text-xs text-amber-600 mt-1">⚠ {s.suspicious_reason}</div>
                            )}
                            {s.override_by && (
                              <div className="text-xs text-red-600 mt-1">
                                Override: {s.override_by_name} — {s.override_reason}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality decisions */}
          {data.quality_decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5"/> Quality qarorlari
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Qaror</TableHead>
                      <TableHead>Defekt</TableHead>
                      <TableHead className="text-right">Soni</TableHead>
                      <TableHead>Aybi</TableHead>
                      <TableHead>QC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.quality_decisions.map((q: any) => (
                      <TableRow key={q.id}>
                        <TableCell className="text-xs">
                          {new Date(q.created_at).toLocaleString('uz-UZ', { hour12: false })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={DECISION_COLORS[q.decision]}>{q.decision}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {q.defect_type && <div className="font-semibold">{q.defect_type}</div>}
                          {q.description && <div className="text-muted-foreground">{q.description}</div>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{q.quantity_affected}</TableCell>
                        <TableCell className="text-xs">
                          {q.responsible_stage && <Badge variant="outline">{q.responsible_stage}</Badge>}
                          {q.responsible_worker_name && <div className="text-muted-foreground mt-1">{q.responsible_worker_name}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{q.checked_by_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
