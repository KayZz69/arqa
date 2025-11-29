import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Download, FileText, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";

interface DailyReport {
  id: string;
  report_date: string;
  barista_id: string;
  is_locked: boolean;
  submitted_at: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
}

export default function ManagerReports() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedBarista, setSelectedBarista] = useState<string>("all");

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      navigate("/");
      return;
    }

    fetchData();
  }, [roleLoading, role, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all reports
      let query = supabase
        .from("daily_reports")
        .select("*")
        .order("report_date", { ascending: false });

      // Apply date filters
      if (startDate) {
        query = query.gte("report_date", startDate);
      }
      if (endDate) {
        query = query.lte("report_date", endDate);
      }

      // Apply barista filter
      if (selectedBarista !== "all") {
        query = query.eq("barista_id", selectedBarista);
      }

      const { data: reportsData, error: reportsError } = await query;
      if (reportsError) throw reportsError;

      setReports(reportsData || []);

      // Fetch unique baristas from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "barista");

      if (rolesError) throw rolesError;

      // Get user emails for baristas
      const baristaIds = [...new Set(rolesData?.map((r) => r.user_id) || [])];
      const usersData: User[] = [];

      for (const id of baristaIds) {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(id);
        if (!userError && userData.user) {
          usersData.push({ id: userData.user.id, email: userData.user.email || "Unknown" });
        }
      }

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (reportId: string, currentLockStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("daily_reports")
        .update({ is_locked: !currentLockStatus })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Report ${!currentLockStatus ? "locked" : "unlocked"} successfully`,
      });

      fetchData();
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({
        title: "Error",
        description: "Failed to update report",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      // Fetch detailed report data with items
      const reportIds = reports.map((r) => r.id);
      
      const { data: reportItems, error } = await supabase
        .from("report_items")
        .select(`
          *,
          positions (name, category, unit),
          report:daily_reports (report_date, barista_id)
        `)
        .in("report_id", reportIds);

      if (error) throw error;

      // Build CSV
      const csvRows = [
        ["Date", "Barista", "Category", "Position", "Ending Stock", "Write-off", "Unit"]
      ];

      for (const item of reportItems || []) {
        const report = reports.find((r) => r.id === item.report_id);
        const user = users.find((u) => u.id === report?.barista_id);
        
        csvRows.push([
          report ? format(new Date(report.report_date), "yyyy-MM-dd") : "",
          user?.email || "Unknown",
          item.positions?.category || "",
          item.positions?.name || "",
          item.ending_stock?.toString() || "0",
          item.write_off?.toString() || "0",
          item.positions?.unit || ""
        ]);
      }

      const csvContent = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `daily-reports-${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "Reports exported to CSV",
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export reports",
        variant: "destructive",
      });
    }
  };

  const getUserEmail = (userId: string): string => {
    return users.find((u) => u.id === userId)?.email || "Unknown";
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Daily Reports Dashboard
            </h1>
            <p className="text-muted-foreground">
              View and manage all barista reports
            </p>
          </div>
          <Button onClick={handleExportCSV} disabled={reports.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter reports by date range and barista</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barista">Barista</Label>
                <Select value={selectedBarista} onValueChange={setSelectedBarista}>
                  <SelectTrigger id="barista">
                    <SelectValue placeholder="All baristas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All baristas</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchData} className="w-full">
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reports ({reports.length})</CardTitle>
            <CardDescription>
              All submitted daily reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Barista</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No reports found
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {format(new Date(report.report_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell>{getUserEmail(report.barista_id)}</TableCell>
                        <TableCell>
                          {format(new Date(report.submitted_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={report.is_locked ? "secondary" : "default"}>
                            {report.is_locked ? "Locked" : "Unlocked"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleLock(report.id, report.is_locked)}
                          >
                            {report.is_locked ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
