import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { CalendarIcon, ArrowLeft, Trash2, Send, Lock, Unlock, ChevronDown, ChevronUp } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { PositionCard } from "@/components/PositionCard";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const fetchReport = useCallback(async (date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateString = format(date, "yyyy-MM-dd");

      // For managers, try to find any report for this date
      // For baristas, only find their own reports
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
              ending_stock: item.ending_stock,
              write_off: item.write_off,
            };
          });
          setReportItems(itemsMap);
        }
      } else {
        // No report exists yet
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
      fetchReport(selectedDate);
    }
  }, [selectedDate, fetchReport]);

  const saveReportItem = useCallback(async (positionId: string, data: Omit<ReportItem, "position_id">) => {
    // Only managers can edit locked reports
    if (!reportId || (isLocked && role !== "manager")) return;

    try {
      reportItemSchema.parse(data);

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
        const { data: upsertedItem, error } = await supabase
          .from("report_items")
          .upsert(itemData, {
            onConflict: "report_id,position_id"
          })
          .select()
          .single();

        if (error) throw error;
        setReportItems(prev => ({
          ...prev,
          [positionId]: { ...itemData, id: upsertedItem.id },
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
    }
  }, [reportId, isLocked, role, toast]);

  const handleInputChange = (positionId: string, field: "ending_stock" | "write_off", value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setReportItems(prev => {
      const current = prev[positionId] || { position_id: positionId, ending_stock: 0, write_off: 0 };
      const updated = { ...current, [field]: numValue };
      
      // For managers editing locked reports, save immediately
      if (reportId && isLocked && role === "manager") {
        setTimeout(() => {
          saveReportItem(positionId, updated);
        }, 1000);
      }
      
      return { ...prev, [positionId]: updated };
    });
  };

  const handleSubmitReport = async () => {
    if (isLocked && role !== "manager") return;
    
    // Check if there are any items to submit
    const hasItems = Object.keys(reportItems).length > 0;
    if (!hasItems) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните хотя бы одну позицию",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Вы уверены, что хотите отправить этот отчёт? После отправки его нельзя будет редактировать.")) {
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");

      const dateString = format(selectedDate, "yyyy-MM-dd");

      // Create the report if it doesn't exist
      let currentReportId = reportId;
      if (!currentReportId) {
        const { data: newReport, error: createError } = await supabase
          .from("daily_reports")
          .insert({
            barista_id: user.id,
            report_date: dateString,
            is_locked: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        currentReportId = newReport.id;
        setReportId(currentReportId);
      } else {
        // Update existing report to locked
        const { error: updateError } = await supabase
          .from("daily_reports")
          .update({ is_locked: true })
          .eq("id", currentReportId);

        if (updateError) throw updateError;
      }

      // Save all report items
      const itemsToInsert = Object.values(reportItems).map(item => ({
        report_id: currentReportId,
        position_id: item.position_id,
        ending_stock: item.ending_stock,
        write_off: item.write_off,
      }));

      const { error: itemsError } = await supabase
        .from("report_items")
        .upsert(itemsToInsert, {
          onConflict: "report_id,position_id"
        });

      if (itemsError) throw itemsError;

      // Send notifications to managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

      if (managers && managers.length > 0) {
        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: "report_submitted",
          message: `Новый ежедневный отчёт отправлен пользователем ${user?.email} за ${format(selectedDate, "dd MMM yyyy", { locale: ru })}`,
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
    // Managers can delete any report, baristas can only delete draft reports
    if (!reportId && role === "barista" && Object.keys(reportItems).length === 0) {
      toast({
        title: "Информация",
        description: "Нет черновика для удаления",
      });
      return;
    }

    if (reportId) {
      // Delete submitted report (only managers can do this)
      if (role !== "manager" && isLocked) return;
      
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
      } catch (error) {
        console.error("Error deleting report:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось удалить отчёт",
          variant: "destructive",
        });
      }
    } else {
      // Clear draft data
      if (!confirm("Вы уверены, что хотите очистить черновик?")) {
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

  const groupedPositions = positions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  // Calculate progress
  const totalPositions = positions.length;
  const filledPositions = Object.values(reportItems).filter(
    item => item.ending_stock > 0 || item.write_off > 0
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

      {/* Progress Bar */}
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
              Этот отчёт заблокирован и не может быть изменён или удалён.
            </p>
          )}
          {isLocked && role === "manager" && (
            <p className="mt-2 text-sm text-warning">
              Этот отчёт заблокирован. Вы можете разблокировать его для редактирования.
            </p>
          )}
          {!reportId && role === "barista" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Заполните данные и нажмите "Отправить отчёт" для сохранения.
            </p>
          )}
          {reportId && isLocked && role === "barista" && (
            <p className="mt-2 text-sm text-destructive">
              Этот отчёт заблокирован и не может быть изменён.
            </p>
          )}
          {reportId && isLocked && role === "manager" && (
            <p className="mt-2 text-sm text-warning">
              Этот отчёт заблокирован. Изменения сохраняются автоматически.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(groupedPositions).map(([category, categoryPositions]) => {
          const categoryFilled = categoryPositions.filter(pos => {
            const item = reportItems[pos.id];
            return item && (item.ending_stock > 0 || item.write_off > 0);
          }).length;
          const isOpen = openCategories[category] !== false; // default to open

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

                        return (
                          <PositionCard
                            key={position.id}
                            position={position}
                            endingStock={item.ending_stock}
                            writeOff={item.write_off}
                            disabled={isLocked && role !== "manager"}
                            onChange={(field, value) => handleInputChange(position.id, field, value)}
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
        <div className="hidden md:flex mt-6 gap-2 justify-end">
          <Button 
            variant="destructive"
            onClick={handleDeleteReport}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Очистить черновик
          </Button>
          <Button 
            onClick={handleSubmitReport}
            disabled={submitting || filledPositions === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Отправка..." : "Отправить отчёт"}
          </Button>
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
