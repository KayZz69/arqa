import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDisplayName = (userId: string | undefined) => {
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchDisplayName = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        setDisplayName(data?.display_name || "");
      } catch (error) {
        console.error("Error fetching display name:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDisplayName();
  }, [userId]);

  return { displayName, loading };
};
