import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, CheckCheck, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  type: string;
  message: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === "manager") {
      fetchNotifications();
      
      // Subscribe to new notifications
      const channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role]);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить уведомления",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );

      toast({
        title: "Успешно",
        description: "Все уведомления отмечены как прочитанные",
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отметить уведомления как прочитанные",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "batch_expired":
        return "🔴";
      case "batch_expiring":
        return "⚠️";
      case "report_submitted":
        return "📋";
      default:
        return "🔔";
    }
  };

  if (roleLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (role !== "manager") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Доступ запрещён. Только для менеджеров.</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} непрочитанных уведомлений` : "Всё прочитано!"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            <CheckCheck className="h-4 w-4 mr-2" />
            Отметить всё прочитанным
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
      <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Уведомлений пока нет</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors ${
                !notification.is_read ? "border-primary/50 bg-accent/5" : ""
              }`}
              onClick={() => !notification.is_read && markAsRead(notification.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1">
                      <p className={`${!notification.is_read ? "font-semibold" : ""}`}>
                        {notification.message}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                  {!notification.is_read && (
                    <Badge variant="default">Новое</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
