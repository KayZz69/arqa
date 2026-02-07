import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PositionCard } from "@/components/PositionCard";
import { ChevronDown, ChevronUp, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Position, ReportItem, PreviousDayData } from "@/services/reportValidation";

interface CategorySectionProps {
  category: string;
  positions: Position[];
  reportItems: Record<string, ReportItem>;
  previousDayData: Record<string, PreviousDayData>;
  isOpen: boolean;
  allFilled: boolean;
  filledCount: number;
  role: string | null;
  isLocked: boolean;
  onToggle: () => void;
  onInputChange: (positionId: string, value: string) => void;
  calculateWriteOff: (positionId: string, endingStock: number) => number;
}

export function CategorySection({
  category,
  positions,
  reportItems,
  previousDayData,
  isOpen,
  allFilled,
  filledCount,
  role,
  isLocked,
  onToggle,
  onInputChange,
  calculateWriteOff,
}: CategorySectionProps) {
  return (
    <Card className={cn(
      "transition-all",
      allFilled && "border-primary/30"
    )}>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CardHeader className="cursor-pointer" onClick={onToggle}>
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
                {filledCount}/{positions.length}
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
              {positions.map(position => {
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
                    onChange={(value) => onInputChange(position.id, value)}
                  />
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
