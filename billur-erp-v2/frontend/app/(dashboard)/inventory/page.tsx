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
import { Label } from "@/components/ui/label"
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Download,
  Package,
  Warehouse,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  MapPin,
  RefreshCw,
  History,
} from "lucide-react"
import { useInventory } from "@/lib/api/hooks"

const movements = [
  { id: "MOV-001", item: "Cotton Fabric - White", type: "Incoming", quantity: 500, from: "Supplier", to: "Warehouse A", date: "2024-01-21 14:30", user: "Admin" },
  { id: "MOV-002", item: "Polyester Thread - Black", type: "Outgoing", quantity: 50, from: "Warehouse A", to: "Line B", date: "2024-01-21 12:15", user: "Line Supervisor" },
  { id: "MOV-003", item: "Metal Buttons - Silver", type: "Outgoing", quantity: 2000, from: "Warehouse B", to: "Line A", date: "2024-01-21 10:45", user: "Line Supervisor" },
  { id: "MOV-004", item: "Denim Fabric - Blue", type: "Transfer", quantity: 300, from: "Warehouse A", to: "Warehouse C", date: "2024-01-20 16:20", user: "Warehouse Mgr" },
  { id: "MOV-005", item: "Cardboard Boxes - Large", type: "Incoming", quantity: 200, from: "Supplier", to: "Warehouse C", date: "2024-01-20 14:00", user: "Admin" },
]

const statusColors: Record<string, string> = {
  "In Stock": "bg-green-500",
  "Low Stock": "bg-yellow-500",
  "Out of Stock": "bg-red-500",
  "Overstocked": "bg-blue-500",
}

export default function InventoryPage() {
  const { data: inventory = [] } = useInventory()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter
    const matchesWarehouse =
      warehouseFilter === "all" || item.warehouse === warehouseFilter
    return matchesSearch && matchesCategory && matchesWarehouse
  })

  const lowStockItems = inventory.filter((i) => i.status === "Low Stock").length
  const totalItems = inventory.length
  const categories = [...new Set(inventory.map((i) => i.category))]
  const warehouses = [...new Set(inventory.map((i) => i.warehouse))]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Manage warehouse stock and materials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Sync
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
                <DialogDescription>
                  Add a new item to the inventory
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input placeholder="e.g., Cotton Fabric - White" />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input placeholder="e.g., FAB-COT-WHT" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw Materials</SelectItem>
                        <SelectItem value="accessories">Accessories</SelectItem>
                        <SelectItem value="packaging">Packaging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Warehouse</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a">Warehouse A</SelectItem>
                        <SelectItem value="b">Warehouse B</SelectItem>
                        <SelectItem value="c">Warehouse C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Initial Quantity</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock</Label>
                    <Input type="number" placeholder="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Stock</Label>
                    <Input type="number" placeholder="1000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pieces">Pieces</SelectItem>
                        <SelectItem value="meters">Meters</SelectItem>
                        <SelectItem value="spools">Spools</SelectItem>
                        <SelectItem value="kg">Kilograms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input placeholder="e.g., A-12-3" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline">Cancel</Button>
                  <Button>Add Item</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-yellow-500">{lowStockItems}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Incoming</p>
                <p className="text-2xl font-bold text-green-500">+700</p>
              </div>
              <ArrowDownRight className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Outgoing</p>
                <p className="text-2xl font-bold text-blue-500">-2,050</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">
            <Package className="mr-2 h-4 w-4" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="movements">
            <History className="mr-2 h-4 w-4" /> Movements
          </TabsTrigger>
          <TabsTrigger value="warehouses">
            <Warehouse className="mr-2 h-4 w-4" /> Warehouses
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh} value={wh}>
                          {wh}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Table */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Items</CardTitle>
              <CardDescription>
                {filteredInventory.length} items found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Movement</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const stockPercent = (item.quantity / item.maxStock) * 100
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell>{item.warehouse}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {item.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{item.quantity.toLocaleString()}</span>
                              <span className="text-muted-foreground">
                                / {item.maxStock.toLocaleString()} {item.unit}
                              </span>
                            </div>
                            <Progress
                              value={stockPercent}
                              className={`h-2 ${
                                item.status === "Low Stock"
                                  ? "[&>div]:bg-yellow-500"
                                  : item.status === "Out of Stock"
                                  ? "[&>div]:bg-red-500"
                                  : ""
                              }`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <span className={`w-2 h-2 rounded-full ${statusColors[item.status]}`} />
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.lastMovement}
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
                                <Edit className="mr-2 h-4 w-4" /> Edit Item
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <ArrowDownRight className="mr-2 h-4 w-4" /> Add Stock
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <ArrowUpRight className="mr-2 h-4 w-4" /> Remove Stock
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <History className="mr-2 h-4 w-4" /> View History
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Stock Movements</CardTitle>
                <CardDescription>Recent inventory transactions</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Movement
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Stock Movement</DialogTitle>
                    <DialogDescription>
                      Record incoming, outgoing, or transfer movement
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Movement Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="incoming">Incoming</SelectItem>
                          <SelectItem value="outgoing">Outgoing</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Item</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" placeholder="Enter quantity" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>From</Label>
                        <Input placeholder="Source location" />
                      </div>
                      <div className="space-y-2">
                        <Label>To</Label>
                        <Input placeholder="Destination" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button>Record Movement</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-mono text-sm">{movement.id}</TableCell>
                      <TableCell className="font-medium">{movement.item}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            movement.type === "Incoming"
                              ? "border-green-500 text-green-500"
                              : movement.type === "Outgoing"
                              ? "border-blue-500 text-blue-500"
                              : "border-purple-500 text-purple-500"
                          }
                        >
                          {movement.type === "Incoming" && <ArrowDownRight className="mr-1 h-3 w-3" />}
                          {movement.type === "Outgoing" && <ArrowUpRight className="mr-1 h-3 w-3" />}
                          {movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.type === "Incoming" ? "+" : "-"}
                        {movement.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>{movement.from}</TableCell>
                      <TableCell>{movement.to}</TableCell>
                      <TableCell className="text-sm">{movement.date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{movement.user}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            {["Warehouse A", "Warehouse B", "Warehouse C"].map((warehouse, index) => {
              const warehouseItems = inventory.filter((i) => i.warehouse === warehouse)
              const totalStock = warehouseItems.reduce((sum, i) => sum + i.quantity, 0)
              const capacity = [30000, 50000, 15000][index]
              const utilization = (totalStock / capacity) * 100

              return (
                <Card key={warehouse}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5" />
                        {warehouse}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          utilization > 80
                            ? "border-yellow-500 text-yellow-500"
                            : "border-green-500 text-green-500"
                        }
                      >
                        {utilization.toFixed(0)}% Full
                      </Badge>
                    </div>
                    <CardDescription>
                      {warehouseItems.length} items stored
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Capacity</span>
                        <span>
                          {totalStock.toLocaleString()} / {capacity.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={utilization} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      {warehouseItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                        >
                          <span className="truncate flex-1">{item.name}</span>
                          <Badge
                            variant="outline"
                            className={`ml-2 ${
                              item.status === "Low Stock"
                                ? "border-yellow-500 text-yellow-500"
                                : ""
                            }`}
                          >
                            {item.quantity.toLocaleString()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full">
                      View All Items
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
