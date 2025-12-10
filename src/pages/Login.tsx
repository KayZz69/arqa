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
    <div className="flex min-h-screen items-center justify-center p-4 gradient-warm">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass border-border/50 shadow-xl animate-scale-in">
        <CardHeader className="text-center pb-2">
          {step === 'role' && (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg animate-float">
                <Coffee className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold">Добро пожаловать</CardTitle>
              <p className="text-muted-foreground text-sm">Выберите вашу роль для входа</p>
            </div>
          )}
          {step !== 'role' && (
            <div className="flex items-center gap-3 animate-fade-in">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-9 w-9 rounded-xl hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-left">
                <CardTitle className="text-lg">
                  {step === 'user' && 'Выберите аккаунт'}
                  {step === 'password' && selectedUser?.display_name}
                </CardTitle>
                {step === 'password' && (
                  <p className="text-muted-foreground text-sm">Введите пароль для входа</p>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {step === 'role' && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-20 text-lg justify-start gap-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all hover-lift group animate-slide-up opacity-0 stagger-1"
                onClick={() => handleRoleSelect('barista')}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Coffee className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <span className="font-semibold block">Бариста</span>
                  <span className="text-sm text-muted-foreground">Ежедневные отчёты</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full h-20 text-lg justify-start gap-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all hover-lift group animate-slide-up opacity-0 stagger-2"
                onClick={() => handleRoleSelect('manager')}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                  <UserCog className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div className="text-left">
                  <span className="font-semibold block">Управляющий</span>
                  <span className="text-sm text-muted-foreground">Управление и аналитика</span>
                </div>
              </Button>
            </div>
          )}

          {step === 'user' && (
            <div className="space-y-3 animate-fade-in">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-muted-foreground text-sm">Загрузка...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Пользователи не найдены</p>
                </div>
              ) : (
                users.map((user, index) => (
                  <Button
                    key={user.user_id}
                    variant="outline"
                    className="w-full h-16 text-base justify-start gap-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all hover-lift animate-slide-up opacity-0"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold shadow-sm">
                      {user.display_name[0]}
                    </div>
                    <span className="font-medium">{user.display_name}</span>
                  </Button>
                ))
              )}
            </div>
          )}

          {step === 'password' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="h-14 text-lg rounded-xl border-2 focus:border-primary"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 text-lg rounded-xl gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Вход...</span>
                  </div>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
