import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { fadeIn, useReducedMotion } from "@/lib/motion";
import { LandingPage } from "@/pages/Landing";
import { HomePage } from "@/pages/Home";
import { SendPage } from "@/pages/Send";
import { HistoryPage } from "@/pages/History";
import { HistoryDetailPage } from "@/pages/HistoryDetail";
import { SettingsPage } from "@/pages/Settings";
import { NotFoundPage } from "@/pages/NotFound";

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <motion.div
      variants={fadeIn}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15 } }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};

export const App: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <LandingLayout>
              <PageTransition>
                <LandingPage />
              </PageTransition>
            </LandingLayout>
          }
        />
        <Route
          path="/app"
          element={
            <AppShell>
              <PageTransition>
                <HomePage />
              </PageTransition>
            </AppShell>
          }
        />
        <Route
          path="/app/send"
          element={
            <AppShell>
              <PageTransition>
                <SendPage />
              </PageTransition>
            </AppShell>
          }
        />
        <Route
          path="/app/history"
          element={
            <AppShell>
              <PageTransition>
                <HistoryPage />
              </PageTransition>
            </AppShell>
          }
        />
        <Route
          path="/app/history/:id"
          element={
            <AppShell>
              <PageTransition>
                <HistoryDetailPage />
              </PageTransition>
            </AppShell>
          }
        />
        <Route
          path="/app/settings"
          element={
            <AppShell>
              <PageTransition>
                <SettingsPage />
              </PageTransition>
            </AppShell>
          }
        />
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFoundPage />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};
