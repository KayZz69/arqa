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
import { Bell, ClipboardList, Package, Settings, Calendar, TrendingUp, ShoppingCart } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { BottomNavigation } from "@/components/BottomNavigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const Index = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todayReport, setTodayReport] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState({ submitted: 0, total: 7 });
  const { displayName } = useDisplayName(user?.id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user && role === "manager") {
        fetchUnreadCount(user.id);
      }
      if (user && role === "barista") {
        fetchTodayReport(user.id);
        fetchWeeklyStats(user.id);
      }
    });
  }, [role]);

  useEffect(() => {
    if (role === "manager" && user) {
      const channel = supabase
        .channel("notifications-badge")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
          },
          () => {
            fetchUnreadCount(user.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role, user]);

  const fetchUnreadCount = async (userId: string) => {
    try {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

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
      const weekAgoString = format(weekAgo, "yyyy-MM-dd");

      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("barista_id", userId)
        .gte("report_date", weekAgoString);

      setWeeklyStats({ submitted: data?.length || 0, total: 7 });
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
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
        <div className="mx-auto max-w-4xl p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                {role === "barista" ? "☕ " : ""}Управление инвентарём
              </h1>
              <p className="text-muted-foreground mt-1">
                {format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Добро пожаловать, {displayName || user?.email}
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
                  Пожалуйста, свяжитесь с администратором для назначения роли (бариста или менеджер)
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {role === "barista" && (
            <div className="space-y-6">
              {/* Today's Report Status */}
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
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => navigate("/daily-report")}
                    >
                      {todayReport ? "Продолжить заполнение" : "Создать отчёт"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate("/daily-report")}
                    >
                      Просмотреть отчёт
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Progress */}
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

              {/* Quick Actions */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/current-inventory")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5" />
                      Инвентарь
                    </CardTitle>
                    <CardDescription>Просмотр текущего уровня запасов</CardDescription>
                  </CardHeader>
                </Card>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/daily-report")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5" />
                      История отчётов
                    </CardTitle>
                    <CardDescription>Просмотр предыдущих отчётов</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          )}

          {role === "manager" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>Все отчёты</CardTitle>
                  <CardDescription>Просмотр и управление всеми ежедневными отчётами</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/manager-reports")}>
                    Просмотреть отчёты
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>Партии инвентаря</CardTitle>
                  <CardDescription>Добавление и управление партиями инвентаря</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/inventory-batches")}>
                    Управление партиями
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>Текущий инвентарь</CardTitle>
                  <CardDescription>Просмотр уровней запасов в реальном времени</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/current-inventory")}>
                    Просмотреть инвентарь
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Уведомления
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {unreadCount}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Просмотр уведомлений о партиях и отчётах</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/notifications")}>
                    Просмотреть уведомления
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Заказы
                  </CardTitle>
                  <CardDescription>Позиции с низким остатком</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/orders")}>
                    Просмотреть заказы
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Позиции
                  </CardTitle>
                  <CardDescription>Настройка позиций инвентаря</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigate("/positions")}>
                    Управление позициями
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
