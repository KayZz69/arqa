import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Plus, Minus, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface PositionCardProps {
  position: {
    id: string;
    name: string;
    unit: string;
  };
  endingStock: number;
  previousStock: number;
  arrivals: number;
  calculatedWriteOff: number;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function PositionCard({
  position,
  endingStock,
  previousStock,
  arrivals,
  calculatedWriteOff,
  disabled,
  onChange,
}: PositionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(endingStock.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isFilled = endingStock > 0;
  const hasAnomaly = calculatedWriteOff < 0 || calculatedWriteOff > (previousStock + arrivals) * 0.5;

  // Sync inputValue with endingStock when it changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(endingStock.toString());
    }
  }, [endingStock, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNumberClick = () => {
    if (disabled) return;
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = parseFloat(inputValue) || 0;
    onChange(Math.max(0, numValue).toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
    }
    if (e.key === "Escape") {
      setInputValue(endingStock.toString());
      setIsEditing(false);
    }
  };

  const handleIncrement = () => {
    if (disabled) return;
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onChange((endingStock + 1).toString());
  };

  const handleDecrement = () => {
    if (disabled || endingStock <= 0) return;
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onChange(Math.max(0, endingStock - 1).toString());
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg transition-all",
        isFilled && "border-primary bg-primary/5",
        hasAnomaly && calculatedWriteOff > 0 && "border-destructive bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-2">
        {isFilled && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
        <div>
          <Label className="font-semibold">{position.name}</Label>
          <p className="text-sm text-muted-foreground">{position.unit}</p>
        </div>
      </div>
      
      {/* Previous stock info */}
      <div className="text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>Было: {previousStock}</span>
          {arrivals > 0 && <span className="text-primary">+{arrivals}</span>}
        </div>
      </div>
      
      {/* Ending stock input */}
      <div>
        <Label>Остаток сейчас</Label>
        <div className="flex items-center gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 min-w-[44px] min-h-[44px] p-0"
            onClick={handleDecrement}
            disabled={disabled || endingStock <= 0}
          >
            <Minus className="h-5 w-5" />
          </Button>
          
          {isEditing ? (
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="flex-1 text-center py-2 px-4 font-semibold h-11 min-h-[44px]"
            />
          ) : (
            <div 
              className={cn(
                "flex-1 text-center py-2 px-4 border rounded-md bg-background font-semibold h-11 min-h-[44px] flex items-center justify-center cursor-pointer transition-colors",
                !disabled && "hover:bg-accent hover:border-primary active:scale-95"
              )}
              onClick={handleNumberClick}
            >
              {endingStock}
            </div>
          )}
          
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 min-w-[44px] min-h-[44px] p-0"
            onClick={handleIncrement}
            disabled={disabled}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Calculated write-off */}
      <div>
        <Label className="flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          Списание (авто)
        </Label>
        <div className={cn(
          "mt-2 py-2 px-4 border rounded-md text-center font-semibold h-11 min-h-[44px] flex items-center justify-center",
          calculatedWriteOff < 0 && "text-destructive border-destructive",
          hasAnomaly && calculatedWriteOff > 0 && "text-destructive border-destructive"
        )}>
          {calculatedWriteOff < 0 ? (
            <span className="text-sm">Ошибка: {calculatedWriteOff}</span>
          ) : (
            calculatedWriteOff
          )}
        </div>
        {hasAnomaly && calculatedWriteOff > 0 && (
          <p className="text-xs text-destructive mt-1">Высокое списание!</p>
        )}
      </div>
    </div>
  );
}
