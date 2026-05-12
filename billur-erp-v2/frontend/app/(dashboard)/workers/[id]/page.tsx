"use client"

import { use } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Edit,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Shield,
  CreditCard,
  FileText,
  Download,
  Eye,
  Trash2,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
  QrCode,
  Printer,
  MoreHorizontal,
} from "lucide-react"
import { workerDocuments } from "@/lib/data"
import { useWorkers } from "@/lib/api/hooks"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

// Performance data for charts
const performanceData = [
  { day: "Mon", pieces: 245 },
  { day: "Tue", pieces: 267 },
  { day: "Wed", pieces: 289 },
  { day: "Thu", pieces: 254 },
  { day: "Fri", pieces: 278 },
  { day: "Sat", pieces: 198 },
]

const salaryHistory = [
  { month: "Aug", amount: 3850000 },
  { month: "Sep", amount: 4120000 },
  { month: "Oct", amount: 3980000 },
  { month: "Nov", amount: 4250000 },
  { month: "Dec", amount: 4450000 },
  { month: "Jan", amount: 4250000 },
]

const recentScans = [
  { date: "2024-01-21 14:32:15", box: "BOX-2024-0542", stage: "Packing", qty: 50 },
  { date: "2024-01-21 12:15:42", box: "BOX-2024-0538", stage: "Packing", qty: 48 },
  { date: "2024-01-21 10:08:33", box: "BOX-2024-0535", stage: "Packing", qty: 52 },
  { date: "2024-01-20 16:45:21", box: "BOX-2024-0529", stage: "Packing", qty: 50 },
  { date: "2024-01-20 14:22:18", box: "BOX-2024-0525", stage: "Packing", qty: 47 },
]

