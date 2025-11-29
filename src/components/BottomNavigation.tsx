import { Home, ClipboardList, Package, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

export function BottomNavigation() {
  const navItems = [
    { to: "/", icon: Home, label: "Главная" },
    { to: "/daily-report", icon: ClipboardList, label: "Отчёт" },
    { to: "/current-inventory", icon: Package, label: "Инвентарь" },
    { to: "/profile", icon: User, label: "Профиль" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground transition-colors hover:text-foreground"
            activeClassName="text-primary font-medium"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
