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
import { ArrowLeft, Package, ShoppingCart } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
  last_cost: number;
}

interface InventoryLevel {
  position: Position;
  currentStock: number;
}

export default function CurrentInventory() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryLevels();
  }, []);

  const fetchInventoryLevels = async () => {
    try {
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (positionsError) throw positionsError;

      const levels: InventoryLevel[] = await Promise.all(
        (positions || []).map(async (position) => {
          const { data: latestReport } = await supabase
            .from("report_items")
            .select("ending_stock")
            .eq("position_id", position.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            position,
            currentStock: latestReport ? Number(latestReport.ending_stock) : 0,
          };
        })
      );

      setInventoryLevels(levels);
    } catch (error) {
      console.error("Error fetching inventory levels:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить инвентарь",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (currentStock: number, minStock: number): "critical" | "low" | "ok" => {
    if (currentStock <= 0) return "critical";
    if (currentStock < minStock) return "low";
    return "ok";
  };

  const getStatusLabel = (status: "critical" | "low" | "ok") => {
    switch (status) {
      case "critical": return "Критично";
      case "low": return "Мало";
      case "ok": return "Норма";
    }
  };

  const getStatusVariant = (status: "critical" | "low" | "ok"): "destructive" | "default" | "secondary" => {
    switch (status) {
      case "critical": return "destructive";
      case "low": return "default";
      case "ok": return "secondary";
    }
  };

  // Group by category
  const groupedInventory = inventoryLevels.reduce((acc, item) => {
    const category = item.position.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, InventoryLevel[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Текущий инвентарь
            </h1>
            <p className="text-muted-foreground">Остатки по всем позициям</p>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedInventory).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Позиция</TableHead>
                        <TableHead className="text-right">Остаток</TableHead>
                        <TableHead className="text-right">Стоимость</TableHead>
                        <TableHead className="text-right">Статус</TableHead>
                        {role === "manager" && <TableHead className="text-right">Действие</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const status = getStatus(item.currentStock, item.position.min_stock);
                        const stockValue = item.currentStock * (item.position.last_cost || 0);
                        return (
                          <TableRow key={item.position.id}>
                            <TableCell className="font-medium">{item.position.name}</TableCell>
                            <TableCell className="text-right">
                              {item.currentStock} {item.position.unit}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {stockValue > 0 ? `${stockValue.toLocaleString()}₸` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={getStatusVariant(status)}>
                                {getStatusLabel(status)}
                              </Badge>
                            </TableCell>
                            {role === "manager" && (
                              <TableCell className="text-right">
                                {status !== "ok" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate("/warehouse")}
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-1" />
                                    Заказать
                                  </Button>
                                )}
                              </TableCell>
                            )}
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
