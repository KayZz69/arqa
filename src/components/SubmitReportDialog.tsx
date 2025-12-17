import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, AlertTriangle, Send, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportSummary {
  filledPositions: number;
  totalPositions: number;
  totalWriteOff: number;
  anomaliesCount: number;
}

interface SubmitReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  summary: ReportSummary;
  submitting: boolean;
}

export function SubmitReportDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
  submitting,
}: SubmitReportDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleConfirm = () => {
    onConfirm();
  };

  const progressPercent = summary.totalPositions > 0 
    ? Math.round((summary.filledPositions / summary.totalPositions) * 100) 
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 animate-scale-in">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary animate-fade-in" />
            </div>
            <AlertDialogTitle className="text-center mb-2">
              Отчёт отправлен!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Менеджер получит уведомление
            </AlertDialogDescription>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Отправить отчёт?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Проверьте сводку перед отправкой
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Progress */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Заполнено позиций</span>
                </div>
                <span className="font-semibold">
                  {summary.filledPositions} из {summary.totalPositions}
                  <span className="text-muted-foreground ml-1">({progressPercent}%)</span>
                </span>
              </div>

              {/* Total write-off */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Общее списание</span>
                <span className="font-semibold">{summary.totalWriteOff}</span>
              </div>

              {/* Anomalies warning */}
              {summary.anomaliesCount > 0 && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">
                    {summary.anomaliesCount} позиц{summary.anomaliesCount === 1 ? "ия" : summary.anomaliesCount < 5 ? "ии" : "ий"} с высоким списанием
                  </span>
                </div>
              )}
            </div>

            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel disabled={submitting}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirm}
                disabled={submitting}
                className="min-h-[44px]"
              >
                {submitting ? (
                  "Отправка..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить отчёт
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
