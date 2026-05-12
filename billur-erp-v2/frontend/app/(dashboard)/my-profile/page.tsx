"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  UserCircle, Phone, Mail, MapPin, Briefcase, Calendar,
  FileText, Loader2, Save, TrendingUp, Activity,
} from "lucide-react"

export default function MyProfilePage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/api/worker-profile/me'),
  })

  const { data: productivity } = useQuery<any>({
    queryKey: ['my-productivity'],
    queryFn: () => api.get('/api/worker-profile/me/productivity'),
    enabled: !!profile,
  })

  const { data: scans = [] } = useQuery<any[]>({
    queryKey: ['my-scans'],
    queryFn: () => api.get('/api/worker-profile/me/scans'),
    enabled: !!profile,
  })

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['my-documents', profile?.id],
    queryFn: () => api.get(`/api/worker-profile/${profile.id}/documents`),
    enabled: !!profile?.id,
  })

  if (profileLoading) return (
    <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
  )

  if (!profile) return (
    <div className="p-6">
      <Alert>
        <AlertDescription>
          Sizning userga worker biriktirilmagan. Admin bilan bog'laning.
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <Avatar className="h-24 w-24">
          {profile.photo_url && <AvatarImage src={profile.photo_url} />}
          <AvatarFallback className="text-2xl">
            {profile.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profile.full_name}</h1>
          <p className="text-muted-foreground">
            <span className="font-mono">{profile.employee_code}</span>
            {profile.position && <> · {profile.position}</>}
            {profile.default_stage_name && <> · {profile.default_stage_name}</>}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className={profile.is_active ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}>
              {profile.is_active ? 'Faol' : 'Nofaol'}
            </Badge>
            {profile.contract_type && <Badge variant="outline">{profile.contract_type}</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="scans">Mening ishlarim</TabsTrigger>
          <TabsTrigger value="documents">Hujjatlar</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm profile={profile} onSaved={() => qc.invalidateQueries({ queryKey: ['my-profile'] })} />
        </TabsContent>

        <TabsContent value="productivity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Bu oy
              </CardTitle>
              <CardDescription>
                Jami: <strong>{productivity?.total_quantity || 0}</strong> mahsulot,{' '}
                <strong>{productivity?.total_scans || 0}</strong> scan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!productivity?.items?.length ? (
                <div className="text-center py-8 text-muted-foreground">Bu oy ish yo'q</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bosqich</TableHead>
                      <TableHead className="text-right">Scans</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">O'rtacha vaqt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productivity.items.map((p: any) => (
                      <TableRow key={p.stage}>
                        <TableCell><Badge variant="outline">{p.stage_name}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{p.scans}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{p.total_quantity}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {Math.floor(p.avg_duration_seconds / 60)}m {p.avg_duration_seconds % 60}s
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scans">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Oxirgi 50 scan</CardTitle>
            </CardHeader>
            <CardContent>
              {!scans.length ? (
                <div className="text-center py-8 text-muted-foreground">Scan yo'q</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Zakaz</TableHead>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead>Bosqich</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Vaqt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-mono">
                          {new Date(s.start_scan_at).toLocaleString('uz-UZ', { hour12: false })}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{s.qr_code}</TableCell>
                        <TableCell className="text-xs font-mono">{s.order_code}</TableCell>
                        <TableCell className="text-xs">
                          {s.model_code} · {s.color_name} · {s.size_code}
                        </TableCell>
                        <TableCell><Badge variant="outline">{s.stage_name}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            s.status === 'finished' ? 'border-green-500 text-green-600' :
                            s.status === 'started'  ? 'border-amber-500 text-amber-600' :
                            'border-red-500 text-red-600'
                          }>{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {s.duration_seconds
                            ? `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Hujjatlar</CardTitle>
              <CardDescription>{documents.length} ta hujjat</CardDescription>
            </CardHeader>
            <CardContent>
              {!documents.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  Hujjat yo'q. Admin/HR sizning uchun yuklaydi.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Turi</TableHead>
                      <TableHead>Fayl</TableHead>
                      <TableHead>Berilgan</TableHead>
                      <TableHead>Muddati</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell><Badge variant="outline">{d.document_type}</Badge></TableCell>
                        <TableCell className="text-xs">{d.file_name}</TableCell>
                        <TableCell className="text-xs">{d.issued_date || '—'}</TableCell>
                        <TableCell className="text-xs">{d.expiry_date || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileForm({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    phone: profile.phone || '',
    address: profile.address || '',
    photo_url: profile.photo_url || '',
    emergency_contact: profile.emergency_contact || '',
  })

  const mut = useMutation({
    mutationFn: () => api.put(`/api/worker-profile/${profile.id}/profile`, form),
    onSuccess: () => { toast.success('Saqlandi'); onSaved() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shaxsiy ma'lumotlar</CardTitle>
        <CardDescription>Faqat siz o'zgartira oladigan maydonlar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label><Phone className="inline h-3 w-3" /> Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998..." />
          </div>
          <div>
            <Label><Phone className="inline h-3 w-3" /> Yaqin kishi</Label>
            <Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
              placeholder="+998..." />
          </div>
          <div className="md:col-span-2">
            <Label><MapPin className="inline h-3 w-3" /> Manzil</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Rasm URL</Label>
            <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="https://..." />
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-50/10 p-3 text-sm">
          <strong>Quyidagi maydonlar faqat admin tomonidan o'zgartiriladi:</strong>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
            <div>F.I.O.: <strong>{profile.full_name}</strong></div>
            <div>Lavozim: <strong>{profile.position || '—'}</strong></div>
            <div>Bosqich: <strong>{profile.default_stage_name || '—'}</strong></div>
            <div>Tug'ilgan: <strong>{profile.birth_date || '—'}</strong></div>
            <div>Pasport: <strong>{profile.passport_series} {profile.passport_number}</strong></div>
            <div>PINFL: <strong>{profile.pinfl || '—'}</strong></div>
            <div>Bank karta: <strong>{profile.bank_card || '—'}</strong></div>
            <div>Ishga kirgan: <strong>{profile.hired_at || '—'}</strong></div>
          </div>
        </div>

        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Saqlash
        </Button>
      </CardContent>
    </Card>
  )
}
