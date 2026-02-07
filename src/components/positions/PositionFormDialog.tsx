import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

const UNITS = ["кг", "л", "шт", "г", "мл", "уп"] as const;

type PositionForm = {
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  active: boolean;
  min_stock: number;
  order_quantity: number;
};

type Category = {
  id: string;
  name: string;
  active: boolean;
};

interface PositionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPosition: { id: string } | null;
  formData: PositionForm;
  onFormDataChange: (data: PositionForm) => void;
  activeCategories: Category[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onOpenNew: () => void;
}

export function PositionFormDialog({
  open,
  onOpenChange,
  editingPosition,
  formData,
  onFormDataChange,
  activeCategories,
  onSubmit,
  onClose,
  onOpenNew,
}: PositionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить позицию
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editingPosition ? "Редактировать позицию" : "Добавить новую позицию"}</DialogTitle>
            <DialogDescription>
              {editingPosition ? "Обновите детали позиции" : "Создать новую позицию инвентаря"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                placeholder="например, Молоко цельное"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Категория</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => onFormDataChange({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {activeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Единица измерения</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => onFormDataChange({ ...formData, unit: value })}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Выберите единицу" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shelf_life_days">Срок годности (дни)</Label>
              <Input
                id="shelf_life_days"
                type="number"
                min="0"
                value={formData.shelf_life_days ?? ""}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  shelf_life_days: e.target.value ? parseInt(e.target.value) : null,
                })}
                placeholder="Необязательно"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="min_stock">Мин. остаток</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    min_stock: parseFloat(e.target.value) || 0,
                  })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order_quantity">Кол-во заказа</Label>
                <Input
                  id="order_quantity"
                  type="number"
                  min="0"
                  value={formData.order_quantity}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    order_quantity: parseFloat(e.target.value) || 0,
                  })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Активна</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => onFormDataChange({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">
              {editingPosition ? "Обновить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
