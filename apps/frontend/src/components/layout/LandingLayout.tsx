import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface LandingLayoutProps {
  children: React.ReactNode;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const githubUrl = import.meta.env.VITE_GITHUB_URL;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col selection:bg-accent selection:text-accent-foreground">
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200",
          isScrolled
            ? "bg-black border-b border-white/[0.08]"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 h-full flex items-center justify-between">
          <Link
            to="/"
            className="font-display font-black text-[18px] tracking-[0.08em] uppercase text-foreground hover:opacity-90 transition-opacity"
          >
            KEPLER
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works
            </a>
            {githubUrl ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            ) : null}
          </nav>

          <div className="hidden md:flex items-center">
            <Link
              to="/app"
              className="inline-flex items-center justify-center rounded-none bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Launch app
            </Link>
          </div>

          <button
            type="button"
            aria-label={isMobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="md:hidden p-2 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden bg-black border-b border-white/[0.08] px-6 py-4 flex flex-col gap-4 overflow-hidden"
            >
              <a
                href="#features"
                onClick={() => setIsMobileOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setIsMobileOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                How it works
              </a>
              {githubUrl ? (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              ) : null}
              <Link
                to="/app"
                onClick={() => setIsMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-none bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Launch app
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
