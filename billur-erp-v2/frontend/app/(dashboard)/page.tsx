"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ShoppingCart,
  Factory,
  AlertTriangle,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  ArrowRight,
  Boxes,
} from "lucide-react"
import {
  productionChartData,
  qualityChartData,
} from "@/lib/data"
import { useDashboardStats, useOrders, useProductionStages } from "@/lib/api/hooks"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts"
import Link from "next/link"

export default function DashboardPage() {
  const { data: dashboardStats = { activeOrders: 0, todayProduction: 0, defectRate: 0, activeWorkers: 0, packedBoxes: 0, delayedOrders: 0, warehouseStock: 0, surplusCount: 0 } } = useDashboardStats()
  const { data: orders = [] } = useOrders()
  const { data: productionStages = [] } = useProductionStages()
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of your textile manufacturing operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.activeOrders}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              <span className="text-green-500">+12%</span>
              <span className="ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Production</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.todayProduction.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              <span className="text-green-500">+8%</span>
              <span className="ml-1">vs target</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Defect Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.defectRate}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
              <span className="text-green-500">-0.5%</span>
              <span className="ml-1">improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.activeWorkers}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>of 412 total</span>
              <span className="ml-1 text-green-500">(94%)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Packed Boxes</p>
                <p className="text-2xl font-bold">{dashboardStats.packedBoxes}</p>
              </div>
              <Boxes className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delayed Orders</p>
                <p className="text-2xl font-bold">{dashboardStats.delayedOrders}</p>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warehouse Stock</p>
                <p className="text-2xl font-bold">{dashboardStats.warehouseStock}%</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Surplus Items</p>
                <p className="text-2xl font-bold">{dashboardStats.surplusCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Pipeline & Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Production Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Production Pipeline</CardTitle>
            <CardDescription>Real-time stage progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {productionStages.map((stage) => (
              <div key={stage.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.count.toLocaleString()} / {stage.target.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={stage.efficiency} className="flex-1" />
                  <span className="text-xs font-medium w-10">{stage.efficiency}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Production Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Production</CardTitle>
            <CardDescription>Pieces processed by stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cutting"
                    stackId="1"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="sewing"
                    stackId="1"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="packing"
                    stackId="1"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders & Quality */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest order updates</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{order.id}</span>
                      <Badge
                        variant={
                          order.priority === "Urgent"
                            ? "destructive"
                            : order.priority === "High"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {order.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.client} • {order.model}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        order.status === "Packing"
                          ? "border-green-500 text-green-500"
                          : order.status === "Quality Check"
                          ? "border-yellow-500 text-yellow-500"
                          : "border-blue-500 text-blue-500"
                      }
                    >
                      {order.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.progress}% complete
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quality Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Overview</CardTitle>
            <CardDescription>Weekly inspection results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="passed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/orders">
                <ShoppingCart className="mr-2 h-4 w-4" /> New Order
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/scanning">
                <Package className="mr-2 h-4 w-4" /> Scan Box
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/workers">
                <Users className="mr-2 h-4 w-4" /> Add Worker
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/reports">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Generate Report
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-500">Low Stock Alert</p>
                  <p className="text-sm text-muted-foreground">
                    Polyester Thread (Black) below minimum threshold
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-500">Deadline Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Order ORD-2024-005 deadline approaching (Feb 10)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Factory className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-500">Bottleneck Detected</p>
                  <p className="text-sm text-muted-foreground">
                    Sewing stage at 80% efficiency - below target
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
