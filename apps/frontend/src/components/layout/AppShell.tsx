import React from "react";
import { NavLink } from "react-router-dom";
import { Home, ArrowUpRight, History, Settings } from "lucide-react";
import { WalletButton } from "@/components/layout/WalletButton";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Send", to: "/send", icon: ArrowUpRight },
  { label: "History", to: "/history", icon: History },
  { label: "Settings", to: "/settings", icon: Settings }
];

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent selection:text-accent-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <NavLink
              to="/"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
            >
              Kepler
            </NavLink>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 select-none",
                      isActive
                        ? "bg-secondary text-foreground border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8">
        {children}
      </main>

      <nav
        aria-label="Mobile navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-md px-2 py-2 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-md text-[11px] font-medium transition-colors duration-150 select-none min-w-[56px]",
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
