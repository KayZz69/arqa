import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useDisplayName } from "@/hooks/useDisplayName";
import { toast } from "sonner";
import { Bell } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { displayName } = useDisplayName(user?.id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user && role === "manager") {
        fetchUnreadCount(user.id);
      }
    });
  }, [role]);

  useEffect(() => {
    if (role === "manager" && user) {
      // Subscribe to new notifications
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Вы успешно вышли из системы");
    navigate("/login");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Управление инвентарём</h1>
            <p className="text-muted-foreground">Добро пожаловать, {displayName || user?.email}</p>
            {role && <p className="text-sm text-muted-foreground">Роль: {role === "barista" ? "Бариста" : "Менеджер"}</p>}
          </div>
          <Button onClick={handleLogout} variant="outline">
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ежедневные отчёты</CardTitle>
                <CardDescription>Создавайте и просматривайте ваши ежедневные отчёты по инвентарю</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/daily-report")}>Создать новый отчёт</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Инвентарь</CardTitle>
                <CardDescription>Просмотр текущего уровня запасов</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={() => navigate("/current-inventory")}>
                  Просмотреть инвентарь
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {role === "manager" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Все отчёты</CardTitle>
                <CardDescription>Просмотр и управление всеми ежедневными отчётами</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/manager-reports")}>Просмотреть отчёты</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Партии инвентаря</CardTitle>
                <CardDescription>Добавление и управление партиями инвентаря</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/inventory-batches")}>Управление партиями</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Текущий инвентарь</CardTitle>
                <CardDescription>Просмотр уровней запасов в реальном времени</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/current-inventory")}>Просмотреть инвентарь</Button>
              </CardContent>
            </Card>
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Позиции</CardTitle>
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
  );
};

export default Index;
