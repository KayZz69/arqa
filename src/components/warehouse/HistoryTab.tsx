import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface InventoryBatch {
  id: string;
  position_id: string;
  quantity: number;
  cost_per_unit: number;
  arrival_date: string;
  expiry_date: string | null;
  created_at: string;
  positions: {
    id: string;
    name: string;
    category: string;
    unit: string;
    shelf_life_days: number | null;
  };
}

interface HistoryTabProps {
  batches: InventoryBatch[];
  filteredBatches: InventoryBatch[];
  batchSearch: string;
  onBatchSearchChange: (value: string) => void;
  onDeleteBatch: (batchId: string) => void;
  getExpiryStatus: (batch: InventoryBatch) => string;
  calculateExpiryDate: (arrivalDate: string, shelfLifeDays: number | null) => string | null;
  paginationControls?: React.ReactNode;
  paginatedBatches?: InventoryBatch[];
}

export function HistoryTab({
  batches,
  filteredBatches,
  batchSearch,
  onBatchSearchChange,
  onDeleteBatch,
  getExpiryStatus,
  calculateExpiryDate,
  paginationControls,
  paginatedBatches,
}: HistoryTabProps) {
  const displayBatches = paginatedBatches || filteredBatches;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          История поставок
        </CardTitle>
        <CardDescription>Все поставки, отсортированные по дате прибытия</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Input
            value={batchSearch}
            onChange={(e) => onBatchSearchChange(e.target.value)}
            placeholder="Поиск поставок"
            className="max-w-xs"
          />
        </div>
        {batches.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Нет записей о поставках</p>
        ) : filteredBatches.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Нет результатов по вашему запросу.</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Позиция</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Себест.</TableHead>
                    <TableHead className="text-right">Прибытие</TableHead>
                    <TableHead className="text-right">Годен до</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayBatches.map((batch) => {
                    const expiryStatus = getExpiryStatus(batch);
                    const expiryDateStr = batch.expiry_date || (batch.positions?.shelf_life_days
                      ? calculateExpiryDate(batch.arrival_date, batch.positions.shelf_life_days)
                      : null);
                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="font-medium">{batch.positions?.name}</div>
                          <div className="text-xs text-muted-foreground">{batch.positions?.category}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.quantity} {batch.positions?.unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {batch.cost_per_unit > 0 ? `${batch.cost_per_unit}₸` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {format(new Date(batch.arrival_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {expiryDateStr ? (
                            <Badge variant={expiryStatus === "expired" ? "destructive" : expiryStatus === "expiring" ? "default" : "secondary"}>
                              {format(new Date(expiryDateStr), "dd.MM.yyyy")}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => onDeleteBatch(batch.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {paginationControls}
          </>
        )}
      </CardContent>
    </Card>
  );
}
