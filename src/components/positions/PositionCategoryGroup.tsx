import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  active: boolean;
  min_stock: number;
  order_quantity: number;
  created_at: string;
  updated_at: string;
};

interface PositionCategoryGroupProps {
  category: string;
  positions: Position[];
  onInlineUpdate: (positionId: string, field: 'min_stock' | 'order_quantity' | 'active', value: number | boolean) => void;
  onEditPosition: (position: Position) => void;
}

export function PositionCategoryGroup({
  category,
  positions,
  onInlineUpdate,
  onEditPosition,
}: PositionCategoryGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{category}</CardTitle>
        <CardDescription>{positions.length} позиций</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Единица</TableHead>
              <TableHead>Мин. остаток</TableHead>
              <TableHead>Заказ</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">{position.name}</TableCell>
                <TableCell>{position.unit}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8 text-center"
                    value={position.min_stock}
                    onChange={(e) => onInlineUpdate(
                      position.id,
                      'min_stock',
                      parseFloat(e.target.value) || 0
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8 text-center"
                    value={position.order_quantity}
                    onChange={(e) => onInlineUpdate(
                      position.id,
                      'order_quantity',
                      parseFloat(e.target.value) || 0
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={position.active}
                    onCheckedChange={(checked) => onInlineUpdate(
                      position.id,
                      'active',
                      checked
                    )}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditPosition(position)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
