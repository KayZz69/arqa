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
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { format, addDays } from "date-fns";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
}

interface InventoryBatch {
  id: string;
  position_id: string;
  quantity: number;
  arrival_date: string;
  expiry_date: string | null;
  created_at: string;
  positions: Position;
}

interface BatchItem {
  positionId: string;
  quantity: string;
}

export default function InventoryBatches() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [positions, setPositions] = useState<Position[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state - multiple items per batch
  const [arrivalDate, setArrivalDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [batchItems, setBatchItems] = useState<BatchItem[]>([
    { positionId: "", quantity: "" },
  ]);

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
        .select(
          `
          *,
          positions (
            id,
            name,
            category,
            unit,
            shelf_life_days
          )
        `
        )
        .order("arrival_date", { ascending: false });

      if (batchesError) throw batchesError;
      setBatches(batchesData || []);
      
      // Check for expiring/expired batches and notify managers
      await checkAndNotifyExpiringBatches(batchesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAndNotifyExpiringBatches = async (batchData: InventoryBatch[]) => {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Get all managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

      if (!managers || managers.length === 0) return;

      const notifications = [];
      
      for (const batch of batchData) {
        if (!batch.expiry_date) continue;
        
        const expiryDate = new Date(batch.expiry_date);
        const isExpired = expiryDate < now;
        const isExpiringSoon = expiryDate >= now && expiryDate <= oneDayFromNow;
        
        if (isExpired || isExpiringSoon) {
          const message = isExpired
            ? `Batch expired: ${batch.positions.name} (${batch.quantity} ${batch.positions.unit}) expired on ${format(expiryDate, "MMM dd, yyyy")}`
            : `Batch expiring soon: ${batch.positions.name} (${batch.quantity} ${batch.positions.unit}) expires on ${format(expiryDate, "MMM dd, yyyy")}`;

          // Create notification for each manager
          for (const manager of managers) {
            notifications.push({
              user_id: manager.user_id,
              type: isExpired ? "batch_expired" : "batch_expiring",
              message,
              related_id: batch.id,
            });
          }
        }
      }

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }
    } catch (error) {
      console.error("Error creating notifications:", error);
    }
  };

  const addBatchItem = () => {
    setBatchItems([...batchItems, { positionId: "", quantity: "" }]);
  };

  const removeBatchItem = (index: number) => {
    if (batchItems.length === 1) return;
    setBatchItems(batchItems.filter((_, i) => i !== index));
  };

  const updateBatchItem = (
    index: number,
    field: keyof BatchItem,
    value: string
  ) => {
    const updated = [...batchItems];
    updated[index][field] = value;
    setBatchItems(updated);
  };

  const calculateExpiryDate = (
    arrivalDate: string,
    shelfLifeDays: number | null
  ): string | null => {
    if (!shelfLifeDays) return null;
    const arrival = new Date(arrivalDate);
    const expiry = addDays(arrival, shelfLifeDays);
    return format(expiry, "yyyy-MM-dd");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const validItems = batchItems.filter(
      (item) => item.positionId && item.quantity
    );
    if (validItems.length === 0) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, добавьте хотя бы одну позицию с количеством",
        variant: "destructive",
      });
      return;
    }

    if (!arrivalDate) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, выберите дату прибытия",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Prepare batch records with calculated expiry dates
      const batchRecords = validItems.map((item) => {
        const position = positions.find((p) => p.id === item.positionId);
        const expiryDate = calculateExpiryDate(
          arrivalDate,
          position?.shelf_life_days || null
        );

        return {
          position_id: item.positionId,
          quantity: parseFloat(item.quantity),
          arrival_date: arrivalDate,
          expiry_date: expiryDate,
          created_by: user.id,
        };
      });

      const { error } = await supabase
        .from("inventory_batches")
        .insert(batchRecords);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Добавлено ${validItems.length} позиций в партию`,
      });

      // Reset form
      setArrivalDate(format(new Date(), "yyyy-MM-dd"));
      setBatchItems([{ positionId: "", quantity: "" }]);

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error adding batch:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить партию",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту партию?")) return;

    try {
      const { error } = await supabase
        .from("inventory_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Партия успешно удалена",
      });

      fetchData();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить партию",
        variant: "destructive",
      });
    }
  };

  const getExpiryDisplay = (batch: InventoryBatch): string => {
    if (batch.expiry_date) {
      return format(new Date(batch.expiry_date), "dd.MM.yyyy");
    }
    if (batch.positions.shelf_life_days) {
      const calculated = calculateExpiryDate(
        batch.arrival_date,
        batch.positions.shelf_life_days
      );
      return calculated ? format(new Date(calculated), "dd.MM.yyyy") : "—";
    }
    return "—";
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Управление партиями инвентаря
            </h1>
            <p className="text-muted-foreground">
              Добавление нескольких позиций на партию с автоматическим расчётом срока годности
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Batch Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Добавить новую партию
              </CardTitle>
              <CardDescription>
                Добавить несколько позиций в одну партию поставки
              </CardDescription>
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
                  <p className="text-xs text-muted-foreground">
                    Сроки годности рассчитываются автоматически
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Позиции и количество</Label>
                  {batchItems.map((item, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Позиция {index + 1}
                          </span>
                          {batchItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBatchItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <Select
                          value={item.positionId}
                          onValueChange={(value) =>
                            updateBatchItem(index, "positionId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите позицию" />
                          </SelectTrigger>
                          <SelectContent>
                            {positions.map((position) => (
                              <SelectItem key={position.id} value={position.id}>
                                {position.category} - {position.name}
                                {position.shelf_life_days && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({position.shelf_life_days}д)
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            updateBatchItem(index, "quantity", e.target.value)
                          }
                          placeholder="Количество"
                        />
                        {item.positionId && (
                          <p className="text-xs text-muted-foreground">
                            Единица:{" "}
                            {positions.find((p) => p.id === item.positionId)
                              ?.unit || ""}
                          </p>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addBatchItem}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить ещё позицию
                    </Button>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Добавление..." : "Добавить партию"}
                  </Button>
              </form>
            </CardContent>
          </Card>

          {/* Batches List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Текущие партии</CardTitle>
              <CardDescription>
                Просмотр и управление существующими партиями инвентаря
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Позиция</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead className="text-right">Количество</TableHead>
                      <TableHead>Прибытие</TableHead>
                      <TableHead>Истекает</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          Партии не найдены
                        </TableCell>
                      </TableRow>
                    ) : (
                      batches.map((batch) => {
                        const status = getExpiryStatus(batch);
                        const expiryDisplay = getExpiryDisplay(batch);
                        
                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">
                              {batch.positions.name}
                            </TableCell>
                            <TableCell>{batch.positions.category}</TableCell>
                            <TableCell className="text-right">
                              {batch.quantity} {batch.positions.unit}
                            </TableCell>
                            <TableCell>
                              {format(new Date(batch.arrival_date), "dd.MM.yyyy")}
                            </TableCell>
                            <TableCell>
                              {status === "expired" ? (
                                <span className="text-destructive font-semibold">
                                  {expiryDisplay} (Истёк)
                                </span>
                              ) : status === "expiring" ? (
                                <span className="text-yellow-600 dark:text-yellow-500 font-semibold">
                                  {expiryDisplay} (Истекает скоро)
                                </span>
                              ) : (
                                <span>{expiryDisplay}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(batch.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
        </div>
      </div>
    </div>
  );
}
