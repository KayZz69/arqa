import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StockLevel {
  position_id: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  order_quantity: number;
  last_cost: number | null;
  shelf_life_days: number | null;
  current_stock: number;
  active: boolean;
}

export function useCurrentStock(activeOnly = true) {
  return useQuery({
    queryKey: ["currentStock", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("current_stock_levels")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockLevel[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - more frequent updates for stock
  });
}

export function useOrderNeeds() {
  const { data: stockLevels, ...rest } = useCurrentStock(true);

  const orderItems = stockLevels?.filter(
    (item) => (item.current_stock || 0) < (item.min_stock || 0)
  ) || [];

  return { data: orderItems, stockLevels, ...rest };
}
