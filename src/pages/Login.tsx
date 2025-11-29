import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Coffee, UserCog } from "lucide-react";

type Step = 'role' | 'user' | 'password';
type Role = 'barista' | 'manager';

interface UserOption {
  user_id: string;
  display_name: string;
  username: string;
}

const Login = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Load users when role is selected
  useEffect(() => {
    if (selectedRole) {
      const fetchUsers = async () => {
        setLoading(true);
        
        // 1. Get user_ids with the selected role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', selectedRole);

        if (roleError) {
          console.error("Error fetching roles:", roleError);
          toast.error("Ошибка загрузки пользователей");
          setLoading(false);
          return;
        }

        if (roleData && roleData.length > 0) {
          const userIds = roleData.map(r => r.user_id);
          
          // 2. Get profiles for these users
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, display_name, username')
            .in('user_id', userIds);

          if (profileError) {
            console.error("Error fetching profiles:", profileError);
            toast.error("Ошибка загрузки пользователей");
          } else {
            setUsers(profiles || []);
          }
        } else {
          setUsers([]);
        }
        
        setLoading(false);
      };
      fetchUsers();
    }
  }, [selectedRole]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('user');
  };

  const handleUserSelect = (user: UserOption) => {
    setSelectedUser(user);
    setStep('password');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    const email = `${selectedUser.username}@barista.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Неверный пароль");
    } else {
      toast.success(`Добро пожаловать, ${selectedUser.display_name}!`);
      navigate("/");
    }
    setLoading(false);
  };

  const handleBack = () => {
    if (step === 'password') {
      setStep('user');
      setSelectedUser(null);
      setPassword("");
    } else if (step === 'user') {
      setStep('role');
      setSelectedRole(null);
      setUsers([]);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            {step !== 'role' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle>
              {step === 'role' && '☕ Добро пожаловать'}
              {step === 'user' && 'Выберите аккаунт'}
              {step === 'password' && `Вход: ${selectedUser?.display_name}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'role' && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-16 text-lg justify-start gap-3"
                onClick={() => handleRoleSelect('barista')}
              >
                <Coffee className="h-6 w-6" />
                <span>Бариста</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-16 text-lg justify-start gap-3"
                onClick={() => handleRoleSelect('manager')}
              >
                <UserCog className="h-6 w-6" />
                <span>Управляющий</span>
              </Button>
            </div>
          )}

          {step === 'user' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Загрузка...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Пользователи не найдены
                </div>
              ) : (
                users.map((user) => (
                  <Button
                    key={user.user_id}
                    variant="outline"
                    className="w-full h-14 text-base justify-start gap-3"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-medium">
                        {user.display_name[0]}
                      </span>
                    </div>
                    <span>{user.display_name}</span>
                  </Button>
                ))
              )}
            </div>
          )}

          {step === 'password' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="h-12"
                />
              </div>
              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading ? "Вход..." : "Войти"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
