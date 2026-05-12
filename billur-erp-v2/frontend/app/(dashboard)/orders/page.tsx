"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Calendar,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { useOrders } from "@/lib/api/hooks"
import { Label } from "@/components/ui/label"

const statusColors: Record<string, string> = {
  "Pending": "bg-gray-500",
  "Cutting": "bg-blue-500",
  "Printing": "bg-purple-500",
  "In Production": "bg-indigo-500",
  "Quality Check": "bg-yellow-500",
  "Packing": "bg-green-500",
  "Shipped": "bg-emerald-500",
}

const priorityColors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  "Urgent": "destructive",
  "High": "default",
  "Medium": "secondary",
  "Low": "outline",
}

export default function OrdersPage() {
  const { data: orders = [] } = useOrders()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.model.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const spekaOrders = filteredOrders.filter((o) => o.type === "Speka")
  const setOrders = filteredOrders.filter((o) => o.type === "SET")
  const standardOrders = filteredOrders.filter((o) => o.type === "Standard")

  const OrderTable = ({ data }: { data: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Color</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
              No orders found
            </TableCell>
          </TableRow>
        ) : (
          data.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.id}</TableCell>
              <TableCell>{order.client}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{order.model}</p>
                  <p className="text-xs text-muted-foreground">{order.sizeRange}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{
                      backgroundColor:
                        order.colorName === "Ocean Blue"
                          ? "#0077b6"
                          : order.colorName === "Pure White"
                          ? "#ffffff"
                          : order.colorName === "Midnight Black"
                          ? "#1a1a1a"
                          : order.colorName === "Classic Denim"
                          ? "#3b5998"
                          : order.colorName === "Storm Grey"
                          ? "#708090"
                          : "#001f3f",
                    }}
                  />
                  <span className="text-sm">{order.colorCode}</span>
                </div>
              </TableCell>
              <TableCell>{order.quantity.toLocaleString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm">{order.deadline}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  <span className={`w-2 h-2 rounded-full ${statusColors[order.status]}`} />
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 min-w-[100px]">
                  <Progress value={order.progress} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-8">{order.progress}%</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={priorityColors[order.priority]}>{order.priority}</Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" /> Edit Order
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Package className="mr-2 h-4 w-4" /> Track Progress
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Cancel Order
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track all production orders
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
              <DialogDescription>
                Add a new production order to the system
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speka">Speka</SelectItem>
                      <SelectItem value="set">SET</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zara">Zara Europe</SelectItem>
                      <SelectItem value="hm">H&M Nordic</SelectItem>
                      <SelectItem value="mango">Mango Spain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input placeholder="e.g., Summer Dress SD-401" />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="5000" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Color Code</Label>
                  <Input placeholder="BLU-042" />
                </div>
                <div className="space-y-2">
                  <Label>Size Range</Label>
                  <Input placeholder="XS-XL" />
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Production Line</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select line" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a">Line A</SelectItem>
                      <SelectItem value="b">Line B</SelectItem>
                      <SelectItem value="c">Line C</SelectItem>
                      <SelectItem value="d">Line D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline">Cancel</Button>
                <Button>Create Order</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => !["Pending", "Shipped"].includes(o.status)).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => o.progress === 100).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => o.priority === "Urgent").length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Cutting">Cutting</SelectItem>
                  <SelectItem value="Printing">Printing</SelectItem>
                  <SelectItem value="In Production">In Production</SelectItem>
                  <SelectItem value="Quality Check">Quality Check</SelectItem>
                  <SelectItem value="Packing">Packing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All Orders
            <Badge variant="secondary" className="ml-2">
              {filteredOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="speka">
            Speka
            <Badge variant="secondary" className="ml-2">
              {spekaOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="set">
            SET
            <Badge variant="secondary" className="ml-2">
              {setOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="standard">
            Standard
            <Badge variant="secondary" className="ml-2">
              {standardOrders.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>Complete list of all production orders</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable data={filteredOrders} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="speka">
          <Card>
            <CardHeader>
              <CardTitle>Speka Orders</CardTitle>
              <CardDescription>Special specification orders</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable data={spekaOrders} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="set">
          <Card>
            <CardHeader>
              <CardTitle>SET Orders</CardTitle>
              <CardDescription>Set-based production orders</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable data={setOrders} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standard">
          <Card>
            <CardHeader>
              <CardTitle>Standard Orders</CardTitle>
              <CardDescription>Regular production orders</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable data={standardOrders} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
