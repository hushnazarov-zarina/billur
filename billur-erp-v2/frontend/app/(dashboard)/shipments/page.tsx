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
import { Truck, Lock, Loader2, RefreshCw } from "lucide-react"

export default function ShipmentsPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('open')

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['shipments', statusFilter],
    queryFn: () => api.get(`/api/shipments${statusFilter ? `?status=${statusFilter}` : ''}`),
  })

  const closeMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/shipments/${id}/close`),
    onSuccess: () => { toast.success('Yopildi'); qc.invalidateQueries({ queryKey: ['shipments'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-7 w-7" /> Shipmentlar
          </h1>
          <p className="text-muted-foreground">Yetkazib berish va mashinalar</p>
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['shipments'] })}>
          <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Shipmentlar ro'yxati</CardTitle>
              <CardDescription>{data.length} ta shipment</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Barchasi</SelectItem>
                <SelectItem value="open">Ochiq</SelectItem>
                <SelectItem value="closed">Yopilgan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Shipment yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Mashina</TableHead>
                    <TableHead className="text-right">Boxes</TableHead>
                    <TableHead>Ochildi</TableHead>
                    <TableHead>Yopildi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-semibold">{s.id}</TableCell>
                      <TableCell>{s.client_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.truck_info || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{s.box_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString('uz-UZ', { hour12: false })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString('uz-UZ', { hour12: false }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          s.status === 'open' ? 'border-amber-500 text-amber-600' : 'border-green-500 text-green-600'
                        }>{s.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.status === 'open' && hasPermission('box.update') && (
                          <Button size="sm" onClick={() => {
                            if (confirm(`Shipment "${s.id}" yopilsinmi? ${s.box_count} ta box "shipped" bo'ladi.`)) {
                              closeMut.mutate(s.id)
                            }
                          }}>
                            <Lock className="h-3 w-3 mr-1" /> Yopish
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
    </div>
  )
}
