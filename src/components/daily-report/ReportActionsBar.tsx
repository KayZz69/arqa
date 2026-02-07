import { Button } from "@/components/ui/button";
import { Trash2, Send } from "lucide-react";

interface ReportActionsBarProps {
  role: string | null;
  isLocked: boolean;
  submitting: boolean;
  filledPositions: number;
  reportItemsCount: number;
  onSubmit: () => void;
  onDelete: () => void;
}

export function ReportActionsBar({
  role,
  isLocked,
  submitting,
  filledPositions,
  reportItemsCount,
  onSubmit,
  onDelete,
}: ReportActionsBarProps) {
  if (role !== "barista" || isLocked) return null;

  return (
    <>
      {/* Desktop Submit Button */}
      <div className="hidden md:block mt-6">
        {filledPositions === 0 && (
          <p className="text-sm text-muted-foreground text-right mb-2">
            Заполните хотя бы одну позицию
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={reportItemsCount === 0}
            className="min-h-[44px]"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Очистить черновик
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || filledPositions === 0}
            size="lg"
            className="min-h-[44px]"
          >
            <Send className="h-4 w-4 mr-2" />
            Отправить отчёт
          </Button>
        </div>
      </div>

      {/* Sticky Submit Button (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t p-4 md:hidden safe-area-bottom">
        <div className="flex gap-2">
          <Button
            className="flex-1 min-h-[52px] text-base"
            size="lg"
            onClick={onSubmit}
            disabled={submitting || filledPositions === 0}
          >
            <Send className="h-5 w-5 mr-2" />
            Отправить отчёт
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={onDelete}
            className="min-h-[52px] min-w-[52px]"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );
}
