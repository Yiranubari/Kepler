import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ArrowUpRight, History, Settings } from "lucide-react";
import { motion } from "motion/react";
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
  { label: "Home", to: "/app", icon: Home },
  { label: "Send", to: "/app/send", icon: ArrowUpRight },
  { label: "History", to: "/app/history", icon: History },
  { label: "Settings", to: "/app/settings", icon: Settings }
];

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col selection:bg-accent selection:text-accent-foreground">
      <header className="sticky top-0 z-40 w-full h-16 border-b border-white/[0.08] bg-black">
        <div className="max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 h-full">
            <Link
              to="/app"
              className="font-display font-black text-[18px] tracking-[0.08em] uppercase text-foreground hover:opacity-90 transition-opacity"
            >
              KEPLER
            </Link>
            <nav className="hidden sm:flex items-center gap-1 h-full">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) =>
                    cn(
                      "relative h-16 flex items-center px-4 text-sm font-medium transition-colors select-none",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      {isActive ? (
                        <motion.div
                          layoutId="appNavUnderline"
                          className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                          transition={{ duration: 0.15 }}
                        />
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 py-8 pb-24 sm:pb-8">
        {children}
      </main>

      <nav
        aria-label="Mobile navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-black px-2 py-2 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-md text-[11px] font-medium transition-colors select-none min-w-[56px]",
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
