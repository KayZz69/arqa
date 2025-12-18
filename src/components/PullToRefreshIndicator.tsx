import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  shouldTrigger: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  shouldTrigger,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-200"
      style={{ height: pullDistance }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 p-2 transition-all duration-200",
          shouldTrigger && "bg-primary/20",
          isRefreshing && "bg-primary/20"
        )}
        style={{
          transform: `scale(${0.5 + progress * 0.5}) rotate(${progress * 360}deg)`,
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        <RefreshCw
          className={cn(
            "h-5 w-5 text-primary transition-all",
            isRefreshing && "animate-spin"
          )}
        />
      </div>
      {!isRefreshing && pullDistance > 20 && (
        <span
          className="ml-2 text-xs text-muted-foreground transition-opacity"
          style={{ opacity: progress }}
        >
          {shouldTrigger ? "Отпустите для обновления" : "Потяните для обновления"}
        </span>
      )}
      {isRefreshing && (
        <span className="ml-2 text-xs text-primary animate-pulse">
          Обновление...
        </span>
      )}
    </div>
  );
}
