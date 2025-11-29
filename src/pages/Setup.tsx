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
      { username: "1", password: "111111", role: "barista" as const },
      { username: "2", password: "222222", role: "barista" as const },
      { username: "69", password: "696969", role: "manager" as const },
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
      toast.success("Все аккаунты созданы успешно!");
      setSetupComplete(true);
      
      // Sign out the setup session
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } else {
      toast.error(`Настройка частично завершена. Создано аккаунтов: ${successCount}, ошибок: ${errorCount}.`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Начальная настройка</CardTitle>
          <CardDescription>
            Создание предварительно настроенных учётных записей для системы бариста
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Будут созданы:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Бариста 1 (Имя: 1, Пароль: 111111)</li>
              <li>Бариста 2 (Имя: 2, Пароль: 222222)</li>
              <li>Менеджер (Имя: 69, Пароль: 696969)</li>
            </ul>
          </div>
          
          {!setupComplete ? (
            <Button 
              onClick={createAccounts} 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Создание аккаунтов..." : "Создать аккаунты"}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Настройка завершена! Переход на страницу входа...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
