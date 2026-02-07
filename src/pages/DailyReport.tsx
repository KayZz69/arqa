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
import { CalendarIcon } from "lucide-react";
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
import { ReportHeader } from "@/components/daily-report/ReportHeader";
import { ReportProgressCard } from "@/components/daily-report/ReportProgressCard";
import { CategorySection } from "@/components/daily-report/CategorySection";
import { ReportActionsBar } from "@/components/daily-report/ReportActionsBar";


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

      const { error: lockError } = await supabase
        .from("daily_reports")
        .update({ is_locked: true })
        .eq("id", currentReportId);

      if (lockError) throw lockError;

      await checkLowStockAndNotify(itemsToInsert, positions);
      await checkHighWriteOffAndNotify(itemsToInsert, positions, previousDayData);

      await notifyReportSubmitted(
        currentReportId!,
        user?.email || "Unknown",
        format(selectedDate, "dd MMM yyyy", { locale: ru })
      );

      setIsLocked(true);
      setShowSubmitDialog(false);

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

  // Filter positions for baristas
  const visiblePositions = role === "manager"
    ? positions
    : positions.filter(position => {
      if (manuallyAddedPositions.includes(position.id)) return true;
      const prev = previousDayData[position.id];
      if (!prev) return false;
      return prev.ending_stock > 0 || prev.arrivals > 0;
    });

  const hiddenPositions = positions.filter(position => {
    if (manuallyAddedPositions.includes(position.id)) return false;
    const prev = previousDayData[position.id];
    if (!prev) return true;
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
      if (allFilled && openCategories[category] === undefined) {
        setOpenCategories(prev => ({ ...prev, [category]: false }));
      }
    });
  }, [reportItems, groupedPositions, role, isCategoryFilled]);

  const getReportStatusLocal = () => {
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

      <ReportHeader
        role={role}
        isLocked={isLocked}
        reportId={reportId}
        filledPositions={filledPositions}
        totalPositions={totalPositions}
        hiddenPositionsCount={hiddenPositionsCount}
        prefillableCount={prefillableCount}
        reportStatus={getReportStatusLocal()}
        onNavigateHome={() => navigate("/")}
        onPrefill={handlePrefillFromYesterday}
        onToggleLock={handleToggleLock}
        onDelete={handleDeleteReport}
      />

      {totalPositions > 0 && (
        <ReportProgressCard progressPercentage={progressPercentage} />
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
            <CategorySection
              key={category}
              category={category}
              positions={categoryPositions}
              reportItems={reportItems}
              previousDayData={previousDayData}
              isOpen={isOpen}
              allFilled={allFilled}
              filledCount={categoryFilledCount}
              role={role}
              isLocked={isLocked}
              onToggle={() => toggleCategory(category)}
              onInputChange={handleInputChange}
              calculateWriteOff={calculateWriteOff}
            />
          );
        })}

        {role === "barista" && !isLocked && hiddenPositions.length > 0 && (
          <AddPositionDialog
            hiddenPositions={hiddenPositions}
            onAddPositions={(ids) => setManuallyAddedPositions(prev => [...prev, ...ids])}
          />
        )}
      </div>

      <ReportActionsBar
        role={role}
        isLocked={isLocked}
        submitting={submitting}
        filledPositions={filledPositions}
        reportItemsCount={Object.keys(reportItems).length}
        onSubmit={openSubmitDialog}
        onDelete={handleDeleteReport}
      />

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
