import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUserRole } from "@/hooks/useUserRole";
import { useDisplayName } from "@/hooks/useDisplayName";
import { toast } from "sonner";
import { ClipboardList, Package, Settings, Calendar, TrendingUp, Warehouse, FileText, ShoppingCart, AlertTriangle } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { BottomNavigation } from "@/components/BottomNavigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const Index = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [todayReport, setTodayReport] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState({ submitted: 0, total: 7 });
  const { displayName } = useDisplayName(user?.id);

  // Manager metrics
  const [orderCount, setOrderCount] = useState(0);
  const [todayReportsCount, setTodayReportsCount] = useState({ submitted: 0, total: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user && role === "barista") {
        fetchTodayReport(user.id);
        fetchWeeklyStats(user.id);
      }
      if (user && role === "manager") {
        fetchManagerMetrics();
      }
    });
  }, [role]);

  const fetchTodayReport = async (userId: string) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("barista_id", userId)
        .eq("report_date", today)
        .maybeSingle();
      setTodayReport(data);
    } catch (error) {
      console.error("Error fetching today's report:", error);
    }
  };

  const fetchWeeklyStats = async (userId: string) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("barista_id", userId)
        .gte("report_date", format(weekAgo, "yyyy-MM-dd"));
      setWeeklyStats({ submitted: data?.length || 0, total: 7 });
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
    }
  };

  const fetchManagerMetrics = async () => {
    try {
      // Get positions needing order
      const { data: positions } = await supabase
        .from("positions")
        .select("id, min_stock")
        .eq("active", true);

      let needsOrder = 0;
      for (const position of positions || []) {
        const { data: latestReport } = await supabase
          .from("report_items")
          .select("ending_stock")
          .eq("position_id", position.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const currentStock = latestReport ? Number(latestReport.ending_stock) : 0;
        if (currentStock < position.min_stock) needsOrder++;
      }
      setOrderCount(needsOrder);

      // Get today's reports stats
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: todayReports } = await supabase
        .from("daily_reports")
        .select("is_locked")
        .eq("report_date", today);

      const { count: baristaCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "barista");

      setTodayReportsCount({
        submitted: todayReports?.filter(r => r.is_locked).length || 0,
        total: baristaCount || 0,
      });
    } catch (error) {
      console.error("Error fetching manager metrics:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Вы успешно вышли из системы");
    navigate("/login");
  };

  const getReportStatus = () => {
    if (!todayReport) return "draft";
    if (todayReport.is_locked) return "submitted";
    return "draft";
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {role === "barista" ? "☕ " : ""}Управление инвентарём
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}
              </p>
              <p className="text-sm text-muted-foreground">
                {displayName || user?.email}
              </p>
              {role && (
                <Badge variant="secondary" className="mt-2">
                  {role === "barista" ? "Бариста" : "Менеджер"}
                </Badge>
              )}
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm" className="hidden md:flex">
              Выход
            </Button>
          </div>

          {!role && (
            <Card>
              <CardHeader>
                <CardTitle>Роль не назначена</CardTitle>
                <CardDescription>
                  Свяжитесь с администратором для назначения роли
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {role === "barista" && (
            <div className="space-y-6">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Сегодняшний отчёт
                    </CardTitle>
                    <ReportStatusBadge status={getReportStatus()} />
                  </div>
                  <CardDescription>
                    {todayReport
                      ? todayReport.is_locked
                        ? `Отправлен в ${format(new Date(todayReport.submitted_at), "HH:mm")}`
                        : "Черновик сохранён"
                      : "Отчёт ещё не создан"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!todayReport || !todayReport.is_locked ? (
                    <Button className="w-full" size="lg" onClick={() => navigate("/daily-report")}>
                      {todayReport ? "Продолжить заполнение" : "Создать отчёт"}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" onClick={() => navigate("/daily-report")}>
                      Просмотреть отчёт
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Прогресс за неделю
                  </CardTitle>
                  <CardDescription>
                    Отправлено {weeklyStats.submitted} из {weeklyStats.total} отчётов
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={(weeklyStats.submitted / weeklyStats.total) * 100} className="h-3" />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/current-inventory")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5" />
                      Инвентарь
                    </CardTitle>
                    <CardDescription>Просмотр текущих остатков</CardDescription>
                  </CardHeader>
                </Card>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/daily-report")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5" />
                      История отчётов
                    </CardTitle>
                    <CardDescription>Предыдущие отчёты</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          )}

          {role === "manager" && (
            <div className="space-y-6">
              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className={orderCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${orderCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                        <ShoppingCart className={`h-5 w-5 ${orderCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${orderCount > 0 ? "text-destructive" : ""}`}>{orderCount}</p>
                        <p className="text-xs text-muted-foreground">Нужно заказать</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{todayReportsCount.submitted}/{todayReportsCount.total}</p>
                        <p className="text-xs text-muted-foreground">Отчётов сегодня</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Navigation Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/warehouse")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5" />
                      Склад
                      {orderCount > 0 && <Badge variant="destructive">{orderCount}</Badge>}
                    </CardTitle>
                    <CardDescription>Заказы, приход и история</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/manager-reports")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Отчёты
                    </CardTitle>
                    <CardDescription>История отчётов бариста</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/positions")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Настройки
                    </CardTitle>
                    <CardDescription>Управление позициями</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Быстрый доступ</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/current-inventory")}>
                    <Package className="h-4 w-4 mr-2" />
                    Текущий инвентарь
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      {role === "barista" && <BottomNavigation />}
    </>
  );
};

export default Index;
