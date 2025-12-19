import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export function useCategories(activeOnly = true) {
  return useQuery({
    queryKey: ["categories", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
