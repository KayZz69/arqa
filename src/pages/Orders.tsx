import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Check, Package } from "lucide-react";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
}

interface OrderItem {
  position: Position;
  currentStock: number;
  suggestedOrder: number;
}

export default function Orders() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      toast.error("Доступ запрещён. Требуется роль менеджера.");
      navigate("/");
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    fetchOrderNeeds();
  }, []);

  const fetchOrderNeeds = async () => {
    try {
      // Fetch all active positions with min_stock settings
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name");

      if (positionsError) throw positionsError;

      const items: OrderItem[] = [];

      for (const position of positions || []) {
        // Get the most recent ending stock
        const { data: latestReport } = await supabase
          .from("report_items")
          .select("ending_stock, created_at")
          .eq("position_id", position.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentStock = latestReport ? Number(latestReport.ending_stock) : 0;

        // Check if stock is below minimum
        if (currentStock < position.min_stock) {
          items.push({
            position,
            currentStock,
            suggestedOrder: position.order_quantity,
          });
        }
      }

      setOrderItems(items);
    } catch (error) {
      console.error("Error fetching order needs:", error);
      toast.error("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsOrdered = async (item: OrderItem) => {
    setOrdering(item.position.id);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      // Create inventory batch for the order
      const { error } = await supabase
        .from("inventory_batches")
        .insert({
          position_id: item.position.id,
          quantity: item.suggestedOrder,
          arrival_date: new Date().toISOString().split('T')[0],
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(`Заказ ${item.position.name} отмечен как выполненный`);
      
      // Refresh the list
      await fetchOrderNeeds();
    } catch (error) {
      console.error("Error marking as ordered:", error);
      toast.error("Не удалось сохранить заказ");
    } finally {
      setOrdering(null);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const groupedItems = orderItems.reduce((acc, item) => {
    const category = item.position.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Заказы
            </h1>
            <p className="text-muted-foreground">
              Позиции с низким остатком, требующие заказа
            </p>
          </div>
        </div>

        {orderItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Всё в порядке!</p>
              <p className="text-sm text-muted-foreground">
                Нет позиций, требующих заказа
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{orderItems.length}</Badge>
                  <span className="font-medium">
                    позиций требуют заказа
                  </span>
                </div>
              </CardContent>
            </Card>

            {Object.entries(groupedItems).map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>
                    {items.length} позиций с низким остатком
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Позиция</TableHead>
                        <TableHead className="text-right">Текущий остаток</TableHead>
                        <TableHead className="text-right">Мин. уровень</TableHead>
                        <TableHead className="text-right">Рекомендуемый заказ</TableHead>
                        <TableHead className="text-right">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.position.id}>
                          <TableCell className="font-medium">
                            {item.position.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-destructive font-semibold">
                              {item.currentStock} {item.position.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.position.min_stock} {item.position.unit}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            +{item.suggestedOrder} {item.position.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsOrdered(item)}
                              disabled={ordering === item.position.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {ordering === item.position.id ? "..." : "Заказано"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
