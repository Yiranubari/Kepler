import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { Button } from "@/components/ui/button";

export interface GreetingRowProps {
  address: string | null;
  isConnected: boolean;
}

const formatAddress = (addr: string): string => {
  if (addr.length <= 10) {
    return addr;
  }
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
};

export const GreetingRow: React.FC<GreetingRowProps> = ({
  address,
  isConnected
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const isWalletConnected = Boolean(isConnected && address);

  return (
    <motion.section
      variants={shouldReduceMotion ? undefined : fadeInUp}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
      className="w-full flex flex-col md:flex-row md:items-end justify-between gap-6"
    >
      <div className="w-full md:w-[60%] flex flex-col">
        <span className="font-sans text-label-caps text-muted-foreground uppercase tracking-[0.12em] mb-2">
          DASHBOARD
        </span>
        <h1 className="font-display text-heading-1 text-foreground font-bold tracking-[-0.02em] leading-[1.1] mb-2">
          Your payments
        </h1>
        <p className="font-sans text-body text-muted-foreground">
          {isWalletConnected && address ? (
            <>
              Wallet connected as{" "}
              <span className="font-mono text-foreground font-medium">
                {formatAddress(address)}
              </span>
            </>
          ) : (
            "No wallet connected. Connect one to send on-chain."
          )}
        </p>
      </div>

      <div className="w-full md:w-[40%] flex flex-col sm:flex-row items-stretch sm:items-center md:justify-end gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate("/app/send")}
          className="w-full sm:w-auto"
        >
          Send a payment
        </Button>
        <Link
          to="/app/history"
          className="inline-flex items-center justify-center h-11 px-4 text-sm font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md transition-colors duration-150 w-full sm:w-auto text-center"
        >
          View history
        </Link>
      </div>
    </motion.section>
  );
};
