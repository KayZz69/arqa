import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PositionCardProps {
  position: {
    id: string;
    name: string;
    unit: string;
  };
  endingStock: number;
  writeOff: number;
  disabled: boolean;
  onChange: (field: "ending_stock" | "write_off", value: string) => void;
}

export function PositionCard({
  position,
  endingStock,
  writeOff,
  disabled,
  onChange,
}: PositionCardProps) {
  const isFilled = endingStock > 0 || writeOff > 0;

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-lg transition-all",
        isFilled && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2">
        {isFilled && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
        <div>
          <Label className="font-semibold">{position.name}</Label>
          <p className="text-sm text-muted-foreground">{position.unit}</p>
        </div>
      </div>
      <div>
        <Label>Остаток на конец дня</Label>
        <div className="flex items-center gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("ending_stock", Math.max(0, endingStock - 1).toString())}
            disabled={disabled || endingStock <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center py-2 px-4 border rounded-md bg-background font-semibold">
            {endingStock}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("ending_stock", (endingStock + 1).toString())}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div>
        <Label>Списание</Label>
        <div className="flex items-center gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("write_off", Math.max(0, writeOff - 1).toString())}
            disabled={disabled || writeOff <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center py-2 px-4 border rounded-md bg-background font-semibold">
            {writeOff}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("write_off", (writeOff + 1).toString())}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
