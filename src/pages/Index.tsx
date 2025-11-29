import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">Welcome, {user?.email}</p>
            {role && <p className="text-sm text-muted-foreground">Role: {role}</p>}
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        {!role && (
          <Card>
            <CardHeader>
              <CardTitle>No Role Assigned</CardTitle>
              <CardDescription>
                Please contact an administrator to assign you a role (barista or manager)
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {role === "barista" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Reports</CardTitle>
                <CardDescription>Create and view your daily inventory reports</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Create New Report</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>View current inventory levels</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  View Inventory
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {role === "manager" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>All Reports</CardTitle>
                <CardDescription>View and manage all daily reports</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">View Reports</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Inventory Management</CardTitle>
                <CardDescription>Manage inventory batches</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Manage Inventory</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Positions</CardTitle>
                <CardDescription>Configure inventory positions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Manage Positions</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
