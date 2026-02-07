import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePagination } from "@/hooks/usePagination";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { usePositions } from "@/hooks/usePositions";
import { useOrderNeeds } from "@/hooks/useCurrentStock";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ShoppingCart, History } from "lucide-react";
import { format, addDays } from "date-fns";
import { filterItemsByQuery } from "@/lib/search";
import { OrdersTab } from "@/components/warehouse/OrdersTab";
import { AddBatchTab } from "@/components/warehouse/AddBatchTab";
import { HistoryTab } from "@/components/warehouse/HistoryTab";

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

interface BatchItem {
  positionId: string;
  quantity: string;
  costPerUnit: string;
}

export default function Warehouse() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: positions = [], isLoading: positionsLoading } = usePositions(true);
  const { data: orderItems = [], isLoading: orderLoading } = useOrderNeeds();
  const [submitting, setSubmitting] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");

  // Form state
  const [arrivalDate, setArrivalDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [batchItems, setBatchItems] = useState<BatchItem[]>([{ positionId: "", quantity: "", costPerUnit: "" }]);

  // Fetch batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["inventoryBatches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select(`*, positions (id, name, category, unit, shelf_life_days)`)
        .order("arrival_date", { ascending: false });
      if (error) throw error;
      return data as InventoryBatch[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = positionsLoading || orderLoading || batchesLoading;

  const filteredOrderItems = useMemo(() => filterItemsByQuery(
    orderItems,
    orderSearch,
    (item) => `${item.name} ${item.category}`
  ), [orderItems, orderSearch]);

  const filteredBatches = useMemo(() => filterItemsByQuery(
    batches,
    batchSearch,
    (batch) => `${batch.positions?.name ?? ""} ${batch.positions?.category ?? ""}`
  ), [batches, batchSearch]);

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

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["inventoryBatches"] });
    queryClient.invalidateQueries({ queryKey: ["currentStock"] });
    queryClient.invalidateQueries({ queryKey: ["positions"] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = batchItems.filter((item) => item.positionId && item.quantity);
    if (validItems.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы одну позицию", variant: "destructive" });
      return;
    }

    for (const item of validItems) {
      const qty = parseFloat(item.quantity);
      const cost = item.costPerUnit ? parseFloat(item.costPerUnit) : 0;
      const position = positions.find((p) => p.id === item.positionId);
      const posName = position ? position.name : "Неизвестная позиция";
      if (!qty || qty <= 0) {
        toast({ title: "Ошибка", description: `${posName}: количество должно быть больше 0`, variant: "destructive" });
        return;
      }
      if (cost < 0) {
        toast({ title: "Ошибка", description: `${posName}: себестоимость не может быть отрицательной`, variant: "destructive" });
        return;
      }
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

      const costUpdates = validItems
        .filter((item) => item.costPerUnit && parseFloat(item.costPerUnit) > 0)
        .map(async (item) => {
          const { error: costError } = await supabase
            .from("positions")
            .update({ last_cost: parseFloat(item.costPerUnit) })
            .eq("id", item.positionId);
          if (costError) throw costError;
        });
      if (costUpdates.length > 0) {
        await Promise.all(costUpdates);
      }

      toast({ title: "Успешно", description: `Добавлено ${validItems.length} позиций` });
      setArrivalDate(format(new Date(), "yyyy-MM-dd"));
      setBatchItems([{ positionId: "", quantity: "", costPerUnit: "" }]);
      invalidateQueries();
    } catch (error) {
      console.error("Error adding batch:", error);
      toast({ title: "Ошибка", description: "Не удалось добавить партию", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOrder = async (
    item: { position_id: string; name: string; shelf_life_days: number | null },
    orderArrivalDate: string,
    qty: number,
    cost: number
  ) => {
    if (!qty || qty <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше 0", variant: "destructive" });
      return;
    }
    if (cost < 0) {
      toast({ title: "Ошибка", description: "Себестоимость не может быть отрицательной", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("inventory_batches").insert({
        position_id: item.position_id,
        quantity: qty,
        cost_per_unit: cost,
        arrival_date: orderArrivalDate,
        expiry_date: calculateExpiryDate(orderArrivalDate, item.shelf_life_days),
        created_by: user.id,
      });

      if (error) throw error;

      if (cost > 0) {
        await supabase
          .from("positions")
          .update({ last_cost: cost })
          .eq("id", item.position_id);
      }

      toast({ title: "Успешно", description: `Приход ${item.name} оформлен` });
      invalidateQueries();
    } catch (error) {
      console.error("Error confirming order:", error);
      toast({ title: "Ошибка", description: "Не удалось оформить приход", variant: "destructive" });
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Удалить эту партию?")) return;
    try {
      const { error } = await supabase.from("inventory_batches").delete().eq("id", batchId);
      if (error) throw error;
      toast({ title: "Успешно", description: "Партия удалена" });
      invalidateQueries();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({ title: "Ошибка", description: "Не удалось удалить партию", variant: "destructive" });
    }
  };

  const { paginatedItems: paginatedBatches, currentPage, totalPages, goToPage, resetPage, hasNextPage, hasPrevPage } = usePagination(filteredBatches, 25);

  // Reset page when search changes
  useEffect(() => {
    resetPage();
  }, [batchSearch, resetPage]);

  const getExpiryStatus = (batch: InventoryBatch) => {
    const expiryDateStr = batch.expiry_date || (batch.positions?.shelf_life_days
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-fade-in">
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

          <TabsContent value="orders">
            <OrdersTab
              orderItems={orderItems}
              filteredOrderItems={filteredOrderItems}
              orderSearch={orderSearch}
              onOrderSearchChange={setOrderSearch}
              onConfirmOrder={handleConfirmOrder}
            />
          </TabsContent>

          <TabsContent value="add">
            <AddBatchTab
              positions={positions}
              arrivalDate={arrivalDate}
              onArrivalDateChange={setArrivalDate}
              batchItems={batchItems}
              onAddItem={addBatchItem}
              onRemoveItem={removeBatchItem}
              onUpdateItem={updateBatchItem}
              onSubmit={handleSubmit}
              submitting={submitting}
              onImportComplete={invalidateQueries}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab
              batches={batches}
              filteredBatches={filteredBatches}
              batchSearch={batchSearch}
              onBatchSearchChange={setBatchSearch}
              onDeleteBatch={handleDeleteBatch}
              getExpiryStatus={getExpiryStatus}
              calculateExpiryDate={calculateExpiryDate}
              paginatedBatches={paginatedBatches}
              paginationControls={totalPages > 1 ? (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Страница {currentPage + 1} из {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={!hasPrevPage}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={!hasNextPage}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              ) : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
