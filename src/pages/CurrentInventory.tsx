import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Package, AlertTriangle } from "lucide-react";
import { format, addDays } from "date-fns";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
}

interface BatchInfo {
  arrival_date: string;
  expiry_date: string | null;
  quantity: number;
}

interface InventoryLevel {
  position: Position;
  totalBatches: number;
  totalWriteOffs: number;
  latestEndingStock: number | null;
  calculatedInventory: number;
  batches: BatchInfo[];
}

export default function CurrentInventory() {
  const navigate = useNavigate();
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryLevels();
  }, []);

  const fetchInventoryLevels = async () => {
    try {
      // Fetch all active positions
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (positionsError) throw positionsError;

      // Calculate inventory levels for each position
      const levels: InventoryLevel[] = await Promise.all(
        (positions || []).map(async (position) => {
          // Get batch quantities with dates
          const { data: batches } = await supabase
            .from("inventory_batches")
            .select("quantity, arrival_date, expiry_date")
            .eq("position_id", position.id);

          const totalBatches =
            batches?.reduce((sum, batch) => sum + Number(batch.quantity), 0) ||
            0;

          // Get total write-offs
          const { data: writeOffs } = await supabase
            .from("report_items")
            .select("write_off")
            .eq("position_id", position.id);

          const totalWriteOffs =
            writeOffs?.reduce(
              (sum, item) => sum + Number(item.write_off),
              0
            ) || 0;

          // Get the most recent ending stock
          const { data: latestReport } = await supabase
            .from("report_items")
            .select("ending_stock, created_at")
            .eq("position_id", position.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const latestEndingStock = latestReport
            ? Number(latestReport.ending_stock)
            : null;

          // Calculate current inventory
          // Logic: Start with batches, subtract write-offs, use latest ending stock if available
          const calculatedInventory =
            latestEndingStock !== null
              ? latestEndingStock
              : totalBatches - totalWriteOffs;

          return {
            position,
            totalBatches,
            totalWriteOffs,
            latestEndingStock,
            calculatedInventory,
            batches: batches || [],
          };
        })
      );

      setInventoryLevels(levels);
    } catch (error) {
      console.error("Error fetching inventory levels:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory levels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInventoryStatus = (level: number): "low" | "medium" | "good" => {
    if (level <= 0) return "low";
    if (level < 10) return "medium";
    return "good";
  };

  const getStatusColor = (
    status: "low" | "medium" | "good"
  ): "destructive" | "default" | "secondary" => {
    switch (status) {
      case "low":
        return "destructive";
      case "medium":
        return "default";
      case "good":
        return "secondary";
    }
  };

  const getBatchExpiryStatus = (batches: BatchInfo[]) => {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    let hasExpired = false;
    let hasExpiring = false;
    
    for (const batch of batches) {
      if (batch.expiry_date) {
        const expiryDate = new Date(batch.expiry_date);
        if (expiryDate < now) hasExpired = true;
        else if (expiryDate <= oneDayFromNow) hasExpiring = true;
      }
    }
    
    return { hasExpired, hasExpiring };
  };

  // Group by category
  const groupedInventory = inventoryLevels.reduce(
    (acc, item) => {
      const category = item.position.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, InventoryLevel[]>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-8 w-8" />
              Текущий инвентарь
            </h1>
            <p className="text-muted-foreground">
              Уровни запасов в реальном времени на основе партий, отчётов и списаний
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedInventory).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  Текущие уровни запасов для позиций категории {category.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Позиция</TableHead>
                        <TableHead className="text-right">
                          Всего в партиях
                        </TableHead>
                        <TableHead className="text-right">
                          Всего списаний
                        </TableHead>
                        <TableHead className="text-right">
                          Последний остаток
                        </TableHead>
                        <TableHead className="text-right">
                          Текущий уровень
                        </TableHead>
                        <TableHead className="text-right">Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const status = getInventoryStatus(
                          item.calculatedInventory
                        );
                        const { hasExpired, hasExpiring } = getBatchExpiryStatus(item.batches);
                        
                        return (
                          <TableRow key={item.position.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {item.position.name}
                                {(hasExpired || hasExpiring) && (
                                  <AlertTriangle 
                                    className={`h-4 w-4 ${hasExpired ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-500'}`}
                                  />
                                )}
                              </div>
                              {hasExpired && (
                                <p className="text-xs text-destructive">Обнаружена истёкшая партия</p>
                              )}
                              {!hasExpired && hasExpiring && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-500">Истекает в течение 24ч</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.totalBatches.toFixed(2)}{" "}
                              {item.position.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.totalWriteOffs.toFixed(2)}{" "}
                              {item.position.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.latestEndingStock !== null
                                ? `${item.latestEndingStock.toFixed(2)} ${item.position.unit}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.calculatedInventory.toFixed(2)}{" "}
                              {item.position.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={getStatusColor(status)}>
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
