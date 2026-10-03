import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Spinner } from "@/components/ui/spinner";
import { useWallet } from "@/hooks/useWallet";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface WalletButtonProps {
  className?: string;
}

export const WalletButton: React.FC<WalletButtonProps> = ({ className }) => {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const shouldReduceMotion = useReducedMotion();

  const truncateAddress = (addr: string): string => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  const handleClick = () => {
    if (isConnected) {
      void disconnect();
    } else {
      void connect();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isConnecting}
      className={cn(
        "relative inline-flex items-center justify-center h-10 px-4 rounded-full text-xs font-medium border border-border/80 bg-secondary/60 hover:bg-secondary hover:border-foreground/20 text-foreground transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-70 disabled:pointer-events-none select-none",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isConnecting ? (
          <motion.span
            key="connecting"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex items-center gap-2"
          >
            <Spinner size="sm" />
            <span>Connecting...</span>
          </motion.span>
        ) : isConnected && address ? (
          <motion.span
            key="connected"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.25 } }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            className="flex items-center gap-1.5 font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{truncateAddress(address)}</span>
          </motion.span>
        ) : (
          <motion.span
            key="disconnected"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            Connect wallet
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
