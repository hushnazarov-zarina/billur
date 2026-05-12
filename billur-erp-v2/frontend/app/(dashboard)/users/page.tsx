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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users as UsersIcon, Plus, Edit, Loader2, RefreshCw } from "lucide-react"

export default function UsersPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users'),
  })
  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/api/users/_meta/roles'),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UsersIcon className="h-7 w-7" /> Foydalanuvchilar
          </h1>
          <p className="text-muted-foreground">Tizim foydalanuvchilari va rollar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['users'] })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yangilash
          </Button>
          {hasPermission('users.create') && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yangi foydalanuvchi
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foydalanuvchilar ro'yxati</CardTitle>
          <CardDescription>{data.length} ta foydalanuvchi</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !data.length ? (
            <div className="text-center py-12 text-muted-foreground">Foydalanuvchi yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>F.I.O.</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Oxirgi kirish</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {u.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{u.role_name_uz || u.role_id}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('uz-UZ', { hour12: false }) : '—'}
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">Faol</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">Nofaol</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasPermission('users.update') && (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
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

      {showAdd && <UserDialog roles={roles} onClose={() => setShowAdd(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })} />}
      {editing && <UserDialog user={editing} roles={roles} onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })} />}
    </div>
  )
}

function UserDialog({ user, roles, onClose, onSaved }: { user?: any; roles: any[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    role_id: user?.role_id || (roles[0]?.id || 'admin'),
    password: '',
    is_active: user?.is_active ?? true,
  })

  const mut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        const payload: any = { full_name: form.full_name, role_id: form.role_id, is_active: form.is_active }
        if (form.password) payload.password = form.password
        return api.put(`/api/users/${user.id}`, payload)
      }
      return api.post('/api/users', form)
    },
    onSuccess: () => { toast.success(isEdit ? 'Saqlandi' : "Qo'shildi"); onSaved(); onClose() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Foydalanuvchi tahrirlash' : 'Yangi foydalanuvchi'}</DialogTitle>
          <DialogDescription>Login va rol</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Username *</Label>
            <Input value={form.username} disabled={isEdit}
              onChange={(e) => setForm({...form, username: e.target.value.toLowerCase()})}
              className="font-mono" />
          </div>
          <div>
            <Label>F.I.O. *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} />
          </div>
          <div>
            <Label>Rol *</Label>
            <Select value={form.role_id} onValueChange={(v) => setForm({...form, role_id: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name_uz || r.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{isEdit ? 'Yangi parol (ixtiyoriy)' : 'Parol *'}</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
              placeholder={isEdit ? "Bo'sh qoldirsangiz o'zgarmaydi" : ''} />
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
