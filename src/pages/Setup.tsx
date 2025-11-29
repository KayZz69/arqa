import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Setup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const createAccounts = async () => {
    setLoading(true);

    const accounts = [
      { username: "1", password: "1", role: "barista" as const },
      { username: "2", password: "2", role: "barista" as const },
      { username: "69", password: "69", role: "manager" as const },
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const account of accounts) {
      const email = `${account.username}@barista.local`;
      
      // Create the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: account.password,
        options: {
          data: {
            username: account.username,
          },
        },
      });

      if (signUpError) {
        console.error(`Error creating user ${account.username}:`, signUpError);
        errorCount++;
        continue;
      }

      if (signUpData.user) {
        // Assign role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: signUpData.user.id,
            role: account.role,
          });

        if (roleError) {
          console.error(`Error assigning role to user ${account.username}:`, roleError);
          errorCount++;
        } else {
          successCount++;
        }
      }
    }

    setLoading(false);

    if (successCount === accounts.length) {
      toast.success("All accounts created successfully!");
      setSetupComplete(true);
      
      // Sign out the setup session
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } else {
      toast.error(`Setup partially completed. ${successCount} accounts created, ${errorCount} errors.`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initial Setup</CardTitle>
          <CardDescription>
            Create the pre-configured user accounts for the barista system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">This will create:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Barista 1 (Username: 1, Password: 1)</li>
              <li>Barista 2 (Username: 2, Password: 2)</li>
              <li>Manager (Username: 69, Password: 69)</li>
            </ul>
          </div>
          
          {!setupComplete ? (
            <Button 
              onClick={createAccounts} 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Creating accounts..." : "Create Accounts"}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Setup complete! Redirecting to login...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
