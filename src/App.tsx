import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Setup = lazy(() => import("./pages/Setup"));
const Positions = lazy(() => import("./pages/Positions"));
const DailyReport = lazy(() => import("./pages/DailyReport"));
const Warehouse = lazy(() => import("./pages/Warehouse"));
const CurrentInventory = lazy(() => import("./pages/CurrentInventory"));
const ManagerReports = lazy(() => import("./pages/ManagerReports"));
const ReportHistory = lazy(() => import("./pages/ReportHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading spinner component for Suspense fallback
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

// Optimized QueryClient with caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Data considered fresh for 1 minute
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      retry: 1, // Only retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
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
                path="/warehouse"
                element={
                  <ProtectedRoute>
                    <Warehouse />
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
                path="/report-history"
                element={
                  <ProtectedRoute>
                    <ReportHistory />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
