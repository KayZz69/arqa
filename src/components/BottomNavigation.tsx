import { Home, ClipboardList, Package, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Вы вышли из системы");
    navigate("/login");
  };

  const navItems = [
    { to: "/", icon: Home, label: "Главная" },
    { to: "/daily-report", icon: ClipboardList, label: "Отчёт" },
    { to: "/current-inventory", icon: Package, label: "Инвентарь" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden animate-slide-up">
      <div className="glass rounded-2xl border border-border/50 shadow-xl">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200"
                activeClassName=""
              >
                <div className={`
                  flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200
                  ${active 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }
                `}>
                  <item.icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
                  <span className={`text-xs font-medium ${active ? "" : ""}`}>{item.label}</span>
                </div>
              </NavLink>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 px-4 py-2 text-muted-foreground transition-all duration-200 hover:text-foreground"
          >
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl hover:bg-muted/50 transition-colors">
              <LogOut className="h-5 w-5" />
              <span className="text-xs font-medium">Выход</span>
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
