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

interface BaristaInfo {
  user_id: string;
  display_name: string;
}

export default function ManagerReports() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [baristas, setBaristas] = useState<BaristaInfo[]>([]);
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
        .select("id, report_date, barista_id, is_locked, submitted_at, created_at")
        .order("report_date", { ascending: false });

      if (startDate) query = query.gte("report_date", startDate);
      if (endDate) query = query.lte("report_date", endDate);
      if (selectedBarista !== "all") query = query.eq("barista_id", selectedBarista);

      const { data: reportsData, error: reportsError } = await query;
      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      // Fetch baristas from profiles joined with user_roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "barista");

      const baristaIds = rolesData?.map(r => r.user_id) || [];
      
      if (baristaIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", baristaIds);

        setBaristas(profilesData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Ошибка", description: "Не удалось загрузить отчёты", variant: "destructive" });
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
      toast({ title: "Успешно", description: `Отчёт ${!currentLockStatus ? "заблокирован" : "разблокирован"}` });
      fetchData();
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({ title: "Ошибка", description: "Не удалось обновить отчёт", variant: "destructive" });
    }
  };

  const handleEditReport = (reportId: string, reportDate: string) => {
    navigate(`/daily-report?date=${reportDate}`);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Удалить этот отчёт?")) return;
    try {
      const { error } = await supabase.from("daily_reports").delete().eq("id", reportId);
      if (error) throw error;
      toast({ title: "Успешно", description: "Отчёт удалён" });
      fetchData();
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({ title: "Ошибка", description: "Не удалось удалить отчёт", variant: "destructive" });
    }
  };

  const handleExportCSV = async () => {
    try {
      const reportIds = reports.map((r) => r.id);
      const { data: reportItems, error } = await supabase
        .from("report_items")
        .select(`*, positions (name, category, unit), report:daily_reports (report_date, barista_id)`)
        .in("report_id", reportIds);

      if (error) throw error;

      const csvRows = [["Дата", "Бариста", "Категория", "Позиция", "Остаток", "Списание", "Единица"]];

      for (const item of reportItems || []) {
        const report = reports.find((r) => r.id === item.report_id);
        const barista = baristas.find((b) => b.user_id === report?.barista_id);
        csvRows.push([
          report ? format(new Date(report.report_date), "yyyy-MM-dd") : "",
          barista?.display_name || "Неизвестно",
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
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", `reports-${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Успешно", description: "Отчёты экспортированы" });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({ title: "Ошибка", description: "Не удалось экспортировать", variant: "destructive" });
    }
  };

  const getBaristaName = (userId: string): string => {
    return baristas.find((b) => b.user_id === userId)?.display_name || "Неизвестно";
  };

  if (roleLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  if (role !== "manager") return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Отчёты
            </h1>
            <p className="text-muted-foreground">Все отчёты бариста</p>
          </div>
          <Button onClick={handleExportCSV} disabled={reports.length === 0} size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Фильтры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>С даты</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>По дату</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Бариста</Label>
                <Select value={selectedBarista} onValueChange={setSelectedBarista}>
                  <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все бариста</SelectItem>
                    {baristas.map((b) => (
                      <SelectItem key={b.user_id} value={b.user_id}>{b.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchData} className="w-full">Применить</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Отчёты ({reports.length})</CardTitle>
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
                        <TableCell>{getBaristaName(report.barista_id)}</TableCell>
                        <TableCell>{format(new Date(report.submitted_at), "dd.MM.yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant={report.is_locked ? "secondary" : "default"}>
                            {report.is_locked ? "Заблокирован" : "Открыт"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditReport(report.id, report.report_date)} title="Редактировать">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleLock(report.id, report.is_locked)} title={report.is_locked ? "Разблокировать" : "Заблокировать"}>
                              {report.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report.id)} className="text-destructive hover:text-destructive" title="Удалить">
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
