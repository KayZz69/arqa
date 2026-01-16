import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ArrowLeft, Trash2, Send, Lock, Unlock, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { PositionCard } from "@/components/PositionCard";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SubmitReportDialog } from "@/components/SubmitReportDialog";
import { AddPositionDialog } from "@/components/AddPositionDialog";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { DailyReportSkeleton } from "@/components/DailyReportSkeleton";
import { cn } from "@/lib/utils";
import { applyPrefillFromYesterday, getPrefillableCount } from "@/lib/reportPrefill";
import {
  reportItemSchema,
  type Position,
  type ReportItem,
  type PreviousDayData,
  calculateWriteOff as calcWriteOff,
  isCategoryFilled as checkCategoryFilled,
  getReportStatus,
  calculateReportSummary,
} from "@/services/reportValidation";
import {
  checkLowStockAndNotify,
  checkHighWriteOffAndNotify,
  notifyReportSubmitted,
} from "@/services/stockNotifications";


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
  const [previousReportItems, setPreviousReportItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [manuallyAddedPositions, setManuallyAddedPositions] = useState<string[]>([]);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    setPreviousReportItems(prevItems);

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
        .select("id, is_locked")
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
          .select("id, position_id, ending_stock, write_off")
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

  // Refresh function for pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (positions.length > 0) {
      await Promise.all([
        fetchReport(selectedDate),
        fetchPreviousDayData(selectedDate, positions.map(p => p.id)),
      ]);
      toast({
        title: "Данные обновлены",
        description: "Отчёт успешно обновлён",
      });
    }
  }, [selectedDate, positions, fetchReport, fetchPreviousDayData, toast]);

  // Pull-to-refresh hook
  const {
    containerRef,
    pullDistance,
    isRefreshing,
    progress,
    shouldTrigger,
  } = usePullToRefresh({ onRefresh: handleRefresh });

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

  const scheduleSaveReportItem = useCallback((positionId: string, endingStock: number, writeOff: number) => {
    const timeoutKey = `${positionId}`;
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
    }
    saveTimeouts.current[timeoutKey] = setTimeout(() => {
      saveReportItem(positionId, endingStock, writeOff);
    }, 600);
  }, [saveReportItem]);

  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  const handleInputChange = (positionId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const calculatedWriteOff = calculateWriteOff(positionId, numValue);

    setReportItems(prev => {
      const current = prev[positionId] || { position_id: positionId, ending_stock: 0, write_off: 0 };
      const updated = { ...current, ending_stock: numValue, write_off: calculatedWriteOff };

      // For managers editing locked reports, save immediately
      if (reportId && isLocked && role === "manager") {
        scheduleSaveReportItem(positionId, numValue, calculatedWriteOff);
      }

      return { ...prev, [positionId]: updated };
    });
  };

  const handlePrefillFromYesterday = () => {
    if (isLocked && role !== "manager") return;
    if (prefillableCount === 0) {
      toast({
        title: "Nothing to prefill",
        description: "No previous report data found for these positions.",
      });
      return;
    }

    setReportItems((prev) => applyPrefillFromYesterday({
      reportItems: prev,
      previousItems: previousReportItems,
      previousDayData,
      positions: visiblePositions,
    }));

    toast({
      title: "Prefilled",
      description: `Added ${prefillableCount} item${prefillableCount === 1 ? "" : "s"} from yesterday.`,
    });
  };



  const openSubmitDialog = () => {
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

    setShowSubmitDialog(true);
  };

  const handleSubmitReport = async () => {
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

      // Check for low stock and high write-offs using imported services
      await checkLowStockAndNotify(itemsToInsert, positions);
      await checkHighWriteOffAndNotify(itemsToInsert, positions, previousDayData);

      // Send notification to managers about report
      await notifyReportSubmitted(
        currentReportId!,
        user?.email || "Unknown",
        format(selectedDate, "dd MMM yyyy", { locale: ru })
      );

      setIsLocked(true);
      setShowSubmitDialog(false);

      // Haptic feedback on success
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 100]);
      }

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

  // Filter positions for baristas - hide positions without stock (unless manually added)
  const visiblePositions = role === "manager"
    ? positions
    : positions.filter(position => {
      // Always show manually added positions
      if (manuallyAddedPositions.includes(position.id)) return true;
      const prev = previousDayData[position.id];
      if (!prev) return false; // Hide positions without previous data
      // Show if there's previous stock OR arrivals today
      return prev.ending_stock > 0 || prev.arrivals > 0;
    });

  // Hidden positions for the add dialog (positions with zero stock OR no previous data)
  const hiddenPositions = positions.filter(position => {
    if (manuallyAddedPositions.includes(position.id)) return false;
    const prev = previousDayData[position.id];
    if (!prev) return true; // Include positions without previous data
    return prev.ending_stock === 0 && prev.arrivals === 0;
  });

  const hiddenPositionsCount = hiddenPositions.length;

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

  const prefillableCount = useMemo(() => getPrefillableCount({
    reportItems,
    previousItems: previousReportItems,
    positions: visiblePositions,
  }), [reportItems, previousReportItems, visiblePositions]);

  // Calculate report summary for dialog
  const reportSummary = useMemo(() => {
    const items = Object.values(reportItems);
    const totalWriteOff = items.reduce((sum, item) => {
      const writeOff = calculateWriteOff(item.position_id, item.ending_stock);
      return sum + writeOff;
    }, 0);

    const anomaliesCount = items.filter(item => {
      const prev = previousDayData[item.position_id];
      if (!prev) return false;
      const writeOff = calculateWriteOff(item.position_id, item.ending_stock);
      const expectedUsage = prev.ending_stock + prev.arrivals;
      return writeOff > expectedUsage * 0.5 && writeOff > 2;
    }).length;

    return {
      filledPositions,
      totalPositions,
      totalWriteOff,
      anomaliesCount,
    };
  }, [reportItems, previousDayData, filledPositions, totalPositions]);

  // Check if a category is fully filled
  const isCategoryFilled = useCallback((categoryPositions: Position[]) => {
    return categoryPositions.every(pos => {
      const item = reportItems[pos.id];
      return item && item.ending_stock > 0;
    });
  }, [reportItems]);

  // Auto-collapse filled categories
  useEffect(() => {
    if (role !== "barista") return;

    Object.entries(groupedPositions).forEach(([category, categoryPositions]) => {
      const allFilled = isCategoryFilled(categoryPositions);
      // Only auto-collapse if not manually set and all filled
      if (allFilled && openCategories[category] === undefined) {
        setOpenCategories(prev => ({ ...prev, [category]: false }));
      }
    });
  }, [reportItems, groupedPositions, role, isCategoryFilled]);

  const getReportStatus = () => {
    if (!reportId) return "draft";
    if (isLocked) return "submitted";
    return "draft";
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  if (roleLoading || loading) {
    return <DailyReportSkeleton />;
  }

  if (role !== "barista" && role !== "manager") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Доступ запрещён.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="container mx-auto p-4 md:p-6 pb-24 md:pb-6 min-h-screen overflow-auto animate-fade-in"
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />
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
          {role === "barista" && !isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrefillFromYesterday}
              disabled={prefillableCount === 0}
            >
              Prefill from yesterday
            </Button>
          )}
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
          const categoryFilledCount = categoryPositions.filter(pos => {
            const item = reportItems[pos.id];
            return item && item.ending_stock > 0;
          }).length;
          const allFilled = isCategoryFilled(categoryPositions);
          const isOpen = openCategories[category] !== false;

          return (
            <Card key={category} className={cn(
              "transition-all",
              allFilled && "border-primary/30"
            )}>
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category)}>
                <CardHeader className="cursor-pointer" onClick={() => toggleCategory(category)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {!allFilled && role === "barista" && (
                        <Circle className="h-2 w-2 fill-amber-500 text-amber-500 shrink-0" />
                      )}
                      <CardTitle>{category}</CardTitle>
                      <span className={cn(
                        "text-sm",
                        allFilled ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {categoryFilledCount}/{categoryPositions.length}
                      </span>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent className="animate-accordion-down">
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

        {/* Add Position Button for Baristas - outside categories */}
        {role === "barista" && !isLocked && hiddenPositions.length > 0 && (
          <AddPositionDialog
            hiddenPositions={hiddenPositions}
            onAddPositions={(ids) => setManuallyAddedPositions(prev => [...prev, ...ids])}
          />
        )}
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
              className="min-h-[44px]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Очистить черновик
            </Button>
            <Button
              onClick={openSubmitDialog}
              disabled={submitting || filledPositions === 0}
              size="lg"
              className="min-h-[44px]"
            >
              <Send className="h-4 w-4 mr-2" />
              Отправить отчёт
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Submit Button for Baristas (Mobile) */}
      {role === "barista" && !isLocked && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t p-4 md:hidden safe-area-bottom">
          <div className="flex gap-2">
            <Button
              className="flex-1 min-h-[52px] text-base"
              size="lg"
              onClick={openSubmitDialog}
              disabled={submitting || filledPositions === 0}
            >
              <Send className="h-5 w-5 mr-2" />
              Отправить отчёт
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={handleDeleteReport}
              className="min-h-[52px] min-w-[52px]"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Submit Report Dialog */}
      <SubmitReportDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onConfirm={handleSubmitReport}
        summary={reportSummary}
        submitting={submitting}
      />
    </div>
  );
}
