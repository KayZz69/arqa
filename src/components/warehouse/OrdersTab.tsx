import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShoppingCart } from "lucide-react";

interface OrderItem {
  position_id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
  last_cost: number | null;
  shelf_life_days: number | null;
  current_stock: number;
}

interface OrdersTabProps {
  orderItems: OrderItem[];
  filteredOrderItems: OrderItem[];
  orderSearch: string;
  onOrderSearchChange: (value: string) => void;
  onConfirmOrder: (item: OrderItem, arrivalDate: string, quantity: number, costPerUnit: number) => Promise<void>;
}

export function OrdersTab({
  orderItems,
  filteredOrderItems,
  orderSearch,
  onOrderSearchChange,
  onConfirmOrder,
}: OrdersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [arrivalDate, setArrivalDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");

  const openDialog = (item: OrderItem) => {
    setSelectedItem(item);
    setArrivalDate(new Date().toISOString().split("T")[0]);
    setQuantity(String(item.order_quantity || 0));
    setCostPerUnit(String(item.last_cost || ""));
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedItem) return;
    const qty = parseFloat(quantity);
    const cost = costPerUnit ? parseFloat(costPerUnit) : 0;
    await onConfirmOrder(selectedItem, arrivalDate, qty, cost);
    setDialogOpen(false);
    setSelectedItem(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Позиции для заказа
          </CardTitle>
          <CardDescription>Позиции с остатком ниже минимального уровня</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Input
              value={orderSearch}
              onChange={(e) => onOrderSearchChange(e.target.value)}
              placeholder="Поиск позиций"
              className="max-w-xs"
            />
          </div>
          {orderItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Все позиции в норме</p>
          ) : filteredOrderItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Нет результатов по вашему запросу.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Позиция</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Минимум</TableHead>
                    <TableHead className="text-right">Заказать</TableHead>
                    <TableHead className="text-right">~Сумма</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrderItems.map((item) => (
                    <TableRow key={item.position_id}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.category}</div>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {item.current_stock || 0} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.min_stock || 0} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.order_quantity || 0} {item.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(item.last_cost || 0) > 0
                          ? `~${((item.order_quantity || 0) * (item.last_cost || 0)).toLocaleString()}₸`
                          : "—"
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openDialog(item)}>
                          Оформить приход
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оформить приход</DialogTitle>
            <DialogDescription>
              {selectedItem?.name} — подтвердите дату, количество и себестоимость
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="order-arrival">Дата прибытия</Label>
              <Input
                id="order-arrival"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-qty">Количество ({selectedItem?.unit})</Label>
              <Input
                id="order-qty"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-cost">Себестоимость за единицу (₸)</Label>
              <Input
                id="order-cost"
                type="number"
                step="0.01"
                min="0"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleConfirm}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
