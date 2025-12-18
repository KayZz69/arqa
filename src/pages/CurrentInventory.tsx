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

interface StockLevel {
  position_id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
  last_cost: number;
  current_stock: number;
}

export default function CurrentInventory() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockLevels();
  }, []);

  const fetchStockLevels = async () => {
    try {
      // Single optimized query using the database view
      const { data, error } = await supabase
        .from("current_stock_levels")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setStockLevels(data || []);
    } catch (error) {
      console.error("Error fetching stock levels:", error);
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
  const groupedInventory = stockLevels.reduce((acc, item) => {
    const category = item.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, StockLevel[]>);

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
                        {role === "manager" && <TableHead className="text-right">Стоимость</TableHead>}
                        <TableHead className="text-right">Статус</TableHead>
                        {role === "manager" && <TableHead className="text-right">Действие</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const status = getStatus(item.current_stock, item.min_stock);
                        const stockValue = item.current_stock * (item.last_cost || 0);
                        return (
                          <TableRow key={item.position_id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">
                              {item.current_stock} {item.unit}
                            </TableCell>
                            {role === "manager" && (
                              <TableCell className="text-right text-muted-foreground">
                                {stockValue > 0 ? `${stockValue.toLocaleString()}₸` : "—"}
                              </TableCell>
                            )}
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