export default function WorkerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: workers = [] } = useWorkers()
  const worker = workers.find((w) => w.id === id) || workers[0]
  if (!worker) return <div className="p-6">Yuklanmoqda...</div>

  const documentStatusColors: Record<string, string> = {
    Verified: "bg-green-500",
    "Expiring Soon": "bg-yellow-500",
    Pending: "bg-orange-500",
    Expired: "bg-red-500",
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Worker Profile</h1>
          <p className="text-muted-foreground">
            View and manage worker information
          </p>
        </div>
        <Button variant="outline">
          <QrCode className="mr-2 h-4 w-4" /> Print ID Card
        </Button>
        <Button variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
        <Button>
          <Edit className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Photo & Basic Info */}
            <div className="flex items-start gap-6">
              <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                <AvatarImage src={worker.photo} />
                <AvatarFallback className="text-3xl">
                  {worker.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{worker.name}</h2>
                  <Badge variant="outline" className="gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      worker.status === "Active" ? "bg-green-500" : "bg-yellow-500"
                    }`} />
                    {worker.status}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground font-mono">{worker.id}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{worker.department}</Badge>
                  <Badge variant="secondary">{worker.position}</Badge>
                  <Badge variant="outline">{worker.productionLine}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {worker.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {worker.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 md:ml-auto">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-green-500">{worker.efficiency}%</p>
                <p className="text-xs text-muted-foreground">Efficiency</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <Target className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-blue-500">{worker.piecesCompleted.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Pieces This Month</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold text-yellow-500">{worker.defectRate}%</p>
                <p className="text-xs text-muted-foreground">Defect Rate</p>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-purple-500">{worker.attendance}%</p>
                <p className="text-xs text-muted-foreground">Attendance</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="salary">Salary & Payroll</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Birth Date</p>
                    <p className="font-medium">{worker.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium">{worker.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hire Date</p>
                    <p className="font-medium">{worker.hireDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Type</p>
                    <p className="font-medium">{worker.contractType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Skill Category</p>
                    <Badge variant="secondary">{worker.skillCategory}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{worker.emergencyContact}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ID & Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> ID & Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Passport</p>
                    <p className="font-medium font-mono">{worker.passportSeries} {worker.passportNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issued By</p>
                    <p className="font-medium">{worker.passportIssuedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Date</p>
                    <p className="font-medium">{worker.passportIssueDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expiry Date</p>
                    <p className="font-medium">{worker.passportExpiryDate}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">PINFL</p>
                    <p className="font-medium font-mono">{worker.pinfl}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Performance</CardTitle>
              <CardDescription>Pieces completed this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="pieces" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Scans</CardTitle>
              <CardDescription>Latest production activity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Box ID</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentScans.map((scan, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{scan.date}</TableCell>
                      <TableCell className="font-mono">{scan.box}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{scan.stage}</Badge>
                      </TableCell>
                      <TableCell>{scan.qty} pcs</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary" className="space-y-6">
          {/* Salary Breakdown */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" /> Current Month Salary
                </CardTitle>
                <CardDescription>January 2024 breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Base Salary</span>
                      <span className="font-medium">{worker.baseSalary.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Pieces Completed</span>
                      <span className="font-medium">{worker.piecesCompleted.toLocaleString()} pcs</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Rate per Piece</span>
                      <span className="font-medium">{worker.pieceRate.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-muted-foreground">Piece-rate Earnings</span>
                      <span className="font-medium text-blue-500">
                        {(worker.piecesCompleted * worker.pieceRate).toLocaleString()} UZS
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="text-muted-foreground">Bonuses</span>
                      <span className="font-medium text-green-500">+{worker.bonuses.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <span className="text-muted-foreground">Penalties</span>
                      <span className="font-medium text-red-500">-{worker.penalties.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <span className="text-muted-foreground">Advances</span>
                      <span className="font-medium text-orange-500">-{worker.advances.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Deductions</span>
                      <span className="font-medium">-{worker.deductions.toLocaleString()} UZS</span>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-lg font-medium">Final Payable</span>
                  <span className="text-2xl font-bold text-primary">
                    {worker.finalPayable.toLocaleString()} UZS
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Bank & Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Payment Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Salary Type</p>
                  <Badge className="mt-1">{worker.salaryType}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Card</p>
                  <p className="font-mono font-medium">{worker.bankCard}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned (Year)</p>
                  <p className="text-xl font-bold">{worker.totalEarned.toLocaleString()} UZS</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge variant="outline" className="mt-1 gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Pending
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Salary History */}
          <Card>
            <CardHeader>
              <CardTitle>Salary History</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salaryHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} UZS`, "Salary"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-1))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workerDocuments.map((doc, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.type}</p>
                        <Badge
                          variant="outline"
                          className={`mt-1 gap-1 ${
                            doc.status === "Verified" ? "border-green-500 text-green-500" :
                            doc.status === "Expiring Soon" ? "border-yellow-500 text-yellow-500" :
                            "border-orange-500 text-orange-500"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${documentStatusColors[doc.status]}`} />
                          {doc.status}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {doc.uploadDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uploaded</span>
                        <span>{doc.uploadDate}</span>
                      </div>
                    )}
                    {doc.expiryDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span className={doc.status === "Expiring Soon" ? "text-yellow-500" : ""}>
                          {doc.expiryDate}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="mr-1 h-3 w-3" /> Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Upload New Document */}
            <Card className="border-dashed">
              <CardContent className="pt-6 flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">Upload New Document</p>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Drag and drop or click to browse
                </p>
                <Button variant="outline" className="mt-4">
                  Select File
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Recent actions and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { time: "Today 14:32", action: "Scanned box BOX-2024-0542", type: "scan", detail: "Packing stage - 50 pieces" },
                  { time: "Today 12:15", action: "Scanned box BOX-2024-0538", type: "scan", detail: "Packing stage - 48 pieces" },
                  { time: "Today 08:00", action: "Clocked in", type: "attendance", detail: "Shift started" },
                  { time: "Yesterday 17:30", action: "Clocked out", type: "attendance", detail: "Shift ended" },
                  { time: "Yesterday 16:45", action: "Received bonus", type: "salary", detail: "+50,000 UZS for exceeding target" },
                  { time: "Jan 18, 2024", action: "Medical certificate uploaded", type: "document", detail: "Valid until Feb 20, 2024" },
                  { time: "Jan 15, 2024", action: "Advance payment", type: "salary", detail: "500,000 UZS advance received" },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === "scan" ? "bg-blue-500/10" :
                      item.type === "attendance" ? "bg-green-500/10" :
                      item.type === "salary" ? "bg-purple-500/10" :
                      "bg-orange-500/10"
                    }`}>
                      {item.type === "scan" && <QrCode className="h-5 w-5 text-blue-500" />}
                      {item.type === "attendance" && <Clock className="h-5 w-5 text-green-500" />}
                      {item.type === "salary" && <Wallet className="h-5 w-5 text-purple-500" />}
                      {item.type === "document" && <FileText className="h-5 w-5 text-orange-500" />}
                    </div>
                    <div className="flex-1 pb-6 border-l border-muted pl-4 -ml-5 relative">
                      <div className="absolute left-0 top-4 w-2 h-2 rounded-full bg-muted -translate-x-[5px]" />
                      <p className="text-sm text-muted-foreground">{item.time}</p>
                      <p className="font-medium mt-1">{item.action}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
