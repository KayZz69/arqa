import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  report_date: string;
  is_locked: boolean;
  submitted_at: string;
};

export default function ReportHistory() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchReports();
  }, [selectedMonth]);

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("daily_reports")
        .select("id, report_date, is_locked, submitted_at")
        .eq("barista_id", user.id)
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd)
        .order("report_date", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const getReportByDate = (date: Date): Report | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reports.find(r => r.report_date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    navigate(`/daily-report?date=${format(date, "yyyy-MM-dd")}`);
  };

  const submittedDates = reports.filter(r => r.is_locked).map(r => new Date(r.report_date));
  const draftDates = reports.filter(r => !r.is_locked).map(r => new Date(r.report_date));

  return (
    <>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="mx-auto max-w-2xl p-4 md:p-8">
          <div className="mb-6 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">История отчётов</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => date && handleDateClick(date)}
                month={selectedMonth}
                onMonthChange={setSelectedMonth}
                locale={ru}
                className="pointer-events-auto mx-auto"
                modifiers={{
                  submitted: submittedDates,
                  draft: draftDates,
                }}
                modifiersClassNames={{
                  submitted: "bg-primary text-primary-foreground hover:bg-primary/90",
                  draft: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/50",
                }}
                disabled={(date) => date > new Date()}
              />
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Отправлен</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500/50 border border-amber-500" />
                  <span className="text-muted-foreground">Черновик</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Отчёты за {format(selectedMonth, "LLLL yyyy", { locale: ru })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Загрузка...</p>
              ) : reports.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Нет отчётов за этот месяц
                </p>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/daily-report?date=${report.report_date}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          {format(new Date(report.report_date), "d MMMM, EEEE", { locale: ru })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ReportStatusBadge status={report.is_locked ? "submitted" : "draft"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNavigation />
    </>
  );
}
