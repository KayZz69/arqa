import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { ExcelImport } from "@/components/ExcelImport";

interface BatchItem {
  positionId: string;
  quantity: string;
  costPerUnit: string;
}

interface Position {
  id: string;
  name: string;
  category: string;
}

interface AddBatchTabProps {
  positions: Position[];
  arrivalDate: string;
  onArrivalDateChange: (value: string) => void;
  batchItems: BatchItem[];
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, field: keyof BatchItem, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onImportComplete: () => void;
}

export function AddBatchTab({
  positions,
  arrivalDate,
  onArrivalDateChange,
  batchItems,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSubmit,
  submitting,
  onImportComplete,
}: AddBatchTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Добавить приход
        </CardTitle>
        <CardDescription>Добавить несколько позиций в одну партию поставки</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arrival">Дата прибытия</Label>
            <Input
              id="arrival"
              type="date"
              value={arrivalDate}
              onChange={(e) => onArrivalDateChange(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Позиции</Label>
            {batchItems.map((item, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Позиция {index + 1}</span>
                  {batchItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Select value={item.positionId} onValueChange={(value) => onUpdateItem(index, "positionId", value)}>
                  <SelectTrigger><SelectValue placeholder="Выберите позицию" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.category} - {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => onUpdateItem(index, "quantity", e.target.value)}
                  placeholder="Количество"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costPerUnit}
                  onChange={(e) => onUpdateItem(index, "costPerUnit", e.target.value)}
                  placeholder="Себестоимость за единицу (₸)"
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={onAddItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Добавить ещё позицию
            </Button>
          </div>

          <div className="pt-2 border-t">
            <ExcelImport
              positions={positions}
              onImportComplete={onImportComplete}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Сохранение..." : "Сохранить приход"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
