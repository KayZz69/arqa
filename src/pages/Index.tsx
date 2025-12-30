import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useDisplayName } from "@/hooks/useDisplayName";
import { toast } from "sonner";
import { ClipboardList, Package, Settings, Calendar, TrendingUp, Warehouse, FileText, ShoppingCart } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DashboardSkeleton, ManagerDashboardSkeleton } from "@/components/DashboardSkeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [todayReport, setTodayReport] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState({ submitted: 0, total: 7 });
  const { displayName } = useDisplayName(user?.id);

  // Manager metrics
  const [orderCount, setOrderCount] = useState(0);
  const [todayReportsCount, setTodayReportsCount] = useState({ submitted: 0, total: 0 });

  useEffect(() => {
    if (!user || loading) return;

    if (role === "barista") {
      fetchTodayReport(user.id);
      fetchWeeklyStats(user.id);
    }
    if (role === "manager") {
      fetchManagerMetrics();
    }
  }, [user, role, loading]);

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
      // Fetch all positions and all report items in parallel (eliminates N+1 queries)
      const [positionsResult, reportItemsResult, todayReportsResult, baristaCountResult] = await Promise.all([
        supabase
          .from("positions")
          .select("id, min_stock")
          .eq("active", true),
        supabase
          .from("report_items")
          .select("position_id, ending_stock, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("daily_reports")
          .select("is_locked")
          .eq("report_date", format(new Date(), "yyyy-MM-dd")),
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "barista"),
      ]);

      const positions = positionsResult.data || [];
      const reportItems = reportItemsResult.data || [];

      // Build a map of position_id -> latest ending_stock (first occurrence is latest due to ordering)
      const latestStockByPosition = new Map<string, number>();
      for (const item of reportItems) {
        if (!latestStockByPosition.has(item.position_id)) {
          latestStockByPosition.set(item.position_id, Number(item.ending_stock) || 0);
        }
      }

      // Count positions that need ordering
      let needsOrder = 0;
      for (const position of positions) {
        const currentStock = latestStockByPosition.get(position.id) ?? 0;
        if (currentStock < position.min_stock) needsOrder++;
      }
      setOrderCount(needsOrder);

      setTodayReportsCount({
        submitted: todayReportsResult.data?.filter(r => r.is_locked).length || 0,
        total: baristaCountResult.count || 0,
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Доброе утро";
    if (hour < 18) return "Добрый день";
    return "Добрый вечер";
  };

  if (loading) {
    return role === "manager" ? <ManagerDashboardSkeleton /> : <DashboardSkeleton />;
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between animate-fade-in">
            <div>
              <p className="text-muted-foreground text-sm mb-1">
                {format(new Date(), "EEEE, d MMMM", { locale: ru })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {getGreeting()}{displayName ? `, ${displayName.split(' ')[0]}` : ''}! 👋
              </h1>
              {role && (
                <Badge variant="secondary" className="mt-2 rounded-full px-3">
                  {role === "barista" ? "☕ Бариста" : "📊 Менеджер"}
                </Badge>
              )}
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm" className="hidden md:flex rounded-xl">
              Выход
            </Button>
          </div>

          {!role && (
            <Card className="animate-fade-in">
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
              {/* Today's Report Card - Hero */}
              <Card className="overflow-hidden border-0 shadow-lg animate-slide-up opacity-0 stagger-1">
                <div className="gradient-primary p-6 text-primary-foreground">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                        <ClipboardList className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Сегодняшний отчёт</h3>
                        <p className="text-primary-foreground/80 text-sm">
                          {todayReport
                            ? todayReport.is_locked
                              ? `Отправлен в ${format(new Date(todayReport.submitted_at), "HH:mm")}`
                              : "Черновик сохранён"
                            : "Отчёт ещё не создан"}
                        </p>
                      </div>
                    </div>
                    <ReportStatusBadge status={getReportStatus()} />
                  </div>
                  {!todayReport || !todayReport.is_locked ? (
                    <Button
                      className="w-full bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 h-12 rounded-xl font-medium"
                      size="lg"
                      onClick={() => navigate("/daily-report")}
                    >
                      {todayReport ? "Продолжить заполнение" : "Создать отчёт"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 h-12 rounded-xl font-medium"
                      variant="outline"
                      onClick={() => navigate("/daily-report")}
                    >
                      Просмотреть отчёт
                    </Button>
                  )}
                </div>
              </Card>

              {/* Weekly Progress */}
              <Card className="border-2 animate-slide-up opacity-0 stagger-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-2/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-chart-2" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Прогресс за неделю</CardTitle>
                      <CardDescription>
                        {weeklyStats.submitted} из {weeklyStats.total} отчётов
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={(weeklyStats.submitted / weeklyStats.total) * 100} className="h-3 rounded-full" />
                </CardContent>
              </Card>

              {/* Navigation Cards */}
              <div className="grid gap-4 md:grid-cols-2 animate-slide-up opacity-0 stagger-3">
                <Card
                  className="cursor-pointer hover-lift border-2 hover:border-primary/50 group"
                  onClick={() => navigate("/current-inventory")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Инвентарь</CardTitle>
                        <CardDescription>Текущие остатки</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                <Card
                  className="cursor-pointer hover-lift border-2 hover:border-primary/50 group"
                  onClick={() => navigate("/report-history")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center group-hover:bg-chart-3/30 transition-colors">
                        <Calendar className="h-5 w-5 text-chart-3" />
                      </div>
                      <div>
                        <CardTitle className="text-base">История отчётов</CardTitle>
                        <CardDescription>Все ваши отчёты</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </div>
          )}

          {role === "manager" && (
            <div className="space-y-6">
              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-4 animate-slide-up opacity-0 stagger-1">
                <Card className={`border-2 ${orderCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${orderCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                        <ShoppingCart className={`h-6 w-6 ${orderCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`text-3xl font-bold ${orderCount > 0 ? "text-destructive" : ""}`}>{orderCount}</p>
                        <p className="text-xs text-muted-foreground">Нужно заказать</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{todayReportsCount.submitted}/{todayReportsCount.total}</p>
                        <p className="text-xs text-muted-foreground">Отчётов сегодня</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Navigation Cards */}
              <div className="grid gap-4 md:grid-cols-3 animate-slide-up opacity-0 stagger-2">
                <Card
                  className="cursor-pointer hover-lift border-2 hover:border-primary/50 group"
                  onClick={() => navigate("/warehouse")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Warehouse className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">Склад</CardTitle>
                          {orderCount > 0 && <Badge variant="destructive" className="rounded-full text-xs">{orderCount}</Badge>}
                        </div>
                        <CardDescription>Заказы и приход</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer hover-lift border-2 hover:border-primary/50 group"
                  onClick={() => navigate("/manager-reports")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-chart-2/20 flex items-center justify-center group-hover:bg-chart-2/30 transition-colors">
                        <FileText className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Отчёты</CardTitle>
                        <CardDescription>История бариста</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer hover-lift border-2 hover:border-primary/50 group"
                  onClick={() => navigate("/positions")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                        <Settings className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Настройки</CardTitle>
                        <CardDescription>Позиции</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>

              {/* Quick Links */}
              <Card className="border-2 animate-slide-up opacity-0 stagger-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Быстрый доступ</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/current-inventory")}>
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
