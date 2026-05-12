"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search, Plus, MoreHorizontal, Edit, Trash2, Building2, Phone, Mail, RefreshCw, Loader2, Wallet,
} from "lucide-react"
import { useClients } from "@/lib/api/hooks"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

export default function ClientsPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const { data: clients = [], isLoading } = useClients()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const filtered = clients.filter((c: any) =>
    !searchQuery
    || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    || c.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalBalance = filtered.reduce((s: number, c: any) => s + Number(c.balance_uzs || 0), 0)
  const activeCount = filtered.filter((c: any) => c.is_active).length

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/clients/${id}`),
    onSuccess: () => { toast.success("O'chirildi"); qc.invalidateQueries({ queryKey: ['clients'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klientlar</h1>
          <p className="text-muted-foreground">Mijozlar bilan ishlash, balans va aloqa ma'lumotlari</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['clients'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('clients.create') && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yangi klient
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami klientlar</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">{activeCount} aktiv</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami balans</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={
              "text-2xl font-bold " +
              (totalBalance > 0 ? 'text-green-600' : totalBalance < 0 ? 'text-red-600' : '')
            }>
              {totalBalance.toLocaleString('en')} <span className="text-sm font-normal">UZS</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Klientlar ro'yxati</CardTitle>
          <CardDescription>{filtered.length} ta klient ko'rsatilmoqda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Nom, kod bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9" />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Nomi</TableHead>
                    <TableHead>Aloqa</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead className="text-right">Balans (UZS)</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Klient topilmadi
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {c.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{c.name}</div>
                            {c.contact_name && (
                              <div className="text-xs text-muted-foreground">{c.contact_name}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {c.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" /> {c.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.pricing_type ? <Badge variant="outline">{c.pricing_type}</Badge> : '—'}
                      </TableCell>
                      <TableCell className={
                        "text-right font-mono " +
                        (Number(c.balance_uzs) > 0 ? 'text-green-600' :
                         Number(c.balance_uzs) < 0 ? 'text-red-600' : 'text-muted-foreground')
                      }>
                        {Number(c.balance_uzs).toLocaleString('en')}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">Faol</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">Nofaol</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasPermission('clients.update') && (
                              <DropdownMenuItem onClick={() => setEditing(c)}>
                                <Edit className="mr-2 h-4 w-4" /> Tahrirlash
                              </DropdownMenuItem>
                            )}
                            {hasPermission('clients.delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive"
                                  onClick={() => {
                                    if (confirm(`${c.name} klientni o'chirilsinmi?`)) deleteMut.mutate(c.id)
                                  }}>
                                  <Trash2 className="mr-2 h-4 w-4" /> O'chirish
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && <ClientFormDialog onClose={() => setShowAdd(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['clients'] })} />}
      {editing && <ClientFormDialog client={editing} onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['clients'] })} />}
    </div>
  )
}

function ClientFormDialog({ client, onClose, onSaved }: { client?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    code: client?.code || '',
    name: client?.name || '',
    contact_name: client?.contact_name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    pricing_type: client?.pricing_type || 'standard',
    notes: client?.notes || '',
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload = { ...form,
        contact_name: form.contact_name || null, phone: form.phone || null,
        email: form.email || null, notes: form.notes || null }
      if (isEdit) return api.put(`/api/clients/${client.id}`, payload)
      return api.post('/api/clients', payload)
    },
    onSuccess: () => { toast.success(isEdit ? 'Yangilandi' : "Qo'shildi"); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Klient tahrirlash' : 'Yangi klient'}</DialogTitle>
          <DialogDescription>Klient ma'lumotlari</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kod *</Label>
            <Input value={form.code} disabled={isEdit}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="C001" className="font-mono" />
          </div>
          <div>
            <Label>Nomi *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="MChJ Textile" />
          </div>
          <div>
            <Label>Aloqa shaxsi</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Eslatma</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.code || !form.name}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
