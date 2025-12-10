import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Positions from "./pages/Positions";
import DailyReport from "./pages/DailyReport";
import InventoryBatches from "./pages/InventoryBatches";
import CurrentInventory from "./pages/CurrentInventory";
import ManagerReports from "./pages/ManagerReports";
import Notifications from "./pages/Notifications";
import Orders from "./pages/Orders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/positions"
            element={
              <ProtectedRoute>
                <Positions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-report"
            element={
              <ProtectedRoute>
                <DailyReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory-batches"
            element={
              <ProtectedRoute>
                <InventoryBatches />
              </ProtectedRoute>
            }
          />
          <Route
            path="/current-inventory"
            element={
              <ProtectedRoute>
                <CurrentInventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager-reports"
            element={
              <ProtectedRoute>
                <ManagerReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
