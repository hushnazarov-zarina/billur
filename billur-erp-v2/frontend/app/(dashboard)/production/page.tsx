"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Scissors,
  Printer,
  Shirt,
  CheckCircle,
  Wind,
  Tag,
  Package,
  Box,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  Target,
  RefreshCw,
} from "lucide-react"
import { useOrders, useWorkers, useProductionStages } from "@/lib/api/hooks"

const stageIcons: Record<string, React.ReactNode> = {
  Cutting: <Scissors className="h-5 w-5" />,
  Printing: <Printer className="h-5 w-5" />,
  Sewing: <Shirt className="h-5 w-5" />,
  Quality: <CheckCircle className="h-5 w-5" />,
  Ironing: <Wind className="h-5 w-5" />,
  Tagging: <Tag className="h-5 w-5" />,
  Packing: <Package className="h-5 w-5" />,
  Boxing: <Box className="h-5 w-5" />,
}

const stageColors: Record<string, string> = {
  Cutting: "from-blue-500 to-blue-600",
  Printing: "from-purple-500 to-purple-600",
  Sewing: "from-green-500 to-green-600",
  Quality: "from-yellow-500 to-yellow-600",
  Ironing: "from-orange-500 to-orange-600",
  Tagging: "from-pink-500 to-pink-600",
  Packing: "from-cyan-500 to-cyan-600",
  Boxing: "from-indigo-500 to-indigo-600",
}

export default function ProductionPage() {
  const { data: orders = [] } = useOrders()
  const { data: workers = [] } = useWorkers()
  const { data: productionStages = [] } = useProductionStages()
  const activeOrders = orders.filter(
    (o) => !["Pending", "Shipped"].includes(o.status)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production</h1>
          <p className="text-muted-foreground">
            Monitor and manage the production pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="today">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Output</p>
                <p className="text-2xl font-bold">21,850</p>
                <p className="text-xs text-green-500">+12% vs yesterday</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Lines</p>
                <p className="text-2xl font-bold">4 / 5</p>
                <p className="text-xs text-muted-foreground">Line D maintenance</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Workers Active</p>
                <p className="text-2xl font-bold">387</p>
                <p className="text-xs text-muted-foreground">25 on break</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                <p className="text-2xl font-bold">91.3%</p>
                <p className="text-xs text-green-500">Above target</p>
              </div>
              <Target className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Production Pipeline</CardTitle>
          <CardDescription>
            Real-time workflow status across all stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Pipeline Flow */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-muted -translate-y-1/2 z-0" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 relative z-10">
              {productionStages.map((stage, index) => (
                <div key={stage.name} className="relative">
                  <Card className="border-2 hover:shadow-lg transition-shadow">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stageColors[stage.name]} text-white flex items-center justify-center mb-3 mx-auto`}>
                        {stageIcons[stage.name]}
                      </div>
                      <h3 className="font-semibold text-center text-sm mb-2">
                        {stage.name}
                      </h3>
                      <div className="space-y-2">
                        <div className="text-center">
                          <span className="text-lg font-bold">{stage.count.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground"> / {stage.target.toLocaleString()}</span>
                        </div>
                        <Progress value={stage.efficiency} className="h-2" />
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-xs font-medium ${
                            stage.efficiency >= 95 ? "text-green-500" :
                            stage.efficiency >= 85 ? "text-yellow-500" :
                            "text-red-500"
                          }`}>
                            {stage.efficiency}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < productionStages.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-20">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Orders & Bottlenecks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Production Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Active Orders in Production</CardTitle>
            <CardDescription>Orders currently being processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{order.id}</span>
                      <Badge variant="outline">{order.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.client} • {order.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
               {order.quantity.toLocaleString()} pcs • {order.productionLine ?? "Line belgilanmagan"}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge
                      variant="secondary"
                      className={
                        order.status === "Packing"
                          ? "bg-green-500/10 text-green-500"
                          : order.status === "Quality Check"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-blue-500/10 text-blue-500"
                      }
                    >
                      {order.status}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Progress value={order.progress} className="w-20 h-2" />
                      <span className="text-xs font-medium">{order.progress}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottlenecks & Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Bottlenecks & Alerts
            </CardTitle>
            <CardDescription>Issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-500">Sewing Stage Delay</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Efficiency dropped to 80%. Line C experiencing machine issues.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="destructive">High Priority</Badge>
                      <span className="text-xs text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-500">Quality Queue Building</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      520 items waiting for inspection. Consider adding inspectors.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
                        Medium Priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">30 min ago</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-500">Material Shortage Warning</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      White cotton fabric stock at 40%. Reorder recommended.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-500">
                        Low Priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Production Lines Status</CardTitle>
          <CardDescription>Overview of all production lines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {["Line A", "Line B", "Line C", "Line D"].map((line, index) => {
              const isActive = index !== 3
              const efficiency = isActive ? [94, 97, 80, 0][index] : 0
              const assignedWorkers = isActive ? [42, 38, 45, 0][index] : 0
              
              return (
                <Card key={line} className={!isActive ? "opacity-60" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">{line}</h3>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Active" : "Maintenance"}
                      </Badge>
                    </div>
                    {isActive ? (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Efficiency</span>
                            <span className={`font-medium ${
                              efficiency >= 90 ? "text-green-500" :
                              efficiency >= 80 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {efficiency}%
                            </span>
                          </div>
                          <Progress value={efficiency} className="h-2" />
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Workers</span>
                            <span className="font-medium">{assignedWorkers}</span>
                          </div>
                          <div className="flex -space-x-2">
                            {workers.slice(0, 4).map((worker, i) => (
                              <Avatar key={i} className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={worker.photo} />
                                <AvatarFallback className="text-xs">
                                  {worker.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {assignedWorkers > 4 && (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                                +{assignedWorkers - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center text-muted-foreground">
                        <p className="text-sm">Scheduled maintenance</p>
                        <p className="text-xs mt-1">Resume: Tomorrow 8:00 AM</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
