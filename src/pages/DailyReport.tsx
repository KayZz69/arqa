import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Save, ArrowLeft, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

const reportItemSchema = z.object({
  ending_stock: z.coerce.number().min(0, "Должно быть 0 или больше"),
  write_off: z.coerce.number().min(0, "Должно быть 0 или больше"),
});

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
};

type ReportItem = {
  id?: string;
  position_id: string;
  ending_stock: number;
  write_off: number;
};

export default function DailyReport() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reportId, setReportId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [reportItems, setReportItems] = useState<Record<string, ReportItem>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrCreateReport = useCallback(async (date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateString = format(date, "yyyy-MM-dd");

      const { data: existingReport } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("barista_id", user.id)
        .eq("report_date", dateString)
        .maybeSingle();

      if (existingReport) {
        setReportId(existingReport.id);
        setIsLocked(existingReport.is_locked);
        
        const { data: items } = await supabase
          .from("report_items")
          .select("*")
          .eq("report_id", existingReport.id);

        if (items) {
          const itemsMap: Record<string, ReportItem> = {};
          items.forEach(item => {
            itemsMap[item.position_id] = {
              id: item.id,
              position_id: item.position_id,
              ending_stock: item.ending_stock,
              write_off: item.write_off,
            };
          });
          setReportItems(itemsMap);
        }
      } else {
        const { data: newReport, error } = await supabase
          .from("daily_reports")
          .insert({
            barista_id: user.id,
            report_date: dateString,
            is_locked: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        setReportId(newReport.id);
        setIsLocked(false);
        setReportItems({});
      }
    } catch (error) {
      console.error("Error fetching/creating report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить отчёт",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from("positions")
          .select("id, name, category, unit")
          .eq("active", true)
          .order("category")
          .order("sort_order");

        if (error) throw error;
        setPositions(data || []);
      } catch (error) {
        console.error("Error fetching positions:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить позиции",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [toast]);

  useEffect(() => {
    if (selectedDate) {
      fetchOrCreateReport(selectedDate);
    }
  }, [selectedDate, fetchOrCreateReport]);

  const saveReportItem = useCallback(async (positionId: string, data: Omit<ReportItem, "position_id">) => {
    if (!reportId || isLocked) return;

    try {
      reportItemSchema.parse(data);
      setSaving(true);

      const itemData = {
        report_id: reportId,
        position_id: positionId,
        ending_stock: data.ending_stock,
        write_off: data.write_off,
      };

      if (data.id) {
        const { error } = await supabase
          .from("report_items")
          .update(itemData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: newItem, error } = await supabase
          .from("report_items")
          .insert(itemData)
          .select()
          .single();

        if (error) throw error;
        setReportItems(prev => ({
          ...prev,
          [positionId]: { ...itemData, id: newItem.id },
        }));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ошибка валидации",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Error saving report item:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить элемент",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [reportId, isLocked, toast]);

  const handleInputChange = (positionId: string, field: "ending_stock" | "write_off", value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setReportItems(prev => {
      const current = prev[positionId] || { position_id: positionId, ending_stock: 0, write_off: 0 };
      const updated = { ...current, [field]: numValue };
      
      setTimeout(() => {
        saveReportItem(positionId, updated);
      }, 1000);
      
      return { ...prev, [positionId]: updated };
    });
  };

  const handleSubmitReport = async () => {
    if (!reportId || isLocked) return;
    
    if (!confirm("Вы уверены, что хотите отправить этот отчёт? После отправки его нельзя будет редактировать.")) {
      return;
    }

    try {
      setSubmitting(true);

      const { error: updateError } = await supabase
        .from("daily_reports")
        .update({ is_locked: true })
        .eq("id", reportId);

      if (updateError) throw updateError;

      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

      if (managers && managers.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: "report_submitted",
          message: `Новый ежедневный отчёт отправлен пользователем ${user?.email} за ${format(selectedDate, "dd MMM yyyy", { locale: ru })}`,
          related_id: reportId,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      setIsLocked(true);
      
      toast({
        title: "Успешно",
        description: "Отчёт успешно отправлен",
      });
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить отчёт",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportId || isLocked) return;
    
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

      setReportId(null);
      setReportItems({});
      setIsLocked(false);
      navigate("/");
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить отчёт",
        variant: "destructive",
      });
    }
  };

  const groupedPositions = positions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  if (roleLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (role !== "barista") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Доступ запрещён. Только для бариста.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Ежедневный отчёт</h1>
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Save className="h-4 w-4 animate-pulse" />
              Сохранение...
            </div>
          )}
          {reportId && !isLocked && (
            <>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSubmitReport}
                disabled={submitting}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Отправка..." : "Отправить отчёт"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteReport}>
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить отчёт
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Выберите дату отчёта</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={isLocked}
              >
                <CalendarIcon />
                {selectedDate ? format(selectedDate, "PPP", { locale: ru }) : <span>Выберите дату</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
                locale={ru}
              />
            </PopoverContent>
          </Popover>
          {isLocked && (
            <p className="mt-2 text-sm text-destructive">
              Этот отчёт заблокирован и не может быть изменён или удалён.
            </p>
          )}
          {!isLocked && reportId && (
            <p className="mt-2 text-sm text-muted-foreground">
              Этот отчёт можно редактировать. Изменения сохраняются автоматически.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(groupedPositions).map(([category, categoryPositions]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryPositions.map(position => {
                  const item = reportItems[position.id] || {
                    position_id: position.id,
                    ending_stock: 0,
                    write_off: 0,
                  };

                  return (
                    <div key={position.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-lg">
                      <div>
                        <Label className="font-semibold">{position.name}</Label>
                        <p className="text-sm text-muted-foreground">{position.unit}</p>
                      </div>
                      <div>
                        <Label htmlFor={`stock-${position.id}`}>Остаток на конец дня</Label>
                        <Input
                          id={`stock-${position.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.ending_stock}
                          onChange={(e) => handleInputChange(position.id, "ending_stock", e.target.value)}
                          disabled={isLocked}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`writeoff-${position.id}`}>Списание</Label>
                        <Input
                          id={`writeoff-${position.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.write_off}
                          onChange={(e) => handleInputChange(position.id, "write_off", e.target.value)}
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
