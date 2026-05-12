"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Label } from "@/components/ui/label"
import {
  QrCode,
  Scan,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  User,
  Clock,
  RefreshCw,
  Download,
  Camera,
  Search,
  History,
  Zap,
} from "lucide-react"
import { useScanLogs, useProductionStages } from "@/lib/api/hooks"

export default function ScanningPage() {
  const { data: scanLogs = [] } = useScanLogs()
  const { data: productionStages = [] } = useProductionStages()
  const [scanInput, setScanInput] = useState("")
  const [lastScan, setLastScan] = useState<{
    type: string
    value: string
    status: "success" | "warning" | "error"
    message: string
    details?: Record<string, string>
  } | null>(null)

  const handleScan = () => {
    if (!scanInput) return

    // Simulate scan result
    if (scanInput.startsWith("BOX-")) {
      setLastScan({
        type: "Box",
        value: scanInput,
        status: "success",
        message: "Box validated successfully",
        details: {
          "Order": "ORD-2024-001",
          "Model": "Summer Dress SD-401",
          "Quantity": "50 pcs",
          "Stage": "Packing",
          "Worker": "Aziza Karimova",
        },
      })
    } else if (scanInput.startsWith("W")) {
      setLastScan({
        type: "Worker",
        value: scanInput,
        status: "success",
        message: "Worker ID verified",
        details: {
          "Name": "Bobur Rahimov",
          "Department": "Cutting",
          "Line": "Line B",
          "Status": "Active",
          "Today's Scans": "45",
        },
      })
    } else {
      setLastScan({
        type: "Unknown",
        value: scanInput,
        status: "error",
        message: "Invalid QR code format",
      })
    }
    setScanInput("")
  }

  const successScans = scanLogs.filter((s) => s.status === "Success").length
  const warningScans = scanLogs.filter((s) => s.status === "Warning").length
  const errorScans = scanLogs.filter((s) => s.status === "Error").length

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QR Scanning</h1>
          <p className="text-muted-foreground">
            Scan boxes, worker IDs, and track production events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export Log
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scans Today</p>
                <p className="text-2xl font-bold">{scanLogs.length}</p>
              </div>
              <QrCode className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-500">{successScans}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">{warningScans}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">{errorScans}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner & Result */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" /> Scanner
            </CardTitle>
            <CardDescription>
              Scan QR codes or enter codes manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scan Box Visual */}
            <div className="relative aspect-square max-w-xs mx-auto rounded-2xl border-4 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
              <div className="absolute inset-4 border-2 border-primary rounded-xl animate-pulse" />
              <div className="text-center space-y-2">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Point camera at QR code
                </p>
              </div>
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
            </div>

            {/* Manual Input */}
            <div className="space-y-2">
              <Label>Manual Input</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code (e.g., BOX-2024-0542 or W001)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
                <Button onClick={handleScan}>
                  <Zap className="mr-2 h-4 w-4" /> Scan
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto py-4">
                <div className="text-center">
                  <Package className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-xs">Scan Box</span>
                </div>
              </Button>
              <Button variant="outline" className="h-auto py-4">
                <div className="text-center">
                  <User className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-xs">Scan Worker ID</span>
                </div>
              </Button>
            </div>

            {/* Stage Selection */}
            <div className="space-y-2">
              <Label>Production Stage</Label>
              <Select defaultValue="packing">
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {productionStages.map((stage) => (
                    <SelectItem key={stage.name} value={stage.name.toLowerCase()}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scan Result */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Scan Result
            </CardTitle>
            <CardDescription>
              Last scan information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastScan ? (
              <div className="space-y-6">
                {/* Status Banner */}
                <div
                  className={`p-4 rounded-lg border-2 ${
                    lastScan.status === "success"
                      ? "bg-green-500/10 border-green-500/30"
                      : lastScan.status === "warning"
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {lastScan.status === "success" && (
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    )}
                    {lastScan.status === "warning" && (
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    )}
                    {lastScan.status === "error" && (
                      <XCircle className="h-8 w-8 text-red-500" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${
                          lastScan.status === "success"
                            ? "text-green-500"
                            : lastScan.status === "warning"
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {lastScan.message}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {lastScan.type}: {lastScan.value}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                {lastScan.details && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Details</h4>
                    <div className="space-y-2">
                      {Object.entries(lastScan.details).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {lastScan.status === "success" && (
                    <>
                      <Button className="flex-1">Confirm & Save</Button>
                      <Button variant="outline" className="flex-1">
                        Print Label
                      </Button>
                    </>
                  )}
                  {lastScan.status === "warning" && (
                    <>
                      <Button variant="secondary" className="flex-1">
                        Override & Continue
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Review Issue
                      </Button>
                    </>
                  )}
                  {lastScan.status === "error" && (
                    <Button variant="outline" className="flex-1">
                      Report Problem
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  No scan yet. Scan a QR code to see results.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scan History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Scan History
            </CardTitle>
            <CardDescription>Recent scan activity</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search scans..." className="pl-9 w-64" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Box ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanLogs.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell className="font-mono text-sm">{scan.id}</TableCell>
                  <TableCell className="text-sm">{scan.timestamp}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {scan.workerName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{scan.workerName}</p>
                        <p className="text-xs text-muted-foreground">{scan.workerId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{scan.boxId}</TableCell>
                  <TableCell>{scan.orderId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{scan.stage}</Badge>
                  </TableCell>
                  <TableCell>{scan.quantity} pcs</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${
                        scan.status === "Success"
                          ? "border-green-500 text-green-500"
                          : scan.status === "Warning"
                          ? "border-yellow-500 text-yellow-500"
                          : "border-red-500 text-red-500"
                      }`}
                    >
                      {scan.status === "Success" && <CheckCircle className="h-3 w-3" />}
                      {scan.status === "Warning" && <AlertTriangle className="h-3 w-3" />}
                      {scan.status === "Error" && <XCircle className="h-3 w-3" />}
                      {scan.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {scan.warning || scan.error || "-"}
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
