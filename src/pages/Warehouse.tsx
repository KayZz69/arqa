import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Plus, Trash2, X, ShoppingCart, Package, History } from "lucide-react";
import { format, addDays } from "date-fns";
import { ExcelImport } from "@/components/ExcelImport";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  min_stock: number;
  order_quantity: number;
  last_cost: number;
}

interface InventoryBatch {
  id: string;
  position_id: string;
  quantity: number;
  cost_per_unit: number;
  arrival_date: string;
  expiry_date: string | null;
  created_at: string;
  positions: Position;
}

interface BatchItem {
  positionId: string;
  quantity: string;
  costPerUnit: string;
}

interface OrderItem {
  position_id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
  last_cost: number;
  shelf_life_days: number | null;
  current_stock: number;
}

export default function Warehouse() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [positions, setPositions] = useState<Position[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [arrivalDate, setArrivalDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [batchItems, setBatchItems] = useState<BatchItem[]>([{ positionId: "", quantity: "", costPerUnit: "" }]);

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      navigate("/");
      return;
    }
    fetchData();
  }, [roleLoading, role, navigate]);

  const fetchData = async () => {
    try {
      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from("positions")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Fetch batches with position details
      const { data: batchesData, error: batchesError } = await supabase
        .from("inventory_batches")
        .select(`*, positions (id, name, category, unit, shelf_life_days, min_stock, order_quantity, last_cost)`)
        .order("arrival_date", { ascending: false });

      if (batchesError) throw batchesError;
      setBatches(batchesData || []);

      // Fetch order needs using optimized view
      await fetchOrderNeeds();
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Ошибка", description: "Не удалось загрузить данные", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderNeeds = async () => {
    try {
      // Single optimized query using the database view
      const { data, error } = await supabase
        .from("current_stock_levels")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      
      // Filter items that need ordering
      const itemsToOrder = (data || []).filter(
        item => item.current_stock < item.min_stock
      );
      
      setOrderItems(itemsToOrder);
    } catch (error) {
      console.error("Error fetching order needs:", error);
    }
  };

  const addBatchItem = () => setBatchItems([...batchItems, { positionId: "", quantity: "", costPerUnit: "" }]);
  const removeBatchItem = (index: number) => {
    if (batchItems.length === 1) return;
    setBatchItems(batchItems.filter((_, i) => i !== index));
  };
  const updateBatchItem = (index: number, field: keyof BatchItem, value: string) => {
    const updated = [...batchItems];
    updated[index][field] = value;
    setBatchItems(updated);
  };

  const calculateExpiryDate = (arrivalDate: string, shelfLifeDays: number | null): string | null => {
    if (!shelfLifeDays) return null;
    return format(addDays(new Date(arrivalDate), shelfLifeDays), "yyyy-MM-dd");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = batchItems.filter((item) => item.positionId && item.quantity);
    if (validItems.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы одну позицию", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const batchRecords = validItems.map((item) => {
        const position = positions.find((p) => p.id === item.positionId);
        return {
          position_id: item.positionId,
          quantity: parseFloat(item.quantity),
          cost_per_unit: item.costPerUnit ? parseFloat(item.costPerUnit) : 0,
          arrival_date: arrivalDate,
          expiry_date: calculateExpiryDate(arrivalDate, position?.shelf_life_days || null),
          created_by: user.id,
        };
      });

      const { error } = await supabase.from("inventory_batches").insert(batchRecords);
      if (error) throw error;

      // Update last_cost for each position
      for (const item of validItems) {
        if (item.costPerUnit && parseFloat(item.costPerUnit) > 0) {
          await supabase
            .from("positions")
            .update({ last_cost: parseFloat(item.costPerUnit) })
            .eq("id", item.positionId);
        }
      }

      toast({ title: "Успешно", description: `Добавлено ${validItems.length} позиций` });
      setArrivalDate(format(new Date(), "yyyy-MM-dd"));
      setBatchItems([{ positionId: "", quantity: "", costPerUnit: "" }]);
      fetchData();
    } catch (error) {
      console.error("Error adding batch:", error);
      toast({ title: "Ошибка", description: "Не удалось добавить партию", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsOrdered = async (item: OrderItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("inventory_batches").insert({
        position_id: item.position_id,
        quantity: item.order_quantity,
        arrival_date: format(new Date(), "yyyy-MM-dd"),
        expiry_date: calculateExpiryDate(format(new Date(), "yyyy-MM-dd"), item.shelf_life_days),
        created_by: user.id,
      });

      if (error) throw error;
      toast({ title: "Успешно", description: `${item.name} отмечен как заказанный` });
      fetchData();
    } catch (error) {
      console.error("Error marking as ordered:", error);
      toast({ title: "Ошибка", description: "Не удалось отметить как заказанный", variant: "destructive" });
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Удалить эту партию?")) return;
    try {
      const { error } = await supabase.from("inventory_batches").delete().eq("id", batchId);
      if (error) throw error;
      toast({ title: "Успешно", description: "Партия удалена" });
      fetchData();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({ title: "Ошибка", description: "Не удалось удалить партию", variant: "destructive" });
    }
  };

  const getExpiryStatus = (batch: InventoryBatch) => {
    const expiryDateStr = batch.expiry_date || (batch.positions.shelf_life_days
      ? calculateExpiryDate(batch.arrival_date, batch.positions.shelf_life_days)
      : null);
    if (!expiryDateStr) return "normal";
    const expiryDate = new Date(expiryDateStr);
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (expiryDate < now) return "expired";
    if (expiryDate <= oneDayFromNow) return "expiring";
    return "normal";
  };

  if (roleLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  if (role !== "manager") return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Склад</h1>
            <p className="text-muted-foreground">Заказы, приход и история поставок</p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Нужно заказать</span>
              <span className="sm:hidden">Заказы</span>
              {orderItems.length > 0 && (
                <Badge variant="destructive" className="ml-1">{orderItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Добавить приход</span>
              <span className="sm:hidden">Приход</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">История поставок</span>
              <span className="sm:hidden">История</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Orders */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Позиции для заказа
                </CardTitle>
                <CardDescription>Позиции с остатком ниже минимального уровня</CardDescription>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Все позиции в норме</p>
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
                        {orderItems.map((item) => (
                          <TableRow key={item.position_id}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.category}</div>
                            </TableCell>
                            <TableCell className="text-right text-destructive font-medium">
                              {item.current_stock} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.min_stock} {item.unit}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.order_quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.last_cost > 0 
                                ? `~${(item.order_quantity * item.last_cost).toLocaleString()}₸`
                                : "—"
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => handleMarkAsOrdered(item)}>
                                Заказано
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
          </TabsContent>

          {/* Tab: Add Batch */}
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Добавить приход
                </CardTitle>
                <CardDescription>Добавить несколько позиций в одну партию поставки</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="arrival">Дата прибытия</Label>
                    <Input
                      id="arrival"
                      type="date"
                      value={arrivalDate}
                      onChange={(e) => setArrivalDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Позиции</Label>
                    {batchItems.map((item, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Позиция {index + 1}</span>
                          {batchItems.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeBatchItem(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <Select value={item.positionId} onValueChange={(value) => updateBatchItem(index, "positionId", value)}>
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
                          onChange={(e) => updateBatchItem(index, "quantity", e.target.value)}
                          placeholder="Количество"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPerUnit}
                          onChange={(e) => updateBatchItem(index, "costPerUnit", e.target.value)}
                          placeholder="Себестоимость за единицу (₸)"
                        />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addBatchItem} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить ещё позицию
                    </Button>
                  </div>

                  <div className="pt-2 border-t">
                    <ExcelImport positions={positions} onImportComplete={fetchData} />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Добавление..." : "Добавить партию"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: History */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  История поставок
                </CardTitle>
                <CardDescription>Все добавленные партии инвентаря</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Позиция</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                        <TableHead className="text-right">Себест.</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Прибытие</TableHead>
                        <TableHead>Истекает</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Нет партий
                          </TableCell>
                        </TableRow>
                      ) : (
                        batches.map((batch) => {
                          const status = getExpiryStatus(batch);
                          const totalCost = batch.quantity * (batch.cost_per_unit || 0);
                          return (
                            <TableRow key={batch.id}>
                              <TableCell>
                                <div className="font-medium">{batch.positions.name}</div>
                                <div className="text-xs text-muted-foreground">{batch.positions.category}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                {batch.quantity} {batch.positions.unit}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {batch.cost_per_unit > 0 ? `${batch.cost_per_unit.toLocaleString()}₸` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {totalCost > 0 ? `${totalCost.toLocaleString()}₸` : "—"}
                              </TableCell>
                              <TableCell>{format(new Date(batch.arrival_date), "dd.MM.yyyy")}</TableCell>
                              <TableCell>
                                {batch.expiry_date ? (
                                  <Badge variant={status === "expired" ? "destructive" : status === "expiring" ? "default" : "secondary"}>
                                    {format(new Date(batch.expiry_date), "dd.MM.yyyy")}
                                  </Badge>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteBatch(batch.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
