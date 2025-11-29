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
import { ArrowLeft, Download, FileText, Lock, Unlock, Edit, Trash2 } from "lucide-react";
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
        title: "Ошибка",
        description: "Не удалось загрузить отчёты",
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
        title: "Успешно",
        description: `Отчёт ${!currentLockStatus ? "заблокирован" : "разблокирован"} успешно`,
      });

      fetchData();
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить отчёт",
        variant: "destructive",
      });
    }
  };

  const handleEditReport = (reportId: string, reportDate: string) => {
    navigate(`/daily-report?date=${reportDate}`);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот отчёт? Это удалит все элементы в отчёте.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("daily_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Отчёт успешно удалён",
      });

      fetchData();
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить отчёт",
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
        ["Дата", "Бариста", "Категория", "Позиция", "Остаток", "Списание", "Единица"]
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
        title: "Успешно",
        description: "Отчёты экспортированы в CSV",
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось экспортировать отчёты",
        variant: "destructive",
      });
    }
  };

  const getUserEmail = (userId: string): string => {
    return users.find((u) => u.id === userId)?.email || "Неизвестно";
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
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
              Панель отчётов
            </h1>
            <p className="text-muted-foreground">
              Просмотр и управление всеми отчётами бариста
            </p>
          </div>
          <Button onClick={handleExportCSV} disabled={reports.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Экспорт в CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Фильтры</CardTitle>
            <CardDescription>Фильтрация отчётов по диапазону дат и бариста</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Дата начала</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Дата окончания</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barista">Бариста</Label>
                <Select value={selectedBarista} onValueChange={setSelectedBarista}>
                  <SelectTrigger id="barista">
                    <SelectValue placeholder="Все бариста" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все бариста</SelectItem>
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
                  Применить фильтры
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Отчёты ({reports.length})</CardTitle>
            <CardDescription>
              Все отправленные ежедневные отчёты
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Бариста</TableHead>
                    <TableHead>Отправлено</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Отчёты не найдены
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
                            {report.is_locked ? "Заблокирован" : "Разблокирован"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditReport(report.id, report.report_date)}
                              title="Редактировать отчёт"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleLock(report.id, report.is_locked)}
                              title={report.is_locked ? "Разблокировать" : "Заблокировать"}
                            >
                              {report.is_locked ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteReport(report.id)}
                              className="text-destructive hover:text-destructive"
                              title="Удалить отчёт"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
