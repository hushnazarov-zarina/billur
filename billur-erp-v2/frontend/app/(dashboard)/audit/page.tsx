"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollText, Loader2, ChevronRight, ChevronDown } from "lucide-react"

export default function AuditPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: types = [] } = useQuery<any[]>({
    queryKey: ['audit', 'event-types'],
    queryFn: () => api.get('/api/audit/event-types'),
  })

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['audit', eventTypeFilter, resourceFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (eventTypeFilter !== 'all') qs.set('event_type', eventTypeFilter)
      if (resourceFilter) qs.set('resource_type', resourceFilter)
      qs.set('limit', '200')
      return api.get(`/api/audit?${qs.toString()}`)
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-7 w-7" /> Audit log
        </h1>
        <p className="text-muted-foreground">Tizimdagi barcha o'zgarishlar tarixi</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Event turi</Label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {types.map((t: any) => (
                    <SelectItem key={t.event_type} value={t.event_type}>
                      {t.event_type} ({t.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resource turi</Label>
              <Input placeholder="masalan: order, client" value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit logs</CardTitle>
          <CardDescription>{data.length} ta log</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Log yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vaqt</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((l: any) => {
                    const hasDetails = l.before_value || l.after_value || l.metadata
                    const isOpen = expanded === l.id
                    return (
                      <>
                        <TableRow key={l.id} className={hasDetails ? "cursor-pointer" : ""}
                          onClick={() => hasDetails && setExpanded(isOpen ? null : l.id)}>
                          <TableCell className="text-xs font-mono whitespace-nowrap">
                            {new Date(l.at).toLocaleString('uz-UZ', { hour12: false })}
                          </TableCell>
                          <TableCell><Badge variant="outline">{l.event_type}</Badge></TableCell>
                          <TableCell className="text-xs">{l.username || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {l.resource_type && <div>{l.resource_type}</div>}
                            {l.resource_id && (
                              <div className="font-mono text-muted-foreground text-[10px]">
                                {String(l.resource_id).slice(0, 16)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{l.action || '—'}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{l.ip_address || '—'}</TableCell>
                          <TableCell>
                            {hasDetails && (
                              isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isOpen && hasDetails && (
                          <TableRow key={`${l.id}-x`}>
                            <TableCell colSpan={7} className="bg-muted/30">
                              <div className="space-y-2 text-xs">
                                {l.metadata && (
                                  <div>
                                    <div className="font-bold mb-1">Metadata:</div>
                                    <pre className="bg-background p-2 rounded border overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>
                                  </div>
                                )}
                                {l.before_value && (
                                  <div>
                                    <div className="font-bold mb-1">Before:</div>
                                    <pre className="bg-background p-2 rounded border overflow-x-auto">{JSON.stringify(l.before_value, null, 2)}</pre>
                                  </div>
                                )}
                                {l.after_value && (
                                  <div>
                                    <div className="font-bold mb-1">After:</div>
                                    <pre className="bg-background p-2 rounded border overflow-x-auto">{JSON.stringify(l.after_value, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
