import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the current user's role.
 * Now uses centralized AuthContext to avoid duplicate auth checks.
 */
export const useUserRole = () => {
  const { role, loading, isManager, isBarista } = useAuth();
  return { role, loading, isManager, isBarista };
};

