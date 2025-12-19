import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  min_stock: number;
  order_quantity: number;
  last_cost: number | null;
  active: boolean;
}

export function usePositions(activeOnly = true) {
  return useQuery({
    queryKey: ["positions", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("positions")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Position[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
