import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
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
        <Label htmlFor={`stock-${position.id}`}>Остаток на конец дня</Label>
        <Input
          id={`stock-${position.id}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={endingStock}
          onChange={(e) => onChange("ending_stock", e.target.value)}
          disabled={disabled}
          className="w-full"
        />
      </div>
      <div>
        <Label htmlFor={`writeoff-${position.id}`}>Списание</Label>
        <Input
          id={`writeoff-${position.id}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={writeOff}
          onChange={(e) => onChange("write_off", e.target.value)}
          disabled={disabled}
          className="w-full"
        />
      </div>
    </div>
  );
}
