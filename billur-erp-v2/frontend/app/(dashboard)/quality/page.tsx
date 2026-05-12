"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import { useQualityDefects, useOrders, useWorkers } from "@/lib/api/hooks"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts"

const inspectionQueue = [
  { id: "INS-001", orderId: "ORD-2024-001", model: "Summer Dress SD-401", quantity: 120, inspector: "Dilnoza M.", priority: "High", waitTime: "15 min" },
  { id: "INS-002", orderId: "ORD-2024-003", model: "Wool Blazer WB-105", quantity: 85, inspector: "Unassigned", priority: "Urgent", waitTime: "32 min" },
  { id: "INS-003", orderId: "ORD-2024-002", model: "Basic Tee BT-220", quantity: 200, inspector: "Dilnoza M.", priority: "Medium", waitTime: "8 min" },
]

const recentInspections = [
  { id: "QC-001", orderId: "ORD-2024-001", batch: "B-542", passed: 118, failed: 2, defects: ["Stitching Error"], inspector: "Dilnoza M.", time: "14:25" },
  { id: "QC-002", orderId: "ORD-2024-003", batch: "B-541", passed: 78, failed: 7, defects: ["Color Mismatch", "Size Deviation"], inspector: "Dilnoza M.", time: "13:50" },
  { id: "QC-003", orderId: "ORD-2024-005", batch: "B-540", passed: 95, failed: 5, defects: ["Button Missing"], inspector: "Aziz K.", time: "12:30" },
  { id: "QC-004", orderId: "ORD-2024-002", batch: "B-539", passed: 198, failed: 2, defects: ["Fabric Tear"], inspector: "Dilnoza M.", time: "11:15" },
]

const defectTrendData = [
  { date: "Jan 15", rate: 2.8 },
  { date: "Jan 16", rate: 2.5 },
  { date: "Jan 17", rate: 3.1 },
  { date: "Jan 18", rate: 2.2 },
  { date: "Jan 19", rate: 2.0 },
  { date: "Jan 20", rate: 2.4 },
  { date: "Jan 21", rate: 2.3 },
]

const defectColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
]

export default function QualityPage() {
  const { data: qualityDefects = [] } = useQualityDefects()
  const { data: orders = [] } = useOrders()
  const { data: workers = [] } = useWorkers()
  const totalInspected = recentInspections.reduce((sum, i) => sum + i.passed + i.failed, 0)
  const totalPassed = recentInspections.reduce((sum, i) => sum + i.passed, 0)
  const totalFailed = recentInspections.reduce((sum, i) => sum + i.failed, 0)
  const passRate = ((totalPassed / totalInspected) * 100).toFixed(1)

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Control</h1>
          <p className="text-muted-foreground">
            Monitor and manage product quality inspections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button>
            <ClipboardCheck className="mr-2 h-4 w-4" /> New Inspection
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-2xl font-bold text-green-500">{passRate}%</p>
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +0.5% vs yesterday
                </p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inspected Today</p>
                <p className="text-2xl font-bold">{totalInspected}</p>
                <p className="text-xs text-muted-foreground">items</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-500">{totalFailed}</p>
                <p className="text-xs text-muted-foreground">items</p>
              </div>
              <ThumbsDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue Length</p>
                <p className="text-2xl font-bold">{inspectionQueue.length}</p>
                <p className="text-xs text-yellow-500">1 urgent</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Defect Types */}
        <Card>
          <CardHeader>
            <CardTitle>Defect Categories</CardTitle>
            <CardDescription>Distribution by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualityDefects}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="type"
                  >
                    {qualityDefects.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={defectColors[index % defectColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Defect Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Defect Rate Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={defectTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 5]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, "Defect Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--chart-5))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-5))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">
            Inspection Queue
            <Badge variant="secondary" className="ml-2">
              {inspectionQueue.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="recent">Recent Inspections</TabsTrigger>
          <TabsTrigger value="defects">Defect Analysis</TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Inspection Queue</CardTitle>
              <CardDescription>Items waiting for quality check</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Wait Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspectionQueue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.id}</TableCell>
                      <TableCell className="font-medium">{item.orderId}</TableCell>
                      <TableCell>{item.model}</TableCell>
                      <TableCell>{item.quantity} pcs</TableCell>
                      <TableCell>
                        {item.inspector === "Unassigned" ? (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                            Unassigned
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {item.inspector.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{item.inspector}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.priority === "Urgent"
                              ? "destructive"
                              : item.priority === "High"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            parseInt(item.waitTime) > 20
                              ? "text-red-500"
                              : parseInt(item.waitTime) > 10
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          }
                        >
                          {item.waitTime}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm">Start Inspection</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Tab */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Inspections</CardTitle>
              <CardDescription>Today&apos;s completed inspections</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Passed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Defects</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInspections.map((inspection) => {
                    const total = inspection.passed + inspection.failed
                    const rate = ((inspection.passed / total) * 100).toFixed(1)
                    return (
                      <TableRow key={inspection.id}>
                        <TableCell className="font-mono">{inspection.id}</TableCell>
                        <TableCell className="font-medium">{inspection.orderId}</TableCell>
                        <TableCell>{inspection.batch}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle className="h-4 w-4" />
                            {inspection.passed}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="h-4 w-4" />
                            {inspection.failed}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={parseFloat(rate)}
                              className="w-16 h-2"
                            />
                            <span className="text-sm font-medium">{rate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {inspection.defects.map((defect) => (
                              <Badge key={defect} variant="outline" className="text-xs">
                                {defect}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {inspection.inspector.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{inspection.inspector}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inspection.time}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Defect Types Breakdown</CardTitle>
                <CardDescription>By severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {qualityDefects.map((defect, index) => (
                    <div
                      key={defect.type}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: defectColors[index] }}
                        />
                        <div>
                          <p className="font-medium">{defect.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {defect.count} occurrences
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          defect.severity === "Critical"
                            ? "destructive"
                            : defect.severity === "Major"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {defect.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Defects by Production Line</CardTitle>
                <CardDescription>Today&apos;s distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { line: "Line A", defects: 12 },
                        { line: "Line B", defects: 8 },
                        { line: "Line C", defects: 18 },
                        { line: "Line D", defects: 5 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="line" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="defects"
                        fill="hsl(var(--chart-5))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
