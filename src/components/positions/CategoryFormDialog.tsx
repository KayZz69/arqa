import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

type CategoryForm = {
  name: string;
  sort_order: number;
  active: boolean;
};

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory: { id: string } | null;
  formData: CategoryForm;
  onFormDataChange: (data: CategoryForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onOpenNew: () => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
  formData,
  onFormDataChange,
  onSubmit,
  onClose,
  onOpenNew,
}: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить категорию
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Редактировать категорию" : "Добавить категорию"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Обновите название и настройки категории" : "Создайте новую категорию для позиций"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Название</Label>
              <Input
                id="cat-name"
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                placeholder="например, Напитки"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-order">Порядок сортировки</Label>
              <Input
                id="cat-order"
                type="number"
                min="0"
                value={formData.sort_order}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  sort_order: parseInt(e.target.value) || 0,
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Активна</Label>
              <Switch
                id="cat-active"
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
              {editingCategory ? "Обновить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
