"use client"

import { useState } from "react"
import Link from "next/link"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  Wallet,
  FileText,
  QrCode,
  Upload,
} from "lucide-react"
import { departments, productionLines, positions } from "@/lib/data"
import { useWorkers } from "@/lib/api/hooks"

const statusColors: Record<string, string> = {
  Active: "bg-green-500",
  "On Leave": "bg-yellow-500",
  Inactive: "bg-gray-500",
  Terminated: "bg-red-500",
}

export default function WorkersPage() {
  const { data: workers = [] } = useWorkers()
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.phone.includes(searchQuery)
    const matchesDepartment =
      departmentFilter === "all" || worker.department === departmentFilter
    const matchesStatus = statusFilter === "all" || worker.status === statusFilter
    return matchesSearch && matchesDepartment && matchesStatus
  })

  const activeWorkers = workers.filter((w) => w.status === "Active").length
  const onLeaveWorkers = workers.filter((w) => w.status === "On Leave").length

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workers</h1>
          <p className="text-muted-foreground">
            Manage your workforce of {workers.length} employees
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Worker</DialogTitle>
              <DialogDescription>
                Register a new employee in the system
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="personal" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="salary">Salary</TabsTrigger>
              </TabsList>
              
              <TabsContent value="personal" className="space-y-4 mt-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback>
                        <Users className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <p className="font-medium">Employee Photo</p>
                    <p className="text-sm text-muted-foreground">
                      Upload a clear photo for ID card
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input placeholder="Enter full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input placeholder="+998 90 123 4567" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Birth Date *</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address *</Label>
                  <Input placeholder="Full address" />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact</Label>
                  <Input placeholder="+998 90 987 6543" />
                </div>
              </TabsContent>

              <TabsContent value="employment" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ID *</Label>
                    <Input placeholder="Auto-generated" disabled value="W007" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hire Date *</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept.toLowerCase()}>
                            {dept}
                          </SelectItem>
                        ))}
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
                        {productionLines.map((line) => (
                          <SelectItem key={line} value={line.toLowerCase()}>
                            {line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Position *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((pos) => (
                          <SelectItem key={pos} value={pos.toLowerCase()}>
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Skill Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contract Type *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Passport Series</Label>
                    <Input placeholder="AA" maxLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passport Number</Label>
                    <Input placeholder="1234567" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Issued By</Label>
                  <Input placeholder="IIV Toshkent" />
                </div>
                <div className="space-y-2">
                  <Label>PINFL (Personal ID Number)</Label>
                  <Input placeholder="14 digit number" maxLength={14} />
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Upload Documents</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {["Passport Scan", "ID Card", "Medical Certificate", "Bank Card"].map(
                      (doc) => (
                        <div
                          key={doc}
                          className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary cursor-pointer transition-colors"
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">{doc}</p>
                          <p className="text-xs text-muted-foreground">
                            Click to upload
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="salary" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Salary Type *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select salary type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Salary</SelectItem>
                      <SelectItem value="piece-rate">Piece-rate</SelectItem>
                      <SelectItem value="mixed">Mixed (Base + Piece-rate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Base Salary (UZS)</Label>
                    <Input type="number" placeholder="2,500,000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Piece Rate (UZS per item)</Label>
                    <Input type="number" placeholder="1,500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bank Card Number</Label>
                  <Input placeholder="8600 1234 5678 9012" />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline">Cancel</Button>
              <Button>Add Worker</Button>
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
                <p className="text-sm text-muted-foreground">Total Workers</p>
                <p className="text-2xl font-bold">{workers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Today</p>
                <p className="text-2xl font-bold">{activeWorkers}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <p className="text-2xl font-bold">{onLeaveWorkers}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                <p className="text-2xl font-bold">
                  {Math.round(
                    workers.reduce((sum, w) => sum + w.efficiency, 0) / workers.length
                  )}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
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
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
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

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Workers</CardTitle>
          <CardDescription>
            {filteredWorkers.length} workers found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Salary Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={worker.photo} />
                        <AvatarFallback>
                          {worker.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{worker.name}</p>
                        <p className="text-sm text-muted-foreground">{worker.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{worker.id}</TableCell>
                  <TableCell>{worker.department}</TableCell>
                  <TableCell>{worker.position}</TableCell>
                  <TableCell>{worker.productionLine}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={worker.efficiency} className="w-16 h-2" />
                      <span className={`text-sm font-medium ${
                        worker.efficiency >= 95 ? "text-green-500" :
                        worker.efficiency >= 85 ? "text-yellow-500" :
                        "text-red-500"
                      }`}>
                        {worker.efficiency}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <span className={`w-2 h-2 rounded-full ${statusColors[worker.status]}`} />
                      {worker.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{worker.salaryType}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/workers/${worker.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" /> Edit Worker
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Wallet className="mr-2 h-4 w-4" /> Salary History
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="mr-2 h-4 w-4" /> Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <QrCode className="mr-2 h-4 w-4" /> Print ID Card
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <UserX className="mr-2 h-4 w-4" /> Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
