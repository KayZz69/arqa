import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ArrowLeft, Trash2, Send, Lock, Unlock, ChevronDown, ChevronUp } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { PositionCard } from "@/components/PositionCard";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { z } from "zod";

const reportItemSchema = z.object({
  ending_stock: z.coerce.number().min(0, "Должно быть 0 или больше"),
});

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
};

type ReportItem = {
  id?: string;
  position_id: string;
  ending_stock: number;
  write_off: number;
};

type PreviousDayData = {
  ending_stock: number;
  arrivals: number;
};

export default function DailyReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get("date");
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [reportId, setReportId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [reportItems, setReportItems] = useState<Record<string, ReportItem>>({});
  const [previousDayData, setPreviousDayData] = useState<Record<string, PreviousDayData>>({});
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Fetch previous day stock for all positions
  const fetchPreviousDayData = useCallback(async (date: Date, positionIds: string[]) => {
    const previousDate = subDays(date, 1);
    const previousDateString = format(previousDate, "yyyy-MM-dd");
    const currentDateString = format(date, "yyyy-MM-dd");

    const data: Record<string, PreviousDayData> = {};

    // Get previous day report
    const { data: prevReport } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", previousDateString)
      .maybeSingle();

    let prevItems: Record<string, number> = {};
    if (prevReport) {
      const { data: items } = await supabase
        .from("report_items")
        .select("position_id, ending_stock")
        .eq("report_id", prevReport.id);
      
      if (items) {
        items.forEach(item => {
          prevItems[item.position_id] = Number(item.ending_stock);
        });
      }
    }

    // Get arrivals for current date
    const { data: batches } = await supabase
      .from("inventory_batches")
      .select("position_id, quantity")
      .eq("arrival_date", currentDateString);

    const arrivals: Record<string, number> = {};
    if (batches) {
      batches.forEach(batch => {
        arrivals[batch.position_id] = (arrivals[batch.position_id] || 0) + Number(batch.quantity);
      });
    }

    positionIds.forEach(id => {
      data[id] = {
        ending_stock: prevItems[id] || 0,
        arrivals: arrivals[id] || 0,
      };
    });

    setPreviousDayData(data);
  }, []);

  const fetchReport = useCallback(async (date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateString = format(date, "yyyy-MM-dd");

      let query = supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", dateString);

      if (role !== "manager") {
        query = query.eq("barista_id", user.id);
      }

      const { data: existingReport } = await query.maybeSingle();

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
              ending_stock: Number(item.ending_stock),
              write_off: Number(item.write_off),
            };
          });
          setReportItems(itemsMap);
        }
      } else {
        setReportId(null);
        setIsLocked(false);
        setReportItems({});
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить отчёт",
        variant: "destructive",
      });
    }
  }, [toast, role]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from("positions")
          .select("id, name, category, unit, min_stock")
          .eq("active", true)
          .order("category")
          .order("sort_order");

        if (error) throw error;
        setPositions(data || []);
        
        // Fetch previous day data for all positions
        if (data && data.length > 0) {
          fetchPreviousDayData(selectedDate, data.map(p => p.id));
        }
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
  }, [toast, fetchPreviousDayData, selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      fetchReport(selectedDate);
      if (positions.length > 0) {
        fetchPreviousDayData(selectedDate, positions.map(p => p.id));
      }
    }
  }, [selectedDate, fetchReport, fetchPreviousDayData, positions]);

  const calculateWriteOff = (positionId: string, endingStock: number): number => {
    const prev = previousDayData[positionId] || { ending_stock: 0, arrivals: 0 };
    // Write-off = Previous stock + Arrivals - Current stock
    return Math.max(0, prev.ending_stock + prev.arrivals - endingStock);
  };

  const saveReportItem = useCallback(async (positionId: string, endingStock: number, writeOff: number) => {
    if (!reportId || (isLocked && role !== "manager")) return;

    try {
      const itemData = {
        report_id: reportId,
        position_id: positionId,
        ending_stock: endingStock,
        write_off: writeOff,
      };

      const { data: upsertedItem, error } = await supabase
        .from("report_items")
        .upsert(itemData, { onConflict: "report_id,position_id" })
        .select()
        .single();

      if (error) throw error;
      
      setReportItems(prev => ({
        ...prev,
        [positionId]: { ...itemData, id: upsertedItem.id },
      }));
    } catch (error) {
      console.error("Error saving report item:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить элемент",
        variant: "destructive",
      });
    }
  }, [reportId, isLocked, role, toast]);

  const handleInputChange = (positionId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const calculatedWriteOff = calculateWriteOff(positionId, numValue);
    
    setReportItems(prev => {
      const current = prev[positionId] || { position_id: positionId, ending_stock: 0, write_off: 0 };
      const updated = { ...current, ending_stock: numValue, write_off: calculatedWriteOff };
      
      // For managers editing locked reports, save immediately
      if (reportId && isLocked && role === "manager") {
        setTimeout(() => {
          saveReportItem(positionId, numValue, calculatedWriteOff);
        }, 1000);
      }
      
      return { ...prev, [positionId]: updated };
    });
  };

  const checkLowStockAndNotify = async (items: ReportItem[]) => {
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager");

    if (!managers || managers.length === 0) return;

    const lowStockPositions = items.filter(item => {
      const position = positions.find(p => p.id === item.position_id);
      return position && item.ending_stock < position.min_stock;
    });

    for (const item of lowStockPositions) {
      const position = positions.find(p => p.id === item.position_id);
      if (!position) continue;

      const notifications = managers.map(manager => ({
        user_id: manager.user_id,
        type: "low_stock",
        message: `⚠️ ${position.name}: осталось ${item.ending_stock} ${position.unit}, рекомендуем заказать`,
        related_id: item.position_id,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  };

  const checkHighWriteOffAndNotify = async (items: ReportItem[]) => {
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager");

    if (!managers || managers.length === 0) return;

    for (const item of items) {
      const prev = previousDayData[item.position_id];
      if (!prev) continue;

      const expectedUsage = prev.ending_stock + prev.arrivals;
      // Alert if write-off is more than 50% of available stock
      if (item.write_off > expectedUsage * 0.5 && item.write_off > 2) {
        const position = positions.find(p => p.id === item.position_id);
        if (!position) continue;

        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: "high_writeoff",
          message: `🚨 ${position.name}: списано ${item.write_off} ${position.unit} (было ${prev.ending_stock}+${prev.arrivals})`,
          related_id: item.position_id,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    }
  };

  const handleSubmitReport = async () => {
    if (isLocked && role !== "manager") return;
    
    const hasItems = Object.keys(reportItems).length > 0;
    if (!hasItems) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните хотя бы одну позицию",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Вы уверены, что хотите отправить этот отчёт?")) {
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");

      const dateString = format(selectedDate, "yyyy-MM-dd");

      let currentReportId = reportId;
      if (!currentReportId) {
        const { data: newReport, error: createError } = await supabase
          .from("daily_reports")
          .insert({
            barista_id: user.id,
            report_date: dateString,
            is_locked: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        currentReportId = newReport.id;
        setReportId(currentReportId);
      }

      // Calculate write-offs for all items
      const itemsToInsert = Object.values(reportItems).map(item => {
        const writeOff = calculateWriteOff(item.position_id, item.ending_stock);
        return {
          report_id: currentReportId,
          position_id: item.position_id,
          ending_stock: item.ending_stock,
          write_off: writeOff,
        };
      });

      const { error: itemsError } = await supabase
        .from("report_items")
        .upsert(itemsToInsert, { onConflict: "report_id,position_id" });

      if (itemsError) throw itemsError;

      // Lock the report
      const { error: lockError } = await supabase
        .from("daily_reports")
        .update({ is_locked: true })
        .eq("id", currentReportId);

      if (lockError) throw lockError;

      // Check for low stock and high write-offs
      await checkLowStockAndNotify(itemsToInsert);
      await checkHighWriteOffAndNotify(itemsToInsert);

      // Send notification to managers about report
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

      if (managers && managers.length > 0) {
        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: "report_submitted",
          message: `Новый ежедневный отчёт от ${user?.email} за ${format(selectedDate, "dd MMM yyyy", { locale: ru })}`,
          related_id: currentReportId,
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
    if (!reportId && role === "barista" && Object.keys(reportItems).length === 0) {
      toast({
        title: "Информация",
        description: "Нет черновика для удаления",
      });
      return;
    }

    if (reportId) {
      if (role !== "manager" && isLocked) return;
      
      if (!confirm("Вы уверены, что хотите удалить этот отчёт?")) {
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
      } catch (error) {
        console.error("Error deleting report:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось удалить отчёт",
          variant: "destructive",
        });
      }
    } else {
      if (!confirm("Очистить черновик?")) {
        return;
      }
      setReportItems({});
      toast({
        title: "Успешно",
        description: "Черновик очищен",
      });
    }
  };

  const handleToggleLock = async () => {
    if (!reportId || role !== "manager") return;

    try {
      const newLockStatus = !isLocked;
      const { error } = await supabase
        .from("daily_reports")
        .update({ is_locked: newLockStatus })
        .eq("id", reportId);

      if (error) throw error;

      setIsLocked(newLockStatus);
      
      toast({
        title: "Успешно",
        description: newLockStatus ? "Отчёт заблокирован" : "Отчёт разблокирован",
      });
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус блокировки",
        variant: "destructive",
      });
    }
  };

  // Filter positions for baristas - hide positions without stock
  const visiblePositions = role === "manager" 
    ? positions 
    : positions.filter(position => {
        const prev = previousDayData[position.id];
        if (!prev) return true; // Show while loading
        // Show if there's previous stock OR arrivals today
        return prev.ending_stock > 0 || prev.arrivals > 0;
      });

  const hiddenPositionsCount = positions.length - visiblePositions.length;

  const groupedPositions = visiblePositions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  const totalPositions = visiblePositions.length;
  const filledPositions = Object.values(reportItems).filter(
    item => item.ending_stock > 0 && visiblePositions.some(p => p.id === item.position_id)
  ).length;
  const progressPercentage = totalPositions > 0 ? (filledPositions / totalPositions) * 100 : 0;

  const getReportStatus = () => {
    if (!reportId) return "draft";
    if (isLocked) return "submitted";
    return "draft";
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  if (roleLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (role !== "barista" && role !== "manager") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Доступ запрещён.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 pb-24 md:pb-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">Ежедневный отчёт</h1>
              <ReportStatusBadge status={getReportStatus()} />
            </div>
            {totalPositions > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Заполнено: {filledPositions} из {totalPositions} позиций
                {hiddenPositionsCount > 0 && role === "barista" && (
                  <span className="ml-2 opacity-70">
                    ({hiddenPositionsCount} без остатков скрыто)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reportId && role === "manager" && (
            <Button 
              variant={isLocked ? "outline" : "secondary"} 
              size="sm" 
              onClick={handleToggleLock}
            >
              {isLocked ? (
                <>
                  <Unlock className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Разблокировать</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Заблокировать</span>
                </>
              )}
            </Button>
          )}
          {reportId && role === "manager" && (
            <Button variant="destructive" size="sm" onClick={handleDeleteReport}>
              <Trash2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Удалить</span>
            </Button>
          )}
        </div>
      </div>

      {totalPositions > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Прогресс заполнения</span>
                <span className="font-medium">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

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
                  "w-full md:w-[240px] justify-start text-left font-normal",
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
          {isLocked && role === "barista" && (
            <p className="mt-2 text-sm text-destructive">
              Этот отчёт заблокирован и не может быть изменён.
            </p>
          )}
          {isLocked && role === "manager" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Изменения сохраняются автоматически.
            </p>
          )}
          {!reportId && role === "barista" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Заполните остатки и нажмите "Отправить отчёт".
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(groupedPositions).map(([category, categoryPositions]) => {
          const categoryFilled = categoryPositions.filter(pos => {
            const item = reportItems[pos.id];
            return item && item.ending_stock > 0;
          }).length;
          const isOpen = openCategories[category] !== false;

          return (
            <Card key={category}>
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category)}>
                <CardHeader className="cursor-pointer" onClick={() => toggleCategory(category)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>{category}</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {categoryFilled}/{categoryPositions.length}
                      </span>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-3">
                      {categoryPositions.map(position => {
                        const item = reportItems[position.id] || {
                          position_id: position.id,
                          ending_stock: 0,
                          write_off: 0,
                        };
                        const prev = previousDayData[position.id] || { ending_stock: 0, arrivals: 0 };
                        const calculatedWriteOff = calculateWriteOff(position.id, item.ending_stock);

                        return (
                          <PositionCard
                            key={position.id}
                            position={position}
                            endingStock={item.ending_stock}
                            previousStock={prev.ending_stock}
                            arrivals={prev.arrivals}
                            calculatedWriteOff={calculatedWriteOff}
                            disabled={isLocked && role !== "manager"}
                            onChange={(value) => handleInputChange(position.id, value)}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Desktop Submit Button for Baristas */}
      {role === "barista" && !isLocked && (
        <div className="hidden md:block mt-6">
          {filledPositions === 0 && (
            <p className="text-sm text-muted-foreground text-right mb-2">
              Заполните хотя бы одну позицию
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button 
              variant="destructive"
              onClick={handleDeleteReport}
              disabled={Object.keys(reportItems).length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Очистить черновик
            </Button>
            <Button 
              onClick={handleSubmitReport}
              disabled={submitting || filledPositions === 0}
              size="lg"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Отправка..." : "Отправить отчёт"}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Submit Button for Baristas (Mobile) */}
      {role === "barista" && !isLocked && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t p-4 md:hidden">
          <div className="flex gap-2">
            <Button 
              className="flex-1"
              size="lg"
              onClick={handleSubmitReport}
              disabled={submitting || filledPositions === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Отправка..." : "Отправить отчёт"}
            </Button>
            <Button 
              variant="destructive" 
              size="lg"
              onClick={handleDeleteReport}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
