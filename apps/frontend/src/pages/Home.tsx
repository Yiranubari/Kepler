import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Send, History, Settings, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { useReducedMotion } from "@/lib/motion";

interface HomeCardConfig {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  actionLabel: string;
}

const CARDS: HomeCardConfig[] = [
  {
    title: "Send payment",
    description: "Send Bitcoin, Lightning, or ecash with an automated privacy check.",
    path: "/send",
    icon: Send,
    actionLabel: "Start payment"
  },
  {
    title: "Payment history",
    description: "Review past payments, route decisions, and receipts.",
    path: "/history",
    icon: History,
    actionLabel: "View history"
  },
  {
    title: "Settings",
    description: "Manage spending limits, policy rules, and allowed services.",
    path: "/settings",
    icon: Settings,
    actionLabel: "Open settings"
  }
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title="Welcome to Kepler"
        subtitle="Send Bitcoin, Lightning, and ecash with a privacy check before every payment."
      />

      <StaggerList delayChildren={0.04} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <StaggerItem key={card.path}>
              <motion.div
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2, transition: { duration: 0.15, ease: "easeOut" } }
                }
                onClick={() => navigate(card.path)}
                className="cursor-pointer h-full"
              >
                <Card className="h-full p-6 flex flex-col justify-between hover:border-foreground/30 transition-colors">
                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground">
                      <Icon className="w-5 h-5" />
                    </div>
                    <CardHeader className="p-0 space-y-1.5">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                  </div>
                  <CardContent className="p-0 pt-6 flex items-center text-sm font-medium text-foreground">
                    <span>{card.actionLabel}</span>
                    <ArrowUpRight className="w-4 h-4 ml-1.5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </motion.div>
            </StaggerItem>
          );
        })}
      </StaggerList>
    </div>
  );
};
