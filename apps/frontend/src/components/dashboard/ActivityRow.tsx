import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Scenario, PaymentTarget } from "@kepler/shared";
import { StatusBadge } from "@/components/ui/status-badge";
import { listItem, useReducedMotion } from "@/lib/motion";

export interface ActivityRowProps {
  scenario: Scenario;
  index: number;
}

const formatRelativeTime = (dateInput: Date | string): string => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return "just now";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  return date.toLocaleDateString();
};

const formatTruncatedTarget = (target: PaymentTarget): string => {
  const payload = target.payload;
  if (!payload || typeof payload !== "object") {
    return target.kind;
  }
  const record = payload as unknown as Record<string, unknown>;
  if (typeof record.invoice === "string" && record.invoice.length > 0) {
    const inv = record.invoice;
    return inv.length > 20 ? `${inv.slice(0, 10)}...${inv.slice(-6)}` : inv;
  }
  if (typeof record.address === "string" && record.address.length > 0) {
    const addr = record.address;
    return addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr;
  }
  if (typeof record.request === "string" && record.request.length > 0) {
    const req = record.request;
    return req.length > 20 ? `${req.slice(0, 10)}...${req.slice(-6)}` : req;
  }
  return target.kind;
};

const formatKind = (kind: string): string => {
  const lower = kind.toLowerCase();
  if (lower === "lightning") {
    return "Lightning";
  }
  if (lower === "bitcoin") {
    return "Bitcoin";
  }
  if (lower === "cashu") {
    return "Cashu";
  }
  return kind.charAt(0).toUpperCase() + kind.slice(1);
};

export const ActivityRow: React.FC<ActivityRowProps> = ({ scenario }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : listItem}
      whileHover={
        shouldReduceMotion
          ? undefined
          : { y: -1, transition: { duration: 0.15, ease: "easeOut" } }
      }
      className="w-full"
    >
      <Link
        to={`/app/history/${scenario.id}`}
        className="flex items-center justify-between py-4 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors duration-150 group cursor-pointer"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 pr-4">
          <span className="text-sm font-semibold font-sans text-foreground">
            {formatKind(scenario.target.kind)}
          </span>
          <span className="text-xs font-mono text-muted-foreground truncate">
            {formatTruncatedTarget(scenario.target)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={scenario.status} />
          <span className="text-xs font-sans text-muted-foreground">
            {formatRelativeTime(scenario.createdAt)}
          </span>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors duration-150 hidden sm:block" />
        </div>
      </Link>
    </motion.div>
  );
};
