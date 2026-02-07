import { Button } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { ArrowLeft, Trash2, Lock, Unlock } from "lucide-react";

interface ReportHeaderProps {
  role: string | null;
  isLocked: boolean;
  reportId: string | null;
  filledPositions: number;
  totalPositions: number;
  hiddenPositionsCount: number;
  prefillableCount: number;
  reportStatus: string;
  onNavigateHome: () => void;
  onPrefill: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

export function ReportHeader({
  role,
  isLocked,
  reportId,
  filledPositions,
  totalPositions,
  hiddenPositionsCount,
  prefillableCount,
  reportStatus,
  onNavigateHome,
  onPrefill,
  onToggleLock,
  onDelete,
}: ReportHeaderProps) {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onNavigateHome}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">Ежедневный отчёт</h1>
            <ReportStatusBadge status={reportStatus} />
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
            onClick={onPrefill}
            disabled={prefillableCount === 0}
          >
            Prefill from yesterday
          </Button>
        )}
        {reportId && role === "manager" && (
          <Button
            variant={isLocked ? "outline" : "secondary"}
            size="sm"
            onClick={onToggleLock}
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
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Удалить</span>
          </Button>
        )}
      </div>
    </div>
  );
}
